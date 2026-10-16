<?php

namespace Tests\Feature;

use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Models\User;
use App\Services\Matching\ItemMatchingService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Two reported problems:
 *
 *  1. Matches kept showing for items that were already claimed / released / closed.
 *  2. A match's score flipped (100 → back to an older number) depending on which
 *     screen re-scored it, because some screens re-scored with half-loaded reports.
 */
class MatchStaleAndScoreConsistencyTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);

        return tap(User::factory()->create(['is_active' => true]), fn ($u) => $u->assignRole($role));
    }

    /** A lost + found pair that agree on every field (so the live score is 100). */
    protected function identicalPair(array $lostOver = [], array $foundOver = [], ?User $owner = null): array
    {
        $owner ??= $this->makeUser('student');
        $shared = [
            'item_name' => 'Smartphone', 'category' => 'Phones & Gadgets', 'brand' => 'Samsung', 'model' => 'Galaxy A15',
            'color' => 'Black', 'description' => 'Black Samsung phone with a cracked screen',
            'unique_characteristics' => 'Cracked screen, ring holder',
            'details' => ['storage' => '128GB'],
        ];
        $lost = LostItem::factory()->create($lostOver + $shared + [
            'user_id' => $owner->id, 'location_lost' => 'Library', 'date_lost' => now()->toDateString(),
        ]);
        $found = FoundItem::factory()->create($foundOver + $shared + [
            'location_found' => 'Library', 'date_found' => now()->toDateString(),
        ]);

        $match = ItemMatch::create([
            'lost_item_id' => $lost->id, 'found_item_id' => $found->id,
            'score' => 70, 'match_level' => 'possible', 'status' => ItemMatch::STATUS_PENDING,
        ]);

        return [$lost, $found, $match, $owner];
    }

    // ---- problem 1: matches for items that are already gone ----------------------------

    public function test_open_queue_hides_matches_whose_found_item_was_already_claimed_or_released(): void
    {
        $officer = $this->makeUser('security_officer');
        [, , $live] = $this->identicalPair();
        [, , $claimed] = $this->identicalPair([], ['status' => FoundItem::STATUS_CLAIMED]);
        [, , $pendingRelease] = $this->identicalPair([], ['status' => FoundItem::STATUS_RELEASE_PENDING]);
        [, , $released] = $this->identicalPair([], ['status' => FoundItem::STATUS_RELEASED]);
        [, , $disposed] = $this->identicalPair([], ['status' => FoundItem::STATUS_DISPOSED]);

        $ids = collect($this->actingAs($officer)->getJson('/api/matches')->assertOk()->json('data'))->pluck('id')->all();

        $this->assertSame([$live->id], $ids);
        foreach ([$claimed, $pendingRelease, $released, $disposed] as $gone) {
            $this->assertNotContains($gone->id, $ids);
        }
    }

    public function test_open_queue_hides_matches_whose_lost_report_is_already_claimed_or_closed(): void
    {
        $officer = $this->makeUser('security_officer');
        [, , $live] = $this->identicalPair();
        [, , $claimedLost] = $this->identicalPair(['status' => LostItem::STATUS_CLAIMED]);
        [, , $closedLost] = $this->identicalPair(['status' => LostItem::STATUS_CLOSED]);

        $ids = collect($this->actingAs($officer)->getJson('/api/matches')->json('data'))->pluck('id')->all();

        $this->assertSame([$live->id], $ids);
        $this->assertNotContains($claimedLost->id, $ids);
        $this->assertNotContains($closedLost->id, $ids);
    }

    public function test_the_claimed_tab_still_lists_finished_matches(): void
    {
        $officer = $this->makeUser('security_officer');
        [, , $match] = $this->identicalPair([], ['status' => FoundItem::STATUS_RELEASED]);
        $match->update(['status' => ItemMatch::STATUS_CLAIMED]);

        $ids = collect($this->actingAs($officer)->getJson('/api/matches?status=claimed')->json('data'))->pluck('id')->all();

        $this->assertSame([$match->id], $ids);
    }

    public function test_owner_and_staff_candidate_lists_hide_matches_to_items_that_are_gone(): void
    {
        [$lost, $found, $stale, $owner] = $this->identicalPair([], ['status' => FoundItem::STATUS_RELEASED]);
        $liveFound = FoundItem::factory()->create(['item_name' => 'Smartphone', 'category' => 'Phones & Gadgets']);
        $live = ItemMatch::create([
            'lost_item_id' => $lost->id, 'found_item_id' => $liveFound->id,
            'score' => 61, 'match_level' => 'possible', 'status' => ItemMatch::STATUS_PENDING,
        ]);

        $ids = collect($this->actingAs($owner)->getJson("/api/lost-items/{$lost->id}/matches")->assertOk()->json())->pluck('id')->all();
        $this->assertSame([$live->id], $ids);

        // And from the found item's side: a found item that is gone has no leads left.
        $staff = $this->makeUser('staff');
        $this->actingAs($staff)->getJson("/api/found-items/{$found->id}/matches")->assertOk()->assertJson([]);
    }

    public function test_releasing_an_item_retires_every_other_open_lead_for_it(): void
    {
        [, $found, $winner] = $this->identicalPair();
        [$otherLost, , $other] = $this->identicalPair();
        // Same found item, a second candidate owner.
        $other->update(['found_item_id' => $found->id]);

        $found->update(['status' => FoundItem::STATUS_RELEASED]);
        $winner->update(['status' => ItemMatch::STATUS_CLAIMED]);

        $this->artisan('matches:rescore')->assertSuccessful();

        $this->assertSame(ItemMatch::STATUS_DISMISSED, $other->fresh()->status);
        $this->assertSame(ItemMatch::STATUS_CLAIMED, $winner->fresh()->status);
        $this->assertSame(LostItem::STATUS_PENDING, $otherLost->fresh()->status);
    }

    // ---- problem 2: the score that blinks 100 and jumps back ---------------------------

    public function test_every_screen_agrees_on_the_score_even_after_a_report_is_edited(): void
    {
        $officer = $this->makeUser('security_officer');
        [$lost, $found, $match, $owner] = $this->identicalPair();

        // 1. The handler opens the comparison: live score is 100.
        $detail = $this->actingAs($officer)->getJson("/api/matches/{$match->id}")->assertOk();
        $this->assertSame(100, $detail->json('analysis.score'));

        // 2. A report is touched (e.g. a status sync) so it is newer than the stored score.
        $this->travel(5)->seconds();
        $lost->touch();
        $found->touch();

        // 3. The OWNER's candidate list and the STAFF found-item list re-score it; both must still say 100.
        $ownerRow = $this->actingAs($owner)->getJson("/api/lost-items/{$lost->id}/matches")->assertOk()->json('0');
        $this->assertSame(100, $ownerRow['score'], 'owner view re-scored with half-loaded reports');

        $this->travel(5)->seconds();
        $lost->touch();
        $foundRow = $this->actingAs($officer)->getJson("/api/found-items/{$found->id}/matches")->assertOk()->json('0');
        $this->assertSame(100, $foundRow['score'], 'found-item view re-scored with half-loaded reports');

        // 4. The handlers' queue and a fresh comparison agree with them.
        $this->assertSame(100, $this->actingAs($officer)->getJson('/api/matches')->json('data.0.score'));
        $this->assertSame(100, $this->actingAs($officer)->getJson("/api/matches/{$match->id}")->json('analysis.score'));
        $this->assertSame(100, $match->fresh()->score);
    }

    public function test_opening_a_comparison_twice_does_not_keep_moving_the_pulse_stamp(): void
    {
        $officer = $this->makeUser('security_officer');
        [, , $match] = $this->identicalPair();

        $this->actingAs($officer)->getJson("/api/matches/{$match->id}")->assertOk();
        $before = $this->actingAs($officer)->getJson('/api/matches/pulse')->json('v');

        // The page re-opens the open comparison on every pulse change; an unchanged score must not look like a change.
        $this->travel(3)->seconds();
        $this->actingAs($officer)->getJson("/api/matches/{$match->id}")->assertOk();
        $after = $this->actingAs($officer)->getJson('/api/matches/pulse')->json('v');

        $this->assertSame($before, $after);
    }

    public function test_rescoring_always_uses_the_full_reports_not_a_partial_copy(): void
    {
        [$lost, $found, $match] = $this->identicalPair();
        $matcher = app(ItemMatchingService::class);

        // A copy of the match carrying only the handful of columns some screens select.
        $partial = ItemMatch::with([
            'lostItem:id,user_id,item_name,category,updated_at',
            'foundItem:id,item_name,category,updated_at',
        ])->find($match->id);
        $partial->update(['scored_at' => now()->subMinute()]);
        $partial->refresh()->load([
            'lostItem:id,user_id,item_name,category,updated_at',
            'foundItem:id,item_name,category,updated_at',
        ]);

        $matcher->refresh($partial);

        $this->assertSame(100, $match->fresh()->score);
    }
}
