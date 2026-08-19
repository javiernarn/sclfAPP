<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\StorageLocation;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CounterDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function campus(string $code = 'MAIN'): Campus
    {
        return Campus::firstOrCreate(['code' => $code], ['name' => "Campus {$code}"]);
    }

    protected function officer(?Campus $campus = null, bool $admin = false): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $officer */
        $officer = User::factory()->create(['is_active' => true, 'campus_id' => $campus?->id]);
        $officer->assignRole($admin ? 'admin' : 'security_officer');

        return $officer;
    }

    protected function counter(Campus $campus, string $code): StorageLocation
    {
        return StorageLocation::create([
            'campus_id' => $campus->id,
            'type' => StorageLocation::TYPE_COUNTER,
            'label' => "Counter {$code}",
            'code' => $code,
            'is_active' => true,
        ]);
    }

    protected function authHeaders(User $user): array
    {
        $token = $user->createToken('test', ['*'])->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    public function test_non_staff_cannot_view_the_dashboard(): void
    {
        $this->seed(RoleSeeder::class);
        $student = User::factory()->create(['is_active' => true]);
        $student->assignRole('student');

        $response = $this->withHeaders($this->authHeaders($student))->getJson('/api/counter/dashboard');

        $response->assertStatus(403);
    }

    public function test_officer_only_sees_counters_at_their_own_campus(): void
    {
        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $this->counter($campusA, 'CTR-DASH-A');
        $this->counter($campusB, 'CTR-DASH-B');

        $officer = $this->officer($campusA);

        $response = $this->withHeaders($this->authHeaders($officer))->getJson('/api/counter/dashboard');

        $response->assertStatus(200);
        $codes = collect($response->json('data'))->pluck('code');
        $this->assertContains('CTR-DASH-A', $codes);
        $this->assertNotContains('CTR-DASH-B', $codes);
    }

    public function test_admin_sees_counters_across_all_campuses(): void
    {
        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $this->counter($campusA, 'CTR-DASH-AA');
        $this->counter($campusB, 'CTR-DASH-BB');

        $admin = $this->officer(null, admin: true);

        $response = $this->withHeaders($this->authHeaders($admin))->getJson('/api/counter/dashboard');

        $response->assertStatus(200);
        $codes = collect($response->json('data'))->pluck('code');
        $this->assertContains('CTR-DASH-AA', $codes);
        $this->assertContains('CTR-DASH-BB', $codes);
    }

    public function test_officer_can_toggle_counter_status(): void
    {
        $campus = $this->campus();
        $counter = $this->counter($campus, 'CTR-STATUS-1');
        $officer = $this->officer($campus);

        $response = $this->withHeaders($this->authHeaders($officer))
            ->patchJson("/api/storage-locations/{$counter->id}/status", ['status' => StorageLocation::STATUS_CLOSED]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('storage_locations', ['id' => $counter->id, 'status' => StorageLocation::STATUS_CLOSED]);
    }

    public function test_officer_cannot_toggle_status_of_a_different_campus_counter(): void
    {
        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $counter = $this->counter($campusB, 'CTR-STATUS-2');
        $officer = $this->officer($campusA);

        $response = $this->withHeaders($this->authHeaders($officer))
            ->patchJson("/api/storage-locations/{$counter->id}/status", ['status' => StorageLocation::STATUS_CLOSED]);

        $response->assertStatus(403);
    }

    public function test_invalid_status_value_is_rejected(): void
    {
        $campus = $this->campus();
        $counter = $this->counter($campus, 'CTR-STATUS-3');
        $officer = $this->officer($campus);

        $response = $this->withHeaders($this->authHeaders($officer))
            ->patchJson("/api/storage-locations/{$counter->id}/status", ['status' => 'not_a_real_status']);

        $response->assertStatus(422);
    }
}
