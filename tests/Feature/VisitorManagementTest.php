<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\User;
use App\Models\Visitor;
use App\Services\Visitors\VisitorService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Phase 4: visitor check-in / check-out log. Mirrors DispositionServiceTest's
 * structure — service-level assertions first, then the HTTP layer for
 * authorization/campus-scoping.
 */
class VisitorManagementTest extends TestCase
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

    protected function baseCheckInData(array $overrides = []): array
    {
        return array_merge([
            'full_name' => 'Juan Dela Cruz',
            'id_presented' => "Driver's License",
            'id_number' => 'N01-23-456789',
            'purpose' => Visitor::PURPOSE_MEETING,
            'host_name' => 'Dean Santos',
            'host_department' => 'Registrar',
        ], $overrides);
    }

    // --- Service ---------------------------------------------------------

    public function test_check_in_creates_a_checked_in_record_defaulted_to_the_officers_campus(): void
    {
        $campus = $this->campus();
        $officer = $this->user('security_officer', $campus);

        $visitor = app(VisitorService::class)->checkIn($officer, $this->baseCheckInData());

        $this->assertSame(Visitor::STATUS_CHECKED_IN, $visitor->status);
        $this->assertSame($officer->id, $visitor->checked_in_by);
        $this->assertSame($campus->id, $visitor->campus_id);
        $this->assertNotNull($visitor->checked_in_at);
        $this->assertNull($visitor->checked_out_at);
    }

    public function test_check_in_rejects_an_invalid_purpose(): void
    {
        $this->expectException(ValidationException::class);

        $officer = $this->user('security_officer');
        app(VisitorService::class)->checkIn($officer, $this->baseCheckInData(['purpose' => 'sightseeing']));
    }

    public function test_check_out_stamps_officer_and_timestamp(): void
    {
        $officer = $this->user('security_officer');
        $visitor = app(VisitorService::class)->checkIn($officer, $this->baseCheckInData());

        $checkedOut = app(VisitorService::class)->checkOut($visitor, $officer, 'Left via main gate.');

        $this->assertSame(Visitor::STATUS_CHECKED_OUT, $checkedOut->status);
        $this->assertSame($officer->id, $checkedOut->checked_out_by);
        $this->assertNotNull($checkedOut->checked_out_at);
        $this->assertSame('Left via main gate.', $checkedOut->notes);
    }

    public function test_check_out_is_blocked_once_already_checked_out(): void
    {
        $officer = $this->user('security_officer');
        $visitor = app(VisitorService::class)->checkIn($officer, $this->baseCheckInData());
        app(VisitorService::class)->checkOut($visitor, $officer);

        $this->expectException(ValidationException::class);
        app(VisitorService::class)->checkOut($visitor->fresh(), $officer);
    }

    public function test_currently_on_campus_query_excludes_checked_out_visitors(): void
    {
        $officer = $this->user('security_officer');
        $stillHere = app(VisitorService::class)->checkIn($officer, $this->baseCheckInData(['full_name' => 'Still Here']));
        $left = app(VisitorService::class)->checkIn($officer, $this->baseCheckInData(['full_name' => 'Already Left']));
        app(VisitorService::class)->checkOut($left, $officer);

        $onCampus = app(VisitorService::class)->currentlyOnCampusQuery()->pluck('full_name');

        $this->assertTrue($onCampus->contains('Still Here'));
        $this->assertFalse($onCampus->contains('Already Left'));
    }

    // --- HTTP layer ------------------------------------------------------

    public function test_student_cannot_check_in_a_visitor(): void
    {
        $student = $this->user('student');

        $this->withHeaders($this->authHeaders($student))
            ->postJson('/api/visitors', $this->baseCheckInData())
            ->assertStatus(403);
    }

    public function test_officer_can_check_in_and_check_out_via_http(): void
    {
        $officer = $this->user('security_officer');

        $checkInResponse = $this->withHeaders($this->authHeaders($officer))
            ->postJson('/api/visitors', $this->baseCheckInData());
        $checkInResponse->assertStatus(201)->assertJsonPath('data.status', Visitor::STATUS_CHECKED_IN);

        $visitorId = $checkInResponse->json('data.id');

        $checkOutResponse = $this->withHeaders($this->authHeaders($officer))
            ->postJson("/api/visitors/{$visitorId}/check-out", []);
        $checkOutResponse->assertStatus(200)->assertJsonPath('data.status', Visitor::STATUS_CHECKED_OUT);
    }

    public function test_index_reports_currently_on_campus_count_and_is_campus_scoped(): void
    {
        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $officerA = $this->user('security_officer', $campusA);
        $officerB = $this->user('security_officer', $campusB);

        app(VisitorService::class)->checkIn($officerA, $this->baseCheckInData(['full_name' => 'Campus A Visitor']));
        app(VisitorService::class)->checkIn($officerB, $this->baseCheckInData(['full_name' => 'Campus B Visitor']));

        $response = $this->withHeaders($this->authHeaders($officerA))->getJson('/api/visitors');

        $response->assertStatus(200)->assertJsonPath('currently_on_campus', 1);
        $names = collect($response->json('data.data'))->pluck('full_name');
        $this->assertTrue($names->contains('Campus A Visitor'));
        $this->assertFalse($names->contains('Campus B Visitor'));
    }

    public function test_officer_cannot_check_out_a_visitor_from_another_campus(): void
    {
        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $officerA = $this->user('security_officer', $campusA);
        $officerB = $this->user('security_officer', $campusB);

        $visitor = app(VisitorService::class)->checkIn($officerA, $this->baseCheckInData());

        $this->withHeaders($this->authHeaders($officerB))
            ->postJson("/api/visitors/{$visitor->id}/check-out", [])
            ->assertStatus(403);
    }
}
