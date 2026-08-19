<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Department;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\Facilities\ServiceRequestService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Phase 5: service request submit -> acknowledge -> in_progress ->
 * complete -> close/reopen lifecycle, plus the requester-initiated
 * cancel path. Mirrors SecurityIncidentTest's structure (Phase 4) —
 * service-level assertions first, then the HTTP layer for
 * authorization/campus-scoping.
 */
class ServiceRequestTest extends TestCase
{
    use RefreshDatabase;

    protected function campus(string $code = 'MAIN'): Campus
    {
        return Campus::firstOrCreate(['code' => $code], ['name' => "Campus {$code}"]);
    }

    protected function department(Campus $campus, string $name = 'Facilities'): Department
    {
        return Department::firstOrCreate(['campus_id' => $campus->id, 'name' => $name], ['code' => strtoupper(substr($name, 0, 3))]);
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

    protected function baseRequestData(array $overrides = []): array
    {
        return array_merge([
            'category' => ServiceRequest::CATEGORY_MAINTENANCE,
            'priority' => ServiceRequest::PRIORITY_MEDIUM,
            'title' => 'Aircon not cooling in Room 204',
            'description' => 'The unit runs but blows warm air. Started yesterday afternoon.',
            'location_text' => 'Room 204',
        ], $overrides);
    }

    // --- Service: submit -------------------------------------------------

    public function test_any_authenticated_role_can_submit_a_request(): void
    {
        $campus = $this->campus();
        $student = $this->user('student', $campus);

        $request = app(ServiceRequestService::class)->submit($student, $this->baseRequestData());

        $this->assertSame(ServiceRequest::STATUS_SUBMITTED, $request->status);
        $this->assertSame($student->id, $request->requested_by);
        $this->assertSame($campus->id, $request->campus_id);
    }

    public function test_submit_rejects_invalid_category(): void
    {
        $this->expectException(ValidationException::class);

        $student = $this->user('student');
        app(ServiceRequestService::class)->submit($student, $this->baseRequestData(['category' => 'not_a_real_category']));
    }

    public function test_submit_rejects_a_department_from_a_different_campus(): void
    {
        $this->expectException(ValidationException::class);

        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $otherDept = $this->department($campusB);

        $student = $this->user('student', $campusA);
        app(ServiceRequestService::class)->submit($student, $this->baseRequestData(['department_id' => $otherDept->id]));
    }

    // --- Service: assign / start ------------------------------------------

    public function test_assign_moves_submitted_request_to_acknowledged(): void
    {
        $campus = $this->campus();
        $requester = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);
        $admin = $this->user('admin');

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());
        $updated = app(ServiceRequestService::class)->assign($request, $officer, $admin);

        $this->assertSame(ServiceRequest::STATUS_ACKNOWLEDGED, $updated->status);
        $this->assertSame($officer->id, $updated->assigned_to);
    }

    public function test_reassigning_an_in_progress_request_does_not_regress_its_status(): void
    {
        $campus = $this->campus();
        $requester = $this->user('student', $campus);
        $officerA = $this->user('security_officer', $campus);
        $officerB = $this->user('security_officer', $campus);
        $admin = $this->user('admin');

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());
        app(ServiceRequestService::class)->assign($request, $officerA, $admin);
        app(ServiceRequestService::class)->start($request->fresh(), $admin);

        $updated = app(ServiceRequestService::class)->assign($request->fresh(), $officerB, $admin);

        $this->assertSame(ServiceRequest::STATUS_IN_PROGRESS, $updated->status);
        $this->assertSame($officerB->id, $updated->assigned_to);
    }

    public function test_assign_rejects_a_non_staff_user(): void
    {
        $this->expectException(ValidationException::class);

        $campus = $this->campus();
        $requester = $this->user('student', $campus);
        $otherStudent = $this->user('student', $campus);
        $admin = $this->user('admin');

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());
        app(ServiceRequestService::class)->assign($request, $otherStudent, $admin);
    }

    public function test_start_requires_acknowledged_status(): void
    {
        $this->expectException(ValidationException::class);

        $requester = $this->user('student');
        $admin = $this->user('admin');

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());
        app(ServiceRequestService::class)->start($request, $admin);
    }

    // --- Service: complete / close / reopen -------------------------------

    public function test_complete_requires_notes_and_stamps_completer(): void
    {
        $officer = $this->user('security_officer');
        $requester = $this->user('student');

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());
        app(ServiceRequestService::class)->assign($request, $officer, $officer);
        app(ServiceRequestService::class)->start($request->fresh(), $officer);

        $updated = app(ServiceRequestService::class)->complete($request->fresh(), $officer, 'Replaced the capacitor, unit cools normally now.');

        $this->assertSame(ServiceRequest::STATUS_COMPLETED, $updated->status);
        $this->assertSame($officer->id, $updated->completed_by);
        $this->assertNotNull($updated->completed_at);
    }

    public function test_close_requires_completed_status_first(): void
    {
        $this->expectException(ValidationException::class);

        $officer = $this->user('security_officer');
        $requester = $this->user('student');

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());
        app(ServiceRequestService::class)->close($request, $officer);
    }

    public function test_reopen_returns_a_completed_request_to_acknowledged(): void
    {
        $officer = $this->user('security_officer');
        $requester = $this->user('student');

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());
        app(ServiceRequestService::class)->assign($request, $officer, $officer);
        app(ServiceRequestService::class)->complete($request->fresh(), $officer, 'Done.');

        $updated = app(ServiceRequestService::class)->reopen($request->fresh(), $officer, 'Aircon broke again overnight.');

        $this->assertSame(ServiceRequest::STATUS_ACKNOWLEDGED, $updated->status);
        $this->assertNull($updated->completed_at);
    }

    public function test_reopen_blocked_once_closed(): void
    {
        $this->expectException(ValidationException::class);

        $officer = $this->user('security_officer');
        $requester = $this->user('student');

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());
        app(ServiceRequestService::class)->assign($request, $officer, $officer);
        app(ServiceRequestService::class)->complete($request->fresh(), $officer, 'Done.');
        app(ServiceRequestService::class)->close($request->fresh(), $officer);

        app(ServiceRequestService::class)->reopen($request->fresh(), $officer);
    }

    // --- Service: cancel ---------------------------------------------------

    public function test_requester_can_cancel_their_own_open_request(): void
    {
        $requester = $this->user('student');

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());
        $updated = app(ServiceRequestService::class)->cancel($request, $requester);

        $this->assertSame(ServiceRequest::STATUS_CANCELLED, $updated->status);
        $this->assertSame($requester->id, $updated->cancelled_by);
    }

    public function test_cancel_blocked_once_completed(): void
    {
        $this->expectException(ValidationException::class);

        $officer = $this->user('security_officer');
        $requester = $this->user('student');

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());
        app(ServiceRequestService::class)->assign($request, $officer, $officer);
        app(ServiceRequestService::class)->complete($request->fresh(), $officer, 'Done.');

        app(ServiceRequestService::class)->cancel($request->fresh(), $requester);
    }

    // --- HTTP layer ----------------------------------------------------

    public function test_student_can_file_via_http_and_only_sees_their_own_requests(): void
    {
        $campus = $this->campus();
        $requester = $this->user('student', $campus);
        $otherStudent = $this->user('student', $campus);

        app(ServiceRequestService::class)->submit($otherStudent, $this->baseRequestData(['title' => "Someone else's request"]));

        $response = $this->withHeaders($this->authHeaders($requester))
            ->postJson('/api/service-requests', $this->baseRequestData());
        $response->assertStatus(201);

        $list = $this->withHeaders($this->authHeaders($requester))->getJson('/api/service-requests');
        $list->assertStatus(200);
        $titles = collect($list->json('data.data'))->pluck('title');
        $this->assertTrue($titles->contains('Aircon not cooling in Room 204'));
        $this->assertFalse($titles->contains("Someone else's request"));
    }

    public function test_officer_sees_all_campus_requests_not_just_their_own(): void
    {
        $campus = $this->campus();
        $student = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);

        app(ServiceRequestService::class)->submit($student, $this->baseRequestData());

        $response = $this->withHeaders($this->authHeaders($officer))->getJson('/api/service-requests');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data.data'));
    }

    public function test_officer_from_another_campus_does_not_see_it_in_the_campus_scoped_list(): void
    {
        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $student = $this->user('student', $campusA);
        $officerB = $this->user('security_officer', $campusB);

        app(ServiceRequestService::class)->submit($student, $this->baseRequestData());

        $response = $this->withHeaders($this->authHeaders($officerB))->getJson('/api/service-requests');
        $response->assertStatus(200);
        $this->assertCount(0, $response->json('data.data'));
    }

    public function test_only_officer_or_admin_can_assign_via_http(): void
    {
        $campus = $this->campus();
        $requester = $this->user('student', $campus);
        $officer = $this->user('security_officer', $campus);

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());

        $this->withHeaders($this->authHeaders($requester))
            ->postJson("/api/service-requests/{$request->id}/assign", ['staff_id' => $officer->id])
            ->assertStatus(403);

        // See SecurityIncidentTest's identical comment: Sanctum caches the
        // resolved user for the test's guard, so switching tokens within
        // one test needs a forced guard reset.
        Auth::forgetGuards();

        $this->withHeaders($this->authHeaders($officer))
            ->postJson("/api/service-requests/{$request->id}/assign", ['staff_id' => $officer->id])
            ->assertStatus(200)
            ->assertJsonPath('data.status', ServiceRequest::STATUS_ACKNOWLEDGED);
    }

    public function test_a_student_cannot_view_someone_elses_request(): void
    {
        $campus = $this->campus();
        $requester = $this->user('student', $campus);
        $otherStudent = $this->user('student', $campus);

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());

        $this->withHeaders($this->authHeaders($otherStudent))
            ->getJson("/api/service-requests/{$request->id}")
            ->assertStatus(403);
    }

    public function test_requester_can_cancel_via_http_but_not_someone_elses_request(): void
    {
        $campus = $this->campus();
        $requester = $this->user('student', $campus);
        $otherStudent = $this->user('student', $campus);

        $request = app(ServiceRequestService::class)->submit($requester, $this->baseRequestData());

        $this->withHeaders($this->authHeaders($otherStudent))
            ->postJson("/api/service-requests/{$request->id}/cancel")
            ->assertStatus(403);

        Auth::forgetGuards();

        $this->withHeaders($this->authHeaders($requester))
            ->postJson("/api/service-requests/{$request->id}/cancel")
            ->assertStatus(200)
            ->assertJsonPath('data.status', ServiceRequest::STATUS_CANCELLED);
    }
}
