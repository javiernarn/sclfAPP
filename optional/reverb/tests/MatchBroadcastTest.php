<?php

namespace Tests\Feature;

use App\Events\MatchUpdated;
use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Models\User;
use App\Services\Matching\ItemMatchingService;
use Database\Seeders\RoleSeeder;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Websocket pushes: a match change announces itself on private channels,
 * carries nothing private, and a broadcast failure never blocks saving.
 */
class MatchBroadcastTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    protected function pair(): array
    {
        $owner = $this->makeUser('student');
        $lost = LostItem::factory()->create([
            'user_id' => $owner->id, 'item_name' => 'Smartphone', 'category' => 'Phones & Gadgets', 'brand' => 'Samsung', 'color' => 'Black',
        ]);
        $found = FoundItem::factory()->create([
            'item_name' => 'Smartphone', 'category' => 'Phones & Gadgets', 'brand' => 'Samsung', 'color' => 'Black', 'unique_characteristics' => 'secret sticker',
        ]);

        return [$lost, $found, $owner];
    }

    public function test_a_new_match_is_announced(): void
    {
        Event::fake([MatchUpdated::class]);
        [$lost] = $this->pair();

        app(ItemMatchingService::class)->runForLostItem($lost);

        Event::assertDispatched(MatchUpdated::class, fn ($e) => $e->reason === 'created' && $e->lostItemId === $lost->id);
    }

    public function test_rescoring_only_announces_when_the_score_actually_moves(): void
    {
        [$lost, $found] = $this->pair();
        $match = app(ItemMatchingService::class)->runForLostItem($lost)[0];

        Event::fake([MatchUpdated::class]);
        app(ItemMatchingService::class)->refresh($match->fresh());
        Event::assertNotDispatched(MatchUpdated::class);

        $found->update(['brand' => 'Apple', 'item_name' => 'iPhone']);
        app(ItemMatchingService::class)->refresh($match->fresh());
        Event::assertDispatched(MatchUpdated::class, fn ($e) => $e->reason === 'rescored');
    }

    public function test_notifying_and_dismissing_announce_a_status_change(): void
    {
        [$lost, $found] = $this->pair();
        $match = ItemMatch::create([
            'lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 80, 'match_level' => 'high',
            'score_breakdown' => [], 'status' => ItemMatch::STATUS_PENDING,
        ]);
        Event::fake([MatchUpdated::class]);

        $this->actingAs($this->makeUser('security_officer'))->postJson("/api/matches/{$match->id}/notify-owner")->assertOk();
        Event::assertDispatched(MatchUpdated::class, fn ($e) => $e->reason === 'status' && $e->status === ItemMatch::STATUS_NOTIFIED);

        $this->actingAs($this->makeUser('security_officer'))->postJson("/api/matches/{$match->id}/dismiss")->assertOk();
        Event::assertDispatched(MatchUpdated::class, fn ($e) => $e->status === ItemMatch::STATUS_DISMISSED);
    }

    public function test_the_event_goes_to_private_channels_and_carries_nothing_private(): void
    {
        [$lost, $found] = $this->pair();
        $match = ItemMatch::create([
            'lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 91, 'match_level' => 'very_high',
            'score_breakdown' => [], 'status' => ItemMatch::STATUS_PENDING,
        ]);

        $event = MatchUpdated::for($match, 'created');

        $this->assertSame('match.updated', $event->broadcastAs());
        $names = collect($event->broadcastOn())->each(fn ($c) => $this->assertInstanceOf(PrivateChannel::class, $c))->map(fn ($c) => $c->name)->all();
        $this->assertSame(['private-lost-found.handlers', "private-lost-items.{$lost->id}"], $names);
        $this->assertSame(
            ['match_id', 'lost_item_id', 'found_item_id', 'score', 'level', 'status', 'reason'],
            array_keys($event->broadcastWith())
        );
        $this->assertStringNotContainsString('secret sticker', json_encode($event->broadcastWith()));
    }

    public function test_a_broadcast_failure_never_stops_a_match_from_saving(): void
    {
        [$lost] = $this->pair();
        Event::listen(MatchUpdated::class, fn () => throw new \RuntimeException('Reverb is down'));

        $matches = app(ItemMatchingService::class)->runForLostItem($lost);

        $this->assertCount(1, $matches);
        $this->assertDatabaseHas('item_matches', ['lost_item_id' => $lost->id]);
    }
}
