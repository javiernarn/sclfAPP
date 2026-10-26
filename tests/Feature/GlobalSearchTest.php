<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\FoundItem;
use App\Models\User;
use App\Services\Incidents\IncidentService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 5: /api/search — each category re-applies the same visibility
 * rule its own controller enforces (see SearchService). These tests
 * don't re-prove every controller's scoping rule from scratch; they
 * confirm the search endpoint doesn't leak anything a given user
 * couldn't already reach through that section's own list page.
 */
class GlobalSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function campus(string $code = 'MAIN'): Campus
    {
        return Campus::firstOrCreate(['code' => $code], ['name' => "Campus {$code}"]);
    }

    protected function user(string $role, ?Campus $campus = null): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $user */
        $user = User::factory()->create(['is_active' => true, 'campus_id' => $campus?->id]);
        $user->assignRole($role);

        return $user;
    }

    protected function authHeaders(User $user): array
    {
        $token = $user->createToken('test', ['*'])->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    /**
     * Sanctum's guard remembers the first user it resolved for the rest of
     * the test, so a second request "as someone else" would silently still
     * run as the first. Drop the cached guard before switching.
     */
    protected function actingAsToken(User $user): array
    {
        $this->app['auth']->forgetGuards();

        return $this->authHeaders($user);
    }

    public function test_query_under_two_characters_returns_empty_without_erroring(): void
    {
        $student = $this->user('student');

        $response = $this->withHeaders($this->authHeaders($student))->getJson('/api/search?q=a');

        $response->assertStatus(200)->assertJson(['data' => []]);
    }

    public function test_found_items_are_searchable_by_any_authenticated_user(): void
    {
        $student = $this->user('student');

        FoundItem::create([
            'item_name' => 'Blue Hydro Flask water bottle',
            'description' => 'Found near the gym entrance.',
            'category' => 'other',
            'status' => 'stored',
            'user_id' => $student->id,
        ]);

        $response = $this->withHeaders($this->authHeaders($student))->getJson('/api/search?q=hydro flask');

        $response->assertStatus(200);
        $titles = collect($response->json('data.found_items'))->pluck('title');
        $this->assertTrue($titles->contains('Blue Hydro Flask water bottle'));
    }

    public function test_a_student_only_finds_their_own_incident_reports_in_search(): void
    {
        $campus = $this->campus();
        $student = $this->user('student', $campus);
        $otherStudent = $this->user('student', $campus);

        app(IncidentService::class)->report($student, [
            'category' => 'theft', 'severity' => 'medium',
            'title' => 'Stolen skateboard near library', 'description' => 'Taken from the bike rack.',
            'occurred_at' => now()->subHour()->toDateTimeString(),
        ]);
        app(IncidentService::class)->report($otherStudent, [
            'category' => 'theft', 'severity' => 'medium',
            'title' => 'Stolen skateboard near cafeteria', 'description' => 'Taken while unattended.',
            'occurred_at' => now()->subHour()->toDateTimeString(),
        ]);

        $response = $this->withHeaders($this->authHeaders($student))->getJson('/api/search?q=skateboard');

        $response->assertStatus(200);
        $titles = collect($response->json('data.security_incidents'))->pluck('title');
        $this->assertTrue($titles->contains('Stolen skateboard near library'));
        $this->assertFalse($titles->contains('Stolen skateboard near cafeteria'));
    }

    public function test_visitors_category_is_absent_for_non_staff(): void
    {
        $student = $this->user('student');

        $response = $this->withHeaders($this->authHeaders($student))->getJson('/api/search?q=laptop');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertArrayNotHasKey('visitors', $data);
    }

    public function test_suggestions_without_a_query_lead_with_the_students_own_lost_report(): void
    {
        $student = $this->user('student');

        \App\Models\LostItem::create([
            'user_id' => $student->id,
            'item_name' => 'Silver scientific calculator',
            'description' => 'Left in the library.',
            'category' => 'electronics',
            'status' => 'pending',
        ]);

        $response = $this->withHeaders($this->authHeaders($student))->getJson('/api/search/suggestions');

        $response->assertStatus(200);
        $first = $response->json('data.0');
        $this->assertSame('Silver scientific calculator', $first['query']);
        $this->assertSame('Your lost report', $first['hint']);
    }

    public function test_suggestions_never_offer_counter_intake_items_to_non_staff(): void
    {
        $student = $this->user('student');
        $officer = $this->user('security_officer');

        FoundItem::create([
            'item_name' => 'Counter-only wallet',
            'description' => 'Handed in at the counter.',
            'category' => 'other',
            'status' => 'stored',
            'user_id' => $officer->id,
            'intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE,
        ]);

        $asStudent = $this->withHeaders($this->authHeaders($student))->getJson('/api/search/suggestions?q=wallet');
        $this->assertSame([], $asStudent->json('data'));

        $asOfficer = $this->withHeaders($this->actingAsToken($officer))->getJson('/api/search/suggestions?q=wallet');
        $this->assertSame('Counter-only wallet', $asOfficer->json('data.0.query'));
    }

    public function test_typeahead_ranks_prefix_matches_before_mid_word_matches(): void
    {
        $student = $this->user('student');

        foreach (['Noble fountain pen', 'Blue notebook'] as $name) {
            FoundItem::create([
                'item_name' => $name,
                'description' => 'Test item.',
                'category' => 'other',
                'status' => 'stored',
                'user_id' => $student->id,
            ]);
        }

        $response = $this->withHeaders($this->authHeaders($student))->getJson('/api/search/suggestions?q=bl');

        $labels = collect($response->json('data'))->pluck('label')->all();
        $this->assertSame('Blue notebook', $labels[0]);
        $this->assertContains('Noble fountain pen', $labels);
    }

    public function test_people_suggestions_are_staff_only(): void
    {
        $student = $this->user('student');
        $officer = $this->user('security_officer');
        $target = User::factory()->create(['is_active' => true, 'name' => 'Zephyrine Quill']);

        $asStudent = $this->withHeaders($this->authHeaders($student))->getJson('/api/search/suggestions?q=zephyrine');
        $this->assertSame([], $asStudent->json('data'));

        $asOfficer = $this->withHeaders($this->actingAsToken($officer))->getJson('/api/search/suggestions?q=zephyrine');
        $this->assertSame('Zephyrine Quill', $asOfficer->json('data.0.query'));
    }

    public function test_recent_searches_are_saved_per_account_and_never_shared(): void
    {
        $alice = $this->user('student');
        $bob = $this->user('instructor');

        $this->withHeaders($this->authHeaders($alice))->postJson('/api/search/recent', ['term' => 'blue umbrella'])->assertStatus(200);
        $this->withHeaders($this->authHeaders($alice))->postJson('/api/search/recent', ['term' => 'blue umbrella'])->assertStatus(200);

        $this->assertDatabaseCount('recent_searches', 1); // same term = bumped, not duplicated

        $asAlice = $this->withHeaders($this->authHeaders($alice))->getJson('/api/search/recent');
        $this->assertSame(['blue umbrella'], collect($asAlice->json('data'))->pluck('term')->all());

        $asBob = $this->withHeaders($this->actingAsToken($bob))->getJson('/api/search/recent');
        $this->assertSame([], $asBob->json('data'));
    }

    public function test_a_person_can_delete_one_or_clear_all_but_only_their_own(): void
    {
        $alice = $this->user('student');
        $bob = $this->user('instructor');

        foreach (['wallet', 'umbrella'] as $term) {
            \App\Models\RecentSearch::create(['user_id' => $alice->id, 'term' => $term, 'last_searched_at' => now()]);
        }
        $bobRow = \App\Models\RecentSearch::create(['user_id' => $bob->id, 'term' => 'bob only', 'last_searched_at' => now()]);

        // Alice can't delete Bob's row...
        $this->withHeaders($this->authHeaders($alice))->deleteJson("/api/search/recent/{$bobRow->id}")->assertStatus(200);
        $this->assertDatabaseHas('recent_searches', ['id' => $bobRow->id]);

        // ...can delete her own single entry...
        $walletId = \App\Models\RecentSearch::where('user_id', $alice->id)->where('term', 'wallet')->value('id');
        $this->withHeaders($this->authHeaders($alice))->deleteJson("/api/search/recent/{$walletId}")->assertStatus(200);
        $this->assertDatabaseMissing('recent_searches', ['id' => $walletId]);

        // ...and clear all of hers without touching Bob's.
        $this->withHeaders($this->authHeaders($alice))->deleteJson('/api/search/recent')->assertStatus(200);
        $this->assertDatabaseCount('recent_searches', 1);
        $this->assertDatabaseHas('recent_searches', ['id' => $bobRow->id]);
    }

    public function test_recent_searches_keep_only_the_newest_twenty(): void
    {
        $alice = $this->user('student');

        foreach (range(1, 22) as $i) {
            \App\Models\RecentSearch::create(['user_id' => $alice->id, 'term' => "term {$i}", 'last_searched_at' => now()->subMinutes(100 - $i)]);
        }

        $response = $this->withHeaders($this->authHeaders($alice))->postJson('/api/search/recent', ['term' => 'newest']);

        $terms = collect($response->json('data'))->pluck('term');
        $this->assertCount(20, $terms);
        $this->assertSame('newest', $terms->first());
        $this->assertSame(20, \App\Models\RecentSearch::where('user_id', $alice->id)->count());
    }
}
