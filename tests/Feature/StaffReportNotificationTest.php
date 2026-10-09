<?php

namespace Tests\Feature;

use App\Models\SecurityIncident;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Facilities\ServiceRequestService;
use App\Services\Incidents\IncidentService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A student/instructor filing an incident or service request must put a
 * bell (database) notification in front of Staff, Admin and Security alike.
 */
class StaffReportNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function user(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    public function test_incident_report_notifies_staff_admin_and_security(): void
    {
        $reporter = $this->user('instructor');
        $staff = $this->user('staff');
        $admin = $this->user('admin');
        $security = $this->user('security_officer');
        $other = $this->user('student');

        app(IncidentService::class)->report($reporter, [
            'category' => SecurityIncident::CATEGORY_THEFT,
            'severity' => SecurityIncident::SEVERITY_MEDIUM,
            'title' => 'Bag stolen',
            'description' => 'Taken from the cafeteria.',
            'occurred_at' => now()->subHour()->toDateTimeString(),
        ]);

        foreach ([$staff, $admin, $security] as $recipient) {
            $this->assertSame(1, $recipient->notifications()->count(), "{$recipient->id} should be notified");
            $this->assertSame(SclfNotification::TYPE_INCIDENT_REPORTED, $recipient->notifications()->first()->data['type']);
        }
        $this->assertSame(0, $other->notifications()->count());
        $this->assertSame(0, $reporter->notifications()->count());
    }

    public function test_service_request_notifies_staff_and_admin(): void
    {
        $requester = $this->user('student');
        $staff = $this->user('staff');
        $admin = $this->user('admin');

        app(ServiceRequestService::class)->submit($requester, [
            'category' => \App\Models\ServiceRequest::CATEGORIES[0],
            'title' => 'Broken faucet',
            'description' => 'Leaking in the restroom.',
        ]);

        foreach ([$staff, $admin] as $recipient) {
            $this->assertSame(1, $recipient->notifications()->count());
            $this->assertSame(SclfNotification::TYPE_SERVICE_REQUEST_SUBMITTED, $recipient->notifications()->first()->data['type']);
        }
    }
}
