<?php

namespace Tests\Feature;

use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** A lead whose item is already claimed / released must be flagged and can't be sent to the owner. */
class MatchUnavailableLeadTest extends TestCase
{
    use RefreshDatabase;

    private function officer(): User
    {
        $this->seed(RoleSeeder::class);

        return tap(User::factory()->create(['is_active' => true]), fn ($u) => $u->assignRole('security_officer'));
    }

    private function lead(string $foundStatus): ItemMatch
    {
        $owner = User::factory()->create(['is_active' => true]);
        $lost = LostItem::factory()->create(['user_id' => $owner->id, 'item_name' => 'Wallet', 'category' => 'Wallets, Money & Cards']);
        $found = FoundItem::factory()->create(['item_name' => 'Wallet', 'category' => 'Wallets, Money & Cards', 'status' => $foundStatus]);

        return ItemMatch::create(['lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 80, 'match_level' => 'high', 'status' => ItemMatch::STATUS_PENDING]);
    }

    public function test_the_comparison_explains_why_a_lead_is_unavailable(): void
    {
        $officer = $this->officer();
        $claimed = $this->lead(FoundItem::STATUS_CLAIMED);
        $stored = $this->lead(FoundItem::STATUS_STORED);

        $this->actingAs($officer)->getJson("/api/matches/{$claimed->id}")->assertOk()
            ->assertJsonPath('unavailable', 'This found item already has an approved claim and is waiting for release.');
        $this->actingAs($officer)->getJson("/api/matches/{$stored->id}")->assertOk()->assertJsonPath('unavailable', null);
    }

    public function test_the_owner_cannot_be_notified_about_an_item_that_is_already_claimed_or_released(): void
    {
        $officer = $this->officer();

        foreach ([FoundItem::STATUS_CLAIMED, FoundItem::STATUS_RELEASED] as $status) {
            $m = $this->lead($status);
            $this->actingAs($officer)->postJson("/api/matches/{$m->id}/notify-owner")->assertStatus(422);
            $this->assertSame(ItemMatch::STATUS_PENDING, $m->fresh()->status);
        }

        $ok = $this->lead(FoundItem::STATUS_STORED);
        $this->actingAs($officer)->postJson("/api/matches/{$ok->id}/notify-owner")->assertOk();
    }
}
