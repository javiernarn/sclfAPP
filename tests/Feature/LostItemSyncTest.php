<?php

namespace Tests\Feature;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Models\User;
use App\Services\Claims\ClaimService;
use App\Services\Claims\LostItemSyncService;
use App\Services\Release\ItemReleaseService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The lost report and the found item are two halves of one case: when the item
 * is handed back, BOTH must read as closed — even when the owner never picked
 * their lost report while filing the claim (the original "lost still Pending,
 * found already Released" bug).
 */
class LostItemSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    /** A lost report and the found item it describes, same words so they clearly match. */
    protected function pair(User $owner, array $lostOverrides = [], array $foundOverrides = []): array
    {
        $found = FoundItem::factory()->create(array_merge([
            'item_name' => 'Smartphone', 'category' => 'Phones & Gadgets', 'brand' => 'Samsung', 'color' => 'Black',
        ], $foundOverrides));
        $lost = LostItem::factory()->create(array_merge([
            'user_id' => $owner->id, 'item_name' => 'Smartphone', 'category' => 'Phones & Gadgets',
            'brand' => 'Samsung', 'color' => 'Black', 'status' => LostItem::STATUS_PENDING,
        ], $lostOverrides));

        return [$lost, $found];
    }

    protected function submit(User $claimant, FoundItem $found, ?int $lostId = null): Claim
    {
        return app(ClaimService::class)->submit($claimant, $found, ['lost_item_id' => $lostId]);
    }

    protected function approveAndRelease(Claim $claim, User $officer): Claim
    {
        $claims = app(ClaimService::class);
        $claim = $claims->transition($claim, Claim::STATUS_UNDER_REVIEW, $officer);
        $claim = $claims->transition($claim, Claim::STATUS_APPROVED, $officer);
        app(ItemReleaseService::class)->generate($claim, $officer);

        return app(ItemReleaseService::class)->manualRelease($claim->fresh(), $officer, 'Handed over at the counter.');
    }

    public function test_claim_filed_without_a_lost_report_is_linked_to_the_claimants_matching_one(): void
    {
        $owner = $this->makeUser('student');
        [$lost, $found] = $this->pair($owner);

        $claim = $this->submit($owner, $found, null);

        $this->assertSame($lost->id, $claim->lost_item_id);
        $this->assertSame(LostItem::STATUS_MATCHED, $lost->fresh()->status);
    }

    public function test_the_reported_bug_lost_report_closes_when_the_unlinked_claim_is_released(): void
    {
        $officer = $this->makeUser('security_officer');
        $owner = User::factory()->create(['is_active' => true])->assignRole('student');
        [$lost, $found] = $this->pair($owner);

        // Claim filed the old way: no lost_item_id picked, never linked.
        $claim = Claim::create(['found_item_id' => $found->id, 'claimant_id' => $owner->id, 'status' => Claim::STATUS_PENDING]);
        $this->assertNull($claim->lost_item_id);

        $this->approveAndRelease($claim, $officer);

        $this->assertSame(FoundItem::STATUS_RELEASED, $found->fresh()->status);
        $this->assertSame(LostItem::STATUS_CLOSED, $lost->fresh()->status, 'lost report must close together with the found item');
        $this->assertSame($lost->id, $claim->fresh()->lost_item_id);
    }

    public function test_lost_report_moves_matched_then_claimed_then_closed_through_the_claim_lifecycle(): void
    {
        $officer = $this->makeUser('security_officer');
        $owner = $this->makeUser('student');
        [$lost, $found] = $this->pair($owner);
        $claims = app(ClaimService::class);

        $claim = $this->submit($owner, $found, $lost->id);
        $this->assertSame(LostItem::STATUS_MATCHED, $lost->fresh()->status);

        $claim = $claims->transition($claim, Claim::STATUS_UNDER_REVIEW, $officer);
        $claim = $claims->transition($claim, Claim::STATUS_APPROVED, $officer);
        $this->assertSame(LostItem::STATUS_CLAIMED, $lost->fresh()->status);

        app(ItemReleaseService::class)->generate($claim, $officer);
        $this->assertSame(LostItem::STATUS_CLAIMED, $lost->fresh()->status);

        app(ItemReleaseService::class)->manualRelease($claim->fresh(), $officer, 'Handed over.');
        $this->assertSame(LostItem::STATUS_CLOSED, $lost->fresh()->status);
    }

    public function test_rejected_claim_sends_the_lost_report_back_to_pending(): void
    {
        $officer = $this->makeUser('security_officer');
        $owner = $this->makeUser('student');
        [$lost, $found] = $this->pair($owner);
        $claims = app(ClaimService::class);

        $claim = $this->submit($owner, $found, $lost->id);
        $claim = $claims->transition($claim, Claim::STATUS_UNDER_REVIEW, $officer);
        $claims->transition($claim, Claim::STATUS_REJECTED, $officer, 'Could not verify ownership.');

        $this->assertSame(LostItem::STATUS_PENDING, $lost->fresh()->status);
    }

    public function test_cancelled_claim_keeps_a_live_lead_as_matched(): void
    {
        $owner = $this->makeUser('student');
        [$lost, $found] = $this->pair($owner);
        ItemMatch::create([
            'lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 80,
            'match_level' => 'high', 'score_breakdown' => [], 'status' => ItemMatch::STATUS_PENDING,
        ]);

        $claim = $this->submit($owner, $found, $lost->id);
        app(ClaimService::class)->transition($claim, Claim::STATUS_CANCELLED, $owner, 'Changed my mind.');

        $this->assertSame(LostItem::STATUS_MATCHED, $lost->fresh()->status);
    }

    public function test_only_the_claimants_own_lost_reports_are_linked(): void
    {
        $owner = $this->makeUser('student');
        $someoneElse = User::factory()->create(['is_active' => true])->assignRole('student');
        [, $found] = $this->pair($someoneElse);
        $foreign = LostItem::where('user_id', $someoneElse->id)->first();

        $claim = $this->submit($owner, $found, null);

        $this->assertNull($claim->lost_item_id);
        $this->assertSame(LostItem::STATUS_PENDING, $foreign->fresh()->status);
    }

    public function test_an_unrelated_lost_report_is_not_linked(): void
    {
        $owner = $this->makeUser('student');
        $found = FoundItem::factory()->create(['item_name' => 'Umbrella', 'category' => 'Umbrellas & Rain Gear', 'brand' => 'Totes', 'color' => 'Red']);
        $lost = LostItem::factory()->create([
            'user_id' => $owner->id, 'item_name' => 'Calculator', 'category' => 'School Supplies',
            'brand' => 'Casio', 'color' => 'Gray', 'location_lost' => 'Library', 'date_lost' => now()->subDays(60)->toDateString(),
            'description' => 'Scientific calculator', 'status' => LostItem::STATUS_PENDING,
        ]);

        $claim = $this->submit($owner, $found, null);

        $this->assertNull($claim->lost_item_id);
        $this->assertSame(LostItem::STATUS_PENDING, $lost->fresh()->status);
    }

    public function test_releasing_one_item_dismisses_other_leads_and_unsticks_the_other_lost_reports(): void
    {
        $officer = $this->makeUser('security_officer');
        $owner = $this->makeUser('student');
        $other = $this->makeUser('student');
        [$lost, $found] = $this->pair($owner);
        $otherLost = LostItem::factory()->create([
            'user_id' => $other->id, 'item_name' => 'Smartphone', 'category' => 'Phones & Gadgets',
            'brand' => 'Samsung', 'color' => 'Black', 'status' => LostItem::STATUS_MATCHED,
        ]);
        $lead = ItemMatch::create([
            'lost_item_id' => $otherLost->id, 'found_item_id' => $found->id, 'score' => 70,
            'match_level' => 'possible', 'score_breakdown' => [], 'status' => ItemMatch::STATUS_NOTIFIED,
        ]);

        $claim = $this->submit($owner, $found, $lost->id);
        $this->approveAndRelease($claim, $officer);

        $this->assertSame(LostItem::STATUS_CLOSED, $lost->fresh()->status);
        $this->assertSame(ItemMatch::STATUS_DISMISSED, $lead->fresh()->status);
        $this->assertSame(LostItem::STATUS_PENDING, $otherLost->fresh()->status, 'the other report no longer has anything to be matched to');
    }

    public function test_a_closed_lost_report_is_never_reopened(): void
    {
        $owner = $this->makeUser('student');
        [$lost, $found] = $this->pair($owner, ['status' => LostItem::STATUS_CLOSED]);
        $claim = Claim::create(['found_item_id' => $found->id, 'lost_item_id' => $lost->id, 'claimant_id' => $owner->id, 'status' => Claim::STATUS_REJECTED]);

        app(LostItemSyncService::class)->syncForClaim($claim);

        $this->assertSame(LostItem::STATUS_CLOSED, $lost->fresh()->status);
    }

    public function test_deleting_a_claim_recomputes_its_lost_report(): void
    {
        $owner = $this->makeUser('student');
        [$lost, $found] = $this->pair($owner);
        $claim = $this->submit($owner, $found, $lost->id);
        $this->assertSame(LostItem::STATUS_MATCHED, $lost->fresh()->status);

        app(ClaimService::class)->delete($claim);

        $this->assertSame(LostItem::STATUS_PENDING, $lost->fresh()->status);
    }

    public function test_resync_repairs_old_records_and_dry_run_changes_nothing(): void
    {
        $owner = $this->makeUser('student');
        [$lost, $found] = $this->pair($owner);
        $found->update(['status' => FoundItem::STATUS_RELEASED]);
        // Exactly the broken state from the report: released claim, never linked, lost still pending.
        Claim::create(['found_item_id' => $found->id, 'claimant_id' => $owner->id, 'status' => Claim::STATUS_RELEASED]);

        $dry = app(LostItemSyncService::class)->resyncAll(dryRun: true);
        $this->assertCount(1, $dry);
        $this->assertSame(LostItem::STATUS_PENDING, $lost->fresh()->status, 'dry run must not save');

        $changes = app(LostItemSyncService::class)->resyncAll();
        $this->assertCount(1, $changes);
        $this->assertSame(LostItem::STATUS_CLOSED, $lost->fresh()->status);

        $this->assertSame([], app(LostItemSyncService::class)->resyncAll(), 'running it again changes nothing');
    }

    public function test_artisan_command_runs(): void
    {
        $this->artisan('lostfound:resync-statuses --dry-run')->assertExitCode(0);
    }
}
