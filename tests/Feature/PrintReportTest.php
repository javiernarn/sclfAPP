<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The printed student dashboard (/app/print/{token}) — whose QR code an
 * admin/staff/security account scans. The token only identifies the account;
 * these tests pin down WHO is allowed to read the report behind it.
 */
class PrintReportTest extends TestCase
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

    public function test_new_accounts_get_an_unguessable_public_token(): void
    {
        $user = $this->userWithRole('student');

        $this->assertNotEmpty($user->public_token);
        $this->assertSame(32, strlen($user->public_token));
        $this->assertMatchesRegularExpression('/^[a-f0-9]{32}$/', $user->public_token);
    }

    public function test_me_returns_the_callers_public_token(): void
    {
        $student = $this->userWithRole('student');

        $this->getJson('/api/me', $this->authHeaders($student))
            ->assertOk()
            ->assertJsonPath('user.public_token', $student->public_token);
    }

    public function test_student_can_open_their_own_report(): void
    {
        $student = $this->userWithRole('student');

        $this->getJson("/api/print-report/{$student->public_token}", $this->authHeaders($student))
            ->assertOk()
            ->assertJsonPath('viewer_is_self', true)
            ->assertJsonPath('subject.name', $student->name)
            ->assertJsonPath('subject.role', 'student')
            ->assertJsonStructure(['report' => ['kpis', 'monthly', 'lost_by_status', 'claims_by_status', 'recent']]);

        // Opening your own report is not an audited privileged read.
        $this->assertSame(0, AuditLog::where('action', 'dashboard.report_viewed')->count());
    }

    public function test_student_cannot_open_another_students_report(): void
    {
        $owner = $this->userWithRole('student');
        $other = User::factory()->create(['is_active' => true]);
        $other->assignRole('student');

        $this->getJson("/api/print-report/{$owner->public_token}", $this->authHeaders($other))
            ->assertForbidden();
    }

    public function test_staff_and_admin_can_open_a_students_report_and_it_is_audited(): void
    {
        $student = $this->userWithRole('student');

        $staff = User::factory()->create(['is_active' => true]);
        $staff->assignRole('staff');

        $admin = User::factory()->create(['is_active' => true]);
        $admin->assignRole('admin');

        foreach ([$staff, $admin] as $viewer) {
            $this->getJson("/api/print-report/{$student->public_token}", $this->authHeaders($viewer))
                ->assertOk()
                ->assertJsonPath('viewer_is_self', false)
                ->assertJsonPath('subject.name', $student->name);
        }

        $this->assertSame(2, AuditLog::where('action', 'dashboard.report_viewed')->count());
    }

    public function test_security_officer_cannot_open_a_students_report(): void
    {
        $student = $this->userWithRole('student');

        $officer = User::factory()->create(['is_active' => true]);
        $officer->assignRole('security_officer');

        $this->getJson("/api/print-report/{$student->public_token}", $this->authHeaders($officer))
            ->assertForbidden();
    }

    public function test_instructor_report_is_available_to_handlers(): void
    {
        $instructor = $this->userWithRole('instructor');

        $admin = User::factory()->create(['is_active' => true]);
        $admin->assignRole('admin');

        $this->getJson("/api/print-report/{$instructor->public_token}", $this->authHeaders($admin))
            ->assertOk()
            ->assertJsonPath('subject.role', 'instructor');
    }

    public function test_handler_accounts_have_no_printable_student_dashboard(): void
    {
        $officer = $this->userWithRole('security_officer');

        $admin = User::factory()->create(['is_active' => true]);
        $admin->assignRole('admin');

        $this->getJson("/api/print-report/{$officer->public_token}", $this->authHeaders($admin))
            ->assertNotFound();
    }

    public function test_unknown_token_is_not_found_and_guests_are_rejected(): void
    {
        $student = $this->userWithRole('student');

        $this->getJson('/api/print-report/' . str_repeat('a', 32), $this->authHeaders($student))
            ->assertNotFound();

        // The request above authenticated via the sanctum guard, which keeps the
        // resolved user cached on the app instance for the rest of this test.
        // Reset it so the next request really is a guest.
        $this->app['auth']->forgetGuards();

        $this->getJson("/api/print-report/{$student->public_token}")
            ->assertUnauthorized();
    }
}
