<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\Campus;
use App\Models\FoundItem;
use App\Models\User;
use App\Services\Assets\AssetService;
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

    public function test_assets_and_visitors_categories_are_absent_for_non_staff(): void
    {
        $student = $this->user('student');

        $response = $this->withHeaders($this->authHeaders($student))->getJson('/api/search?q=laptop');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertArrayNotHasKey('assets', $data);
        $this->assertArrayNotHasKey('visitors', $data);
    }

    public function test_staff_can_search_assets_by_asset_tag(): void
    {
        $officer = $this->user('security_officer');

        $asset = app(AssetService::class)->register($officer, [
            'category' => Asset::CATEGORY_ELECTRONICS,
            'name' => 'HP ProBook 450',
        ]);

        $response = $this->withHeaders($this->authHeaders($officer))->getJson("/api/search?q={$asset->asset_tag}");

        $response->assertStatus(200);
        $titles = collect($response->json('data.assets'))->pluck('title');
        $this->assertTrue($titles->contains(fn ($t) => str_contains($t, $asset->asset_tag)));
    }

    public function test_a_students_own_assigned_asset_does_not_appear_in_search_since_assets_is_staff_only(): void
    {
        // Deliberate: AssetPolicy lets a custodian view their own asset
        // directly, but the search box's "assets" category is still a
        // staff-only surface (see SearchService's comment) — a student
        // searching should reach their asset via "My Assets", not here.
        $officer = $this->user('security_officer');
        $custodian = $this->user('student');

        $asset = app(AssetService::class)->register($officer, [
            'category' => Asset::CATEGORY_ELECTRONICS,
            'name' => 'Lenovo ThinkPad E14',
        ]);
        app(AssetService::class)->assign($asset, $custodian, $officer);

        $response = $this->withHeaders($this->authHeaders($custodian))->getJson('/api/search?q=thinkpad');

        $response->assertStatus(200);
        $this->assertArrayNotHasKey('assets', $response->json('data'));
    }
}
