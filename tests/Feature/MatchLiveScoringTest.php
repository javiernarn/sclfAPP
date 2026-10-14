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
 * Real-time scoring: the live preview on the report forms, the handlers'
 * side-by-side comparison, and what the report owner is (not) allowed to see.
 */
class MatchLiveScoringTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    protected function phoneFound(array $over = []): FoundItem
    {
        return FoundItem::factory()->create($over + [
            'item_name' => 'Smartphone', 'category' => 'Phones & Gadgets', 'brand' => 'Samsung', 'model' => 'Galaxy A15',
            'color' => 'Black', 'description' => 'Black Samsung phone', 'unique_characteristics' => 'Cracked screen, ring holder',
            'location_found' => 'Library', 'date_found' => now()->toDateString(),
        ]);
    }

    public function test_the_live_preview_scores_a_draft_lost_report_against_stored_found_items(): void
    {
        $student = $this->makeUser('student');
        $found = $this->phoneFound();

        $response = $this->actingAs($student)->postJson('/api/matches/preview', [
            'kind' => 'lost', 'item_name' => 'Smartphone (Android)', 'category' => 'Phones & Gadgets',
            'brand' => 'Samsung', 'model' => 'A15', 'color' => 'Black', 'location_lost' => 'Library',
            'date_lost' => now()->toDateString(),
        ])->assertOk();

        $this->assertTrue($response->json('ready'));
        $this->assertSame($found->id, $response->json('candidates.0.id'));
        $this->assertGreaterThanOrEqual(ItemMatchingService::THRESHOLD_HIGH, $response->json('best'));
        // The preview never echoes the found item's private marks back to the person typing.
        $this->assertStringNotContainsString('ring holder', json_encode($response->json()));
        $this->assertNotContains('unique_characteristics', array_keys($response->json('candidates.0')));
    }

    public function test_an_empty_draft_does_not_scan_anything(): void
    {
        $student = $this->makeUser('student');
        $this->phoneFound();

        $this->actingAs($student)->postJson('/api/matches/preview', ['kind' => 'lost'])
            ->assertOk()->assertJson(['ready' => false, 'count' => 0]);
    }

    public function test_only_people_who_can_file_the_report_can_preview_it(): void
    {
        // Security officers can file FOUND reports but not LOST ones.
        $officer = $this->makeUser('security_officer');

        $this->actingAs($officer)->postJson('/api/matches/preview', ['kind' => 'lost', 'item_name' => 'Phone'])->assertForbidden();
        $this->actingAs($officer)->postJson('/api/matches/preview', ['kind' => 'found', 'item_name' => 'Phone'])->assertOk();
    }

    public function test_handlers_open_a_match_and_get_a_live_full_comparison(): void
    {
        $owner = $this->makeUser('student');
        $lost = LostItem::factory()->create([
            'user_id' => $owner->id, 'item_name' => 'Smartphone', 'category' => 'Phones & Gadgets', 'brand' => 'Samsung',
            'model' => 'A15', 'color' => 'Black', 'unique_characteristics' => 'Cracked screen', 'location_lost' => 'Library',
            'date_lost' => now()->toDateString(),
        ]);
        $found = $this->phoneFound();
        $match = ItemMatch::create([
            'lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 10, 'match_level' => 'low',
            'score_breakdown' => [], 'status' => ItemMatch::STATUS_PENDING,
        ]);

        $response = $this->actingAs($this->makeUser('security_officer'))->getJson("/api/matches/{$match->id}")->assertOk();

        $this->assertTrue($response->json('rescored'));
        $this->assertSame(10, $response->json('previous_score'));
        $this->assertGreaterThan(10, $response->json('match.score'));
        $this->assertSame('Brand', collect($response->json('analysis.fields'))->firstWhere('key', 'brand')['label']);
        $this->assertNotNull($match->fresh()->scored_at);
        $this->assertNotEmpty($match->fresh()->score_details['fields']);
    }

    public function test_students_cannot_open_the_handlers_comparison(): void
    {
        $student = $this->makeUser('student');
        $lost = LostItem::factory()->create(['user_id' => $student->id]);
        $found = FoundItem::factory()->create();
        $match = ItemMatch::create([
            'lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 80, 'match_level' => 'high',
            'score_breakdown' => [], 'status' => ItemMatch::STATUS_PENDING,
        ]);

        $this->actingAs($student)->getJson("/api/matches/{$match->id}")->assertForbidden();
    }

    public function test_the_owner_sees_which_fields_lined_up_but_never_the_found_items_values(): void
    {
        $owner = $this->makeUser('student');
        $lost = LostItem::factory()->create(['user_id' => $owner->id, 'item_name' => 'Smartphone']);
        $found = $this->phoneFound();
        ItemMatch::create([
            'lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 88, 'match_level' => 'high',
            'score_breakdown' => ['brand' => 13],
            'score_details' => [
                'version' => 2, 'confidence' => 0.9, 'summary' => 'Agrees on brand.',
                'fields' => [['key' => 'unique_characteristics', 'label' => 'Unique marks', 'status' => 'match', 'points' => 10, 'weight' => 10,
                    'lost' => 'cracked screen', 'found' => 'Cracked screen, ring holder', 'note' => '1 of 1 marks line up: ring holder']],
                'flags' => [['type' => 'conflict', 'field' => 'brand', 'message' => 'Brands differ (Samsung vs Apple).']],
            ],
            'status' => ItemMatch::STATUS_PENDING,
        ]);

        $response = $this->actingAs($owner)->getJson("/api/lost-items/{$lost->id}/matches")->assertOk();

        $this->assertSame('match', $response->json('0.public_details.fields.0.status'));
        $this->assertArrayNotHasKey('score_details', $response->json('0'));
        $this->assertStringNotContainsString('ring holder', json_encode($response->json()));
        $this->assertStringNotContainsString('Apple', json_encode($response->json()));
    }

    public function test_editing_a_report_makes_its_matches_rescore_themselves_on_the_next_load(): void
    {
        $officer = $this->makeUser('security_officer');
        $lost = LostItem::factory()->create([
            'item_name' => 'Smartphone', 'category' => 'Phones & Gadgets', 'brand' => 'Samsung', 'color' => 'Black', 'model' => 'A15',
        ]);
        $found = $this->phoneFound();

        $match = app(ItemMatchingService::class)->runForLostItem($lost)[0];
        $before = $match->fresh()->score;

        // The finder corrects the model they typed — the stored score is now stale.
        $found->update(['model' => 'Galaxy S24']);
        $match->forceFill(['scored_at' => now()->subMinute()])->save();
        $found->forceFill(['updated_at' => now()])->saveQuietly();

        $this->actingAs($officer)->getJson('/api/matches')->assertOk();

        $this->assertLessThan($before, $match->fresh()->score);
    }

    public function test_the_pulse_stamp_changes_only_when_something_changes(): void
    {
        $officer = $this->makeUser('security_officer');
        $lost = LostItem::factory()->create(['item_name' => 'Smartphone']);
        $found = $this->phoneFound();

        $first = $this->actingAs($officer)->getJson('/api/matches/pulse')->assertOk()->json('v');
        $again = $this->actingAs($officer)->getJson('/api/matches/pulse')->assertOk()->json('v');
        $this->assertSame($first, $again, 'nothing changed, so the stamp must not move');

        // A new match appears…
        ItemMatch::create([
            'lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 80, 'match_level' => 'high',
            'score_breakdown' => [], 'status' => ItemMatch::STATUS_PENDING,
        ]);
        $second = $this->actingAs($officer)->getJson('/api/matches/pulse')->json('v');
        $this->assertNotSame($first, $second);

        // …and so does editing a report (the match needs re-scoring).
        $this->travel(2)->seconds();
        $found->update(['color' => 'White']);
        $third = $this->actingAs($officer)->getJson('/api/matches/pulse')->json('v');
        $this->assertNotSame($second, $third);
    }

    public function test_students_cannot_poll_the_handlers_pulse(): void
    {
        $this->actingAs($this->makeUser('student'))->getJson('/api/matches/pulse')->assertForbidden();
    }
}
