<?php

namespace Tests\Feature;

use App\Models\SecurityIncident;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OneReportPerDayTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    protected function lost(string $name = 'Umbrella'): array
    {
        return ['item_name' => $name, 'description' => 'Lost near the gym.'];
    }

    public function test_a_student_can_submit_only_one_lost_report_per_day(): void
    {
        config(['sclf.daily_report_limit.enabled' => true]);
        $student = $this->makeUser('student');

        $this->actingAs($student)->postJson('/api/lost-items', $this->lost())->assertCreated();

        $this->actingAs($student)->postJson('/api/lost-items', $this->lost('Wallet'))
            ->assertStatus(422)
            ->assertJsonPath('code', 'daily_report_limit');
    }

    public function test_each_report_type_has_its_own_daily_allowance(): void
    {
        config(['sclf.daily_report_limit.enabled' => true]);
        $student = $this->makeUser('student');

        $this->actingAs($student)->postJson('/api/lost-items', $this->lost())->assertCreated();
        $this->actingAs($student)->postJson('/api/found-items', $this->lost('Keys'))->assertCreated();
    }

    public function test_turning_the_limit_off_allows_many_reports(): void
    {
        config(['sclf.daily_report_limit.enabled' => false]);
        $student = $this->makeUser('student');

        $this->actingAs($student)->postJson('/api/lost-items', $this->lost())->assertCreated();
        $this->actingAs($student)->postJson('/api/lost-items', $this->lost('Wallet'))->assertCreated();
    }

    public function test_security_officers_are_not_limited(): void
    {
        config(['sclf.daily_report_limit.enabled' => true]);
        $officer = $this->makeUser('security_officer');

        $this->actingAs($officer)->postJson('/api/found-items', $this->lost('Keys'))->assertCreated();
        $this->actingAs($officer)->postJson('/api/found-items', $this->lost('Bag'))->assertCreated();
    }

    protected function incident(): array
    {
        return [
            'category' => SecurityIncident::CATEGORY_VANDALISM,
            'severity' => SecurityIncident::SEVERITY_MEDIUM,
            'title' => 'Graffiti on wall',
            'description' => 'Someone spray-painted the wall near the library.',
            'occurred_at' => now()->subHour()->toDateTimeString(),
        ];
    }

    protected function service(): array
    {
        return [
            'category' => ServiceRequest::CATEGORY_MAINTENANCE,
            'priority' => ServiceRequest::PRIORITY_MEDIUM,
            'title' => 'Leaking faucet',
            'description' => 'The faucet in the 2nd floor restroom keeps dripping.',
        ];
    }

    public function test_incident_and_service_reports_are_limited_to_one_per_day(): void
    {
        config(['sclf.daily_report_limit.enabled' => true]);
        $student = $this->makeUser('student');

        $this->actingAs($student)->postJson('/api/security-incidents', $this->incident())->assertCreated();
        $this->actingAs($student)->postJson('/api/security-incidents', $this->incident())
            ->assertStatus(422)->assertJsonPath('code', 'daily_report_limit');

        $this->actingAs($student)->postJson('/api/service-requests', $this->service())->assertCreated();
        $this->actingAs($student)->postJson('/api/service-requests', $this->service())
            ->assertStatus(422)->assertJsonPath('code', 'daily_report_limit');
    }

    public function test_limit_is_per_account(): void
    {
        config(['sclf.daily_report_limit.enabled' => true]);
        $a = $this->makeUser('student');
        $b = User::factory()->create(['is_active' => true]);
        $b->assignRole('student');

        $this->actingAs($a)->postJson('/api/lost-items', $this->lost())->assertCreated();
        $this->actingAs($b)->postJson('/api/lost-items', $this->lost())->assertCreated();
    }

    public function test_limit_resets_the_next_day(): void
    {
        config(['sclf.daily_report_limit.enabled' => true]);
        $student = $this->makeUser('student');

        $this->actingAs($student)->postJson('/api/lost-items', $this->lost())->assertCreated();
        $this->travel(1)->day();
        $this->actingAs($student)->postJson('/api/lost-items', $this->lost('Wallet'))->assertCreated();
    }

    public function test_off_switch_also_lifts_the_limit_for_incidents_and_services(): void
    {
        config(['sclf.daily_report_limit.enabled' => false]);
        $student = $this->makeUser('student');

        $this->actingAs($student)->postJson('/api/security-incidents', $this->incident())->assertCreated();
        $this->actingAs($student)->postJson('/api/security-incidents', $this->incident())->assertCreated();
        $this->actingAs($student)->postJson('/api/service-requests', $this->service())->assertCreated();
        $this->actingAs($student)->postJson('/api/service-requests', $this->service())->assertCreated();
    }
}
