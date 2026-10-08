<?php

namespace Tests\Feature;

use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Models\User;
use App\Notifications\SclfNotification;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * The handlers' match queue: security / admin / staff can list the
 * pairings the matcher recorded, tell the owner, or rule one out.
 */
class MatchQueueTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    protected function makeMatch(array $matchAttrs = [], array $foundAttrs = [], ?User $owner = null): ItemMatch
    {
        $owner ??= $this->makeUser('student');
        $lost = LostItem::factory()->create(['user_id' => $owner->id, 'item_name' => 'Black Wallet']);
        $found = FoundItem::factory()->create($foundAttrs + ['item_name' => 'Wallet (black)']);

        return ItemMatch::create($matchAttrs + [
            'lost_item_id' => $lost->id,
            'found_item_id' => $found->id,
            'score' => 82,
            'match_level' => 'high',
            'score_breakdown' => ['category' => 20, 'brand' => 0],
            'status' => ItemMatch::STATUS_PENDING,
        ]);
    }

    public function test_students_cannot_open_the_match_queue(): void
    {
        $student = $this->makeUser('student');

        $this->actingAs($student)->getJson('/api/matches')->assertForbidden();
    }

    public function test_security_admin_and_staff_can_list_open_matches_best_first(): void
    {
        $low = $this->makeMatch(['score' => 55, 'match_level' => 'low']);
        $high = $this->makeMatch(['score' => 91, 'match_level' => 'very_high']);

        foreach (['security_officer', 'admin', 'staff'] as $role) {
            $response = $this->actingAs($this->makeUser($role))->getJson('/api/matches')->assertOk();

            $ids = collect($response->json('data'))->pluck('id')->all();
            $this->assertSame([$high->id, $low->id], $ids, "{$role} should see both, best score first");
            $this->assertNotNull($response->json('data.0.lost_item.user.name'));
        }
    }

    public function test_counter_check_ins_never_appear_in_the_queue(): void
    {
        $this->makeMatch([], ['intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE]);
        $real = $this->makeMatch([], ['intake_channel' => FoundItem::CHANNEL_ONLINE_REPORT]);

        $response = $this->actingAs($this->makeUser('security_officer'))->getJson('/api/matches')->assertOk();

        $this->assertSame([$real->id], collect($response->json('data'))->pluck('id')->all());
    }

    public function test_status_filter_separates_pending_notified_and_dismissed(): void
    {
        $pending = $this->makeMatch(['status' => ItemMatch::STATUS_PENDING]);
        $notified = $this->makeMatch(['status' => ItemMatch::STATUS_NOTIFIED]);
        $dismissed = $this->makeMatch(['status' => ItemMatch::STATUS_DISMISSED]);
        $officer = $this->makeUser('security_officer');

        $ids = fn (string $status) => collect(
            $this->actingAs($officer)->getJson("/api/matches?status={$status}")->assertOk()->json('data')
        )->pluck('id')->all();

        $this->assertSame([$pending->id], $ids('pending'));
        $this->assertSame([$notified->id], $ids('notified'));
        $this->assertSame([$dismissed->id], $ids('dismissed'));
        $this->assertEqualsCanonicalizing([$pending->id, $notified->id], $ids('open'));
    }

    public function test_notify_owner_tells_the_lost_item_owner_and_marks_the_match(): void
    {
        Notification::fake();

        $owner = $this->makeUser('student');
        $match = $this->makeMatch([], [], $owner);
        $officer = $this->makeUser('security_officer');

        $this->actingAs($officer)->postJson("/api/matches/{$match->id}/notify-owner")
            ->assertOk()
            ->assertJsonPath('data.status', ItemMatch::STATUS_NOTIFIED);

        Notification::assertSentTo($owner, SclfNotification::class, function ($n) use ($owner, $match) {
            $data = $n->toArray($owner);

            return $data['type'] === SclfNotification::TYPE_POTENTIAL_MATCH
                && $data['related_id'] === $match->lost_item_id;
        });
        $this->assertSame(ItemMatch::STATUS_NOTIFIED, $match->fresh()->status);
    }

    public function test_a_dismissed_match_cannot_be_sent_to_the_owner(): void
    {
        Notification::fake();

        $match = $this->makeMatch(['status' => ItemMatch::STATUS_DISMISSED]);

        $this->actingAs($this->makeUser('security_officer'))
            ->postJson("/api/matches/{$match->id}/notify-owner")
            ->assertStatus(422);

        Notification::assertNothingSent();
    }

    public function test_students_cannot_notify_owners(): void
    {
        $match = $this->makeMatch();

        $this->actingAs($this->makeUser('student'))
            ->postJson("/api/matches/{$match->id}/notify-owner")
            ->assertForbidden();
    }

    public function test_a_handler_can_dismiss_a_match_and_so_can_the_owner_but_not_another_student(): void
    {
        $owner = $this->makeUser('student');
        $byHandler = $this->makeMatch([], [], $owner);
        $byOwner = $this->makeMatch([], [], $owner);
        $stranger = $this->makeUser('student');

        $this->actingAs($stranger)->postJson("/api/matches/{$byOwner->id}/dismiss")->assertForbidden();

        $this->actingAs($this->makeUser('security_officer'))
            ->postJson("/api/matches/{$byHandler->id}/dismiss")->assertOk();
        $this->actingAs($owner)->postJson("/api/matches/{$byOwner->id}/dismiss")->assertOk();

        $this->assertSame(ItemMatch::STATUS_DISMISSED, $byHandler->fresh()->status);
        $this->assertSame(ItemMatch::STATUS_DISMISSED, $byOwner->fresh()->status);
    }
}
