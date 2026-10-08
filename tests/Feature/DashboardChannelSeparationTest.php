<?php

namespace Tests\Feature;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A Counter check-in creates a FoundItem (intake_channel = counter_intake) and
 * an auto-approved Claim. Those must not inflate the "Found Items" / "Claims
 * Filed" numbers, the Intake Trend, or the student's claims chart.
 */
class DashboardChannelSeparationTest extends TestCase
{
    use RefreshDatabase;

    protected function userWithRole(string $role): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    protected function authHeaders(User $user): array
    {
        $token = $user->createToken('test', ['*'])->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    /** Mimics CounterIntakeService::checkIn(): counter item + approved claim. */
    protected function seedCounterCheckIns(int $count, ?User $owner = null): void
    {
        for ($i = 0; $i < $count; $i++) {
            $item = FoundItem::factory()->create(['intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE]);
            Claim::create([
                'found_item_id' => $item->id,
                'claimant_id' => ($owner ?? User::factory()->create())->id,
                'status' => Claim::STATUS_APPROVED,
            ]);
        }
    }

    public function test_counter_check_ins_do_not_leak_into_found_and_claims_numbers(): void
    {
        $this->seedCounterCheckIns(3);

        $admin = $this->userWithRole('admin');
        $response = $this->withHeaders($this->authHeaders($admin))->getJson('/api/analytics/dashboard?days=14');

        $response->assertOk();
        $response->assertJsonPath('kpis.found.value', 0);
        $response->assertJsonPath('kpis.claims.value', 0);
        $response->assertJsonPath('summary.total_found', 0);
        $response->assertJsonPath('summary.found_reports.total', 0);
        $response->assertJsonPath('summary.counter.total', 3);
        $this->assertSame(0, collect($response->json('trend'))->sum('found'));
        $this->assertSame(0, collect($response->json('trend'))->sum('claims'));
        $this->assertSame(3, collect($response->json('trend'))->sum('counter'));
        $this->assertSame(0, collect($response->json('monthly'))->sum('found'));
        $this->assertSame(3, collect($response->json('monthly'))->sum('counter'));
        $this->assertSame([], (array) $response->json('claims_by_status'));
    }

    public function test_real_online_reports_and_claims_still_count(): void
    {
        $this->seedCounterCheckIns(2);

        $online = FoundItem::factory()->create(['intake_channel' => FoundItem::CHANNEL_ONLINE_REPORT]);
        Claim::create([
            'found_item_id' => $online->id,
            'claimant_id' => User::factory()->create()->id,
            'status' => Claim::STATUS_PENDING,
        ]);

        $admin = $this->userWithRole('admin');
        $response = $this->withHeaders($this->authHeaders($admin))->getJson('/api/analytics/dashboard?days=14');

        $response->assertOk();
        $response->assertJsonPath('kpis.found.value', 1);
        $response->assertJsonPath('kpis.claims.value', 1);
        $response->assertJsonPath('summary.counter.total', 2);
        $response->assertJsonPath('claims_by_status.pending', 1);
    }

    public function test_student_dashboard_ignores_counter_items_for_shelf_count_and_claims_chart(): void
    {
        $student = $this->userWithRole('student');
        $this->seedCounterCheckIns(2, $student);

        FoundItem::factory()->create(['intake_channel' => FoundItem::CHANNEL_ONLINE_REPORT]);

        $response = $this->withHeaders($this->authHeaders($student))->getJson('/api/analytics/me');

        $response->assertOk();
        $response->assertJsonPath('campus.items_on_shelf', 1);
        $this->assertSame(0, collect($response->json('monthly'))->sum('claims'));
    }

    public function test_counter_awaiting_release_excludes_disposed_and_released_items(): void
    {
        foreach ([FoundItem::STATUS_STORED, FoundItem::STATUS_RELEASED, FoundItem::STATUS_DISPOSED] as $status) {
            FoundItem::factory()->create([
                'intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE,
                'status' => $status,
            ]);
        }

        $admin = $this->userWithRole('admin');
        $response = $this->withHeaders($this->authHeaders($admin))->getJson('/api/analytics/dashboard?days=14');

        $response->assertOk();
        $response->assertJsonPath('summary.counter.awaiting_release', 1);
        $response->assertJsonPath('summary.counter.released', 1);
    }
}
