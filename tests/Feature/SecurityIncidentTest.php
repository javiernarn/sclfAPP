<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\SecurityIncident;
use App\Models\User;
use App\Services\Incidents\IncidentService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Phase 4: security incident report -> assign -> resolve -> close/reopen
 * lifecycle. Mirrors DispositionServiceTest's structure — service-level
 * assertions first, then the HTTP layer for authorization/campus-scoping.
 */
class SecurityIncidentTest extends TestCase
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

    protected function baseReportData(array $overrides = []): array
    {
        return array_merge([
            'category' => SecurityIncident::CATEGORY_THEFT,
            'severity' => SecurityIncident::SEVERITY_MEDIUM,
            'title' => 'Bicycle stolen from rack',
            'description' => 'A red mountain bike was taken from the rack near Gate 2.',
            'location_text' => 'Gate 2 bike rack',
            'occurred_at' => now()->subHour()->toDateTimeString(),
        ], $overrides);
    }

    // --- Service: report -------------------------------------------------

    public function test_any_authenticated_role_can_report_an_incident(): void
    {
        $campus = $this->campus();
        $student = $this->user('student', $campus);

        $incident = app(IncidentService::class)->report($student, $this->baseReportData());

        $this->assertSame(SecurityIncident::STATUS_REPORTED, $incident->status);
        $this->assertSame($student->id, $incident->reported_by);
        $this->assertSame($campus->id, $incident->campus_id);
    }

    public function test_report_rejects_invalid_category(): void
    {
        $this->expectException(ValidationException::class);

        $student = $this->user('student');
        app(IncidentService::class)->report($student, $this->baseReportData(['category' => 'not_a_real_category']));
    }

    // --- Service: assign ---------------------------------------------------

    public function test_assign_moves_reported_incident_to_under_review(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);
        $admin = $this->user('admin');

        $incident = app(IncidentService::class)->report($reporter, $this->baseReportData());
        $updated = app(IncidentService::class)->assign($incident, $officer, $admin);

        $this->assertSame(SecurityIncident::STATUS_UNDER_REVIEW, $updated->status);
        $this->assertSame($officer->id, $updated->assigned_to);
    }

    public function test_reassigning_a_resolved_incident_does_not_regress_its_status(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $officerA = $this->user('security_officer', $campus);
        $officerB = $this->user('security_officer', $campus);
        $admin = $this->user('admin');

        $incident = app(IncidentService::class)->report($reporter, $this->baseReportData());
        app(IncidentService::class)->assign($incident, $officerA, $admin);
        app(IncidentService::class)->resolve($incident->fresh(), $officerA, 'False alarm, bike was relocated.');

        // Resolved isn't terminal (only "closed" is) — handing it to a
        // different officer should update the assignee without silently
        // un-resolving it back to "under_review".
        $reassigned = app(IncidentService::class)->assign($incident->fresh(), $officerB, $admin);

        $this->assertSame(SecurityIncident::STATUS_RESOLVED, $reassigned->status);
        $this->assertSame($officerB->id, $reassigned->assigned_to);
    }

    public function test_assign_rejects_a_non_officer(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $notAnOfficer = $this->user('student', $campus);
        $admin = $this->user('admin');

        $incident = app(IncidentService::class)->report($reporter, $this->baseReportData());

        $this->expectException(ValidationException::class);
        app(IncidentService::class)->assign($incident, $notAnOfficer, $admin);
    }

    public function test_assign_blocked_once_closed(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);

        $incident = app(IncidentService::class)->report($reporter, $this->baseReportData());
        app(IncidentService::class)->assign($incident, $officer, $officer);
        app(IncidentService::class)->resolve($incident->fresh(), $officer, 'Resolved.');
        app(IncidentService::class)->close($incident->fresh(), $officer);

        $this->expectException(ValidationException::class);
        app(IncidentService::class)->assign($incident->fresh(), $officer, $officer);
    }

    // --- Service: resolve / close / reopen ---------------------------------

    public function test_resolve_requires_notes_and_stamps_resolver(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);

        $incident = app(IncidentService::class)->report($reporter, $this->baseReportData());
        $resolved = app(IncidentService::class)->resolve($incident, $officer, 'Bike recovered and returned to owner.');

        $this->assertSame(SecurityIncident::STATUS_RESOLVED, $resolved->status);
        $this->assertSame($officer->id, $resolved->resolved_by);
        $this->assertNotNull($resolved->resolved_at);
    }

    public function test_close_requires_resolved_status_first(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);

        $incident = app(IncidentService::class)->report($reporter, $this->baseReportData());

        $this->expectException(ValidationException::class);
        app(IncidentService::class)->close($incident, $officer);
    }

    public function test_reopen_returns_a_resolved_incident_to_under_review(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);

        $incident = app(IncidentService::class)->report($reporter, $this->baseReportData());
        app(IncidentService::class)->resolve($incident, $officer, 'Thought it was resolved.');
        $reopened = app(IncidentService::class)->reopen($incident->fresh(), $officer, 'Owner says bike still missing.');

        $this->assertSame(SecurityIncident::STATUS_UNDER_REVIEW, $reopened->status);
        $this->assertNull($reopened->resolved_at);
    }

    public function test_reopen_blocked_once_closed(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);

        $incident = app(IncidentService::class)->report($reporter, $this->baseReportData());
        app(IncidentService::class)->resolve($incident, $officer, 'Resolved.');
        app(IncidentService::class)->close($incident->fresh(), $officer);

        $this->expectException(ValidationException::class);
        app(IncidentService::class)->reopen($incident->fresh(), $officer);
    }

    // --- HTTP layer ----------------------------------------------------

    public function test_student_can_report_via_http_and_only_sees_their_own_reports(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $otherStudent = $this->user('student', $campus);

        app(IncidentService::class)->report($otherStudent, $this->baseReportData(['title' => "Someone else's report"]));

        $response = $this->withHeaders($this->authHeaders($reporter))
            ->postJson('/api/security-incidents', $this->baseReportData());
        $response->assertStatus(201);

        $list = $this->withHeaders($this->authHeaders($reporter))->getJson('/api/security-incidents');
        $list->assertStatus(200);
        $titles = collect($list->json('data.data'))->pluck('title');
        $this->assertTrue($titles->contains('Bicycle stolen from rack'));
        $this->assertFalse($titles->contains("Someone else's report"));
    }

    public function test_officer_sees_all_campus_incidents_not_just_their_own(): void
    {
        $campus = $this->campus();
        $student = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);

        app(IncidentService::class)->report($student, $this->baseReportData());

        $response = $this->withHeaders($this->authHeaders($officer))->getJson('/api/security-incidents');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data.data'));
    }

    public function test_officer_from_another_campus_does_not_see_it_in_the_campus_scoped_list(): void
    {
        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $student = $this->user('student', $campusA);
        $officerB = $this->user('security_officer', $campusB);

        app(IncidentService::class)->report($student, $this->baseReportData());

        $response = $this->withHeaders($this->authHeaders($officerB))->getJson('/api/security-incidents');
        $response->assertStatus(200);
        $this->assertCount(0, $response->json('data.data'));
    }

    public function test_only_officer_or_admin_can_assign_via_http(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);

        $incident = app(IncidentService::class)->report($reporter, $this->baseReportData());

        $this->withHeaders($this->authHeaders($reporter))
            ->postJson("/api/security-incidents/{$incident->id}/assign", ['officer_id' => $officer->id])
            ->assertStatus(403);

        // Sanctum's guard caches the resolved user on first authentication
        // within a single test (Illuminate\Auth\RequestGuard::user() only
        // re-resolves when $this->user is still null), so switching to a
        // second user's token inside the same test method needs a forced
        // guard reset — otherwise this second request would silently keep
        // authenticating as $reporter from the call above.
        \Illuminate\Support\Facades\Auth::forgetGuards();

        $this->withHeaders($this->authHeaders($officer))
            ->postJson("/api/security-incidents/{$incident->id}/assign", ['officer_id' => $officer->id])
            ->assertStatus(200)
            ->assertJsonPath('data.status', SecurityIncident::STATUS_UNDER_REVIEW);
    }

    public function test_a_student_cannot_view_someone_elses_incident_report(): void
    {
        $campus = $this->campus();
        $reporter = $this->user('student', $campus);
        $otherStudent = $this->user('student', $campus);

        $incident = app(IncidentService::class)->report($reporter, $this->baseReportData());

        $this->withHeaders($this->authHeaders($otherStudent))
            ->getJson("/api/security-incidents/{$incident->id}")
            ->assertStatus(403);
    }
}