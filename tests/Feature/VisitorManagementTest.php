<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\User;
use App\Models\Visitor;
use App\Services\Visitors\BadgePoolService;
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

    private int $badgeCounter = 0;

    /** A badge label from today's pool, e.g. "M-07" on a Monday. */
    protected function badge(int $n): string
    {
        return app(BadgePoolService::class)->label(app(BadgePoolService::class)->prefixFor(), $n);
    }

    protected function meetingDetails(array $overrides = []): array
    {
        return array_merge([
            'meeting_type' => 'official',
            'appointment' => 'scheduled',
            'agenda' => 'Submit signed MOA',
            'expected_duration' => 'to_1h',
            'host_confirmed' => true,
        ], $overrides);
    }

    protected function deliveryDetails(array $overrides = []): array
    {
        return array_merge([
            'company' => 'LBC Express',
            'delivery_type' => 'parcel',
            'items' => '3 boxes of bond paper',
            'recipient' => 'Registrar Office',
            'quantity' => 3,
            'inspected' => true,
            'recipient_confirmed' => true,
        ], $overrides);
    }

    protected function baseCheckInData(array $overrides = []): array
    {
        return array_merge([
            'full_name' => 'Juan Dela Cruz',
            'id_presented' => "Driver's License",
            'id_number' => 'N01-23-456789',
            'contact_number' => '09171234567',
            'purpose' => Visitor::PURPOSE_MEETING,
            'purpose_details' => $this->meetingDetails(),
            'host_name' => 'Dean Santos',
            'host_department' => 'Registrar',
            'badge_number' => $this->badge(++$this->badgeCounter + 100),
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

    public function test_contact_number_is_required_and_must_be_a_philippine_mobile_number(): void
    {
        $officer = $this->user('security_officer');
        $headers = $this->authHeaders($officer);

        $missing = $this->baseCheckInData();
        unset($missing['contact_number']);
        $this->withHeaders($headers)->postJson('/api/visitors', $missing)
            ->assertStatus(422)->assertJsonValidationErrors('contact_number');

        foreach (['9171234567', '0917123456', '+639171234567', 'abc', '0817123456789'] as $bad) {
            $this->withHeaders($headers)
                ->postJson('/api/visitors', $this->baseCheckInData(['contact_number' => $bad]))
                ->assertStatus(422)->assertJsonValidationErrors('contact_number');
        }

        $this->withHeaders($headers)
            ->postJson('/api/visitors', $this->baseCheckInData(['contact_number' => '09171234567']))
            ->assertStatus(201)->assertJsonPath('data.contact_number', '09171234567');
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

    // --- Badge tracking / student link / search ---------------------------

    public function test_badge_number_is_required_on_check_in(): void
    {
        $officer = $this->user('security_officer');
        $data = $this->baseCheckInData();
        unset($data['badge_number']);

        $this->withHeaders($this->authHeaders($officer))
            ->postJson('/api/visitors', $data)
            ->assertStatus(422)
            ->assertJsonValidationErrors('badge_number');
    }

    public function test_same_badge_cannot_be_issued_twice_while_still_out(): void
    {
        $officer = $this->user('security_officer');
        $headers = $this->authHeaders($officer);
        $m = $this->badge(1);

        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData(['badge_number' => strtolower($m)]))
            ->assertStatus(201)->assertJsonPath('data.badge_number', $m);

        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData(['badge_number' => " {$m} "]))
            ->assertStatus(422)->assertJsonValidationErrors('badge_number');
    }

    public function test_badge_labels_are_prefixed_dash_and_zero_padded(): void
    {
        $pool = app(BadgePoolService::class);
        $prefix = $pool->prefixFor();

        $this->assertSame("{$prefix}-01", $pool->label($prefix, 1));
        $this->assertSame("{$prefix}-10", $pool->label($prefix, 10));
        $this->assertSame("{$prefix}-200", $pool->label($prefix, 200));

        $officer = $this->user('security_officer');
        $this->withHeaders($this->authHeaders($officer))
            ->postJson('/api/visitors', $this->baseCheckInData(['badge_number' => "{$prefix}1"])) // typed loosely
            ->assertStatus(201)
            ->assertJsonPath('data.badge_number', "{$prefix}-01");
    }

    public function test_badge_must_belong_to_todays_pool(): void
    {
        $officer = $this->user('security_officer');
        $headers = $this->authHeaders($officer);
        $size = app(BadgePoolService::class)->size();

        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData(['badge_number' => 'V-012']))
            ->assertStatus(422)->assertJsonValidationErrors('badge_number');
        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData(['badge_number' => $this->badge($size + 1)]))
            ->assertStatus(422)->assertJsonValidationErrors('badge_number');
    }

    public function test_another_days_badge_set_can_be_used_and_has_its_own_round(): void
    {
        $pool = app(BadgePoolService::class);
        $today = $pool->prefixFor();
        $other = collect(array_keys($pool->sets()))->first(fn ($l) => $l !== $today);
        $officer = $this->user('security_officer');
        $headers = $this->authHeaders($officer);

        $this->withHeaders($headers)
            ->postJson('/api/visitors', $this->baseCheckInData(['badge_number' => $pool->label($other, 1)]))
            ->assertStatus(201)
            ->assertJsonPath('data.badge_number', $pool->label($other, 1));

        $res = $this->withHeaders($headers)->getJson("/api/visitors/badges?prefix={$other}")->assertStatus(200);
        $this->assertSame($other, $res->json('data.prefix'));
        $this->assertSame($today, $res->json('data.today_prefix'));
        $this->assertSame('in_use', $res->json('data.badges.0.state'));
        $this->assertCount(7, $res->json('data.sets'));

        // Today's set is untouched.
        $mine = $this->withHeaders($headers)->getJson('/api/visitors/badges')->json('data');
        $this->assertSame('available', $mine['badges'][0]['state']);
    }

    public function test_returned_badge_stays_locked_until_the_whole_pool_has_been_issued(): void
    {
        config(['sclf.visitor_badges.size' => 3]);
        $officer = $this->user('security_officer');
        $svc = app(VisitorService::class);

        $v1 = $svc->checkIn($officer, $this->baseCheckInData(['badge_number' => $this->badge(1)]));
        $svc->checkOut($v1, $officer); // badge 1 is back in the box...

        // ...but cannot be reused yet: badges 2 and 3 have not been issued this round.
        try {
            $svc->checkIn($officer, $this->baseCheckInData(['badge_number' => $this->badge(1)]));
            $this->fail('Returned badge should not be selectable mid-round.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('badge_number', $e->errors());
        }

        $svc->checkIn($officer, $this->baseCheckInData(['badge_number' => $this->badge(2)]));
        $svc->checkIn($officer, $this->baseCheckInData(['badge_number' => $this->badge(3)])); // round complete

        // New round: badge 1 is selectable again; 2 and 3 are still out.
        $again = $svc->checkIn($officer, $this->baseCheckInData(['badge_number' => $this->badge(1)]));
        $this->assertSame($this->badge(1), $again->badge_number);
    }

    public function test_badges_endpoint_reports_states_and_next_badge(): void
    {
        config(['sclf.visitor_badges.size' => 5]);
        $officer = $this->user('security_officer');
        $svc = app(VisitorService::class);

        $svc->checkIn($officer, $this->baseCheckInData(['badge_number' => $this->badge(1)]));
        $two = $svc->checkIn($officer, $this->baseCheckInData(['badge_number' => $this->badge(2)]));
        $svc->checkOut($two, $officer);

        $res = $this->withHeaders($this->authHeaders($officer))->getJson('/api/visitors/badges')->assertStatus(200);

        $states = collect($res->json('data.badges'))->pluck('state', 'number');
        $this->assertSame('in_use', $states[1]);
        $this->assertSame('returned', $states[2]);
        $this->assertSame('available', $states[3]);
        $this->assertSame($this->badge(3), $res->json('data.next'));
        $this->assertSame(['available' => 3, 'in_use' => 1, 'waiting' => 1], $res->json('data.counts'));
    }

    public function test_parent_visit_requires_a_student_and_snapshots_name_and_id(): void
    {
        $officer = $this->user('security_officer');
        $headers = $this->authHeaders($officer);

        $this->withHeaders($headers)
            ->postJson('/api/visitors', $this->baseCheckInData(['purpose' => Visitor::PURPOSE_PARENT_VISIT]))
            ->assertStatus(422)->assertJsonValidationErrors('student_user_id');

        $student = User::factory()->create(['is_active' => true, 'student_id' => '2021-2-04062', 'name' => 'Maria Santos']);
        $student->assignRole('student');

        $this->withHeaders($headers)
            ->postJson('/api/visitors', $this->baseCheckInData([
                'purpose' => Visitor::PURPOSE_PARENT_VISIT,
                'purpose_details' => ['reason' => 'adviser', 'expected_duration' => 'to_1h', 'relationship_verified' => true],
                'student_user_id' => $student->id,
                'relationship' => 'parent',
            ]))
            ->assertStatus(201)
            ->assertJsonPath('data.student_name', 'Maria Santos')
            ->assertJsonPath('data.student_number', '2021-2-04062');
    }

    public function test_student_search_finds_by_name_or_student_id(): void
    {
        $officer = $this->user('security_officer');
        $student = User::factory()->create(['is_active' => true, 'student_id' => '2022-1-00123', 'name' => 'Pedro Reyes']);
        $student->assignRole('student');
        $headers = $this->authHeaders($officer);

        $this->withHeaders($headers)->getJson('/api/visitors/student-search?q=Pedro')
            ->assertStatus(200)->assertJsonPath('data.0.student_id', '2022-1-00123');
        $this->withHeaders($headers)->getJson('/api/visitors/student-search?q=2022-1-001')
            ->assertStatus(200)->assertJsonPath('data.0.name', 'Pedro Reyes');
    }

    public function test_index_search_matches_badge_name_and_student_and_lists_outstanding_badges(): void
    {
        $officer = $this->user('security_officer');
        $svc = app(VisitorService::class);
        $svc->checkIn($officer, $this->baseCheckInData(['full_name' => 'Ana Lim', 'badge_number' => $this->badge(9)]));
        $gone = $svc->checkIn($officer, $this->baseCheckInData(['full_name' => 'Ben Tan', 'badge_number' => $this->badge(10)]));
        $svc->checkOut($gone, $officer);
        $headers = $this->authHeaders($officer);

        $byBadge = $this->withHeaders($headers)->getJson('/api/visitors?search='.$this->badge(9).'');
        $this->assertSame(['Ana Lim'], collect($byBadge->json('data.data'))->pluck('full_name')->all());

        $byName = $this->withHeaders($headers)->getJson('/api/visitors?status=all&search=Ben');
        $this->assertSame(['Ben Tan'], collect($byName->json('data.data'))->pluck('full_name')->all());

        $out = $this->withHeaders($headers)->getJson('/api/visitors?status=checked_out');
        $this->assertSame(['Ben Tan'], collect($out->json('data.data'))->pluck('full_name')->all());

        $this->assertSame([$this->badge(9)], collect($byBadge->json('outstanding_badges'))->pluck('badge_number')->all());
    }

    // --- Purpose-specific details ------------------------------------------

    public function test_purpose_fields_endpoint_lists_every_purpose_with_its_fields(): void
    {
        $officer = $this->user('security_officer');

        $res = $this->withHeaders($this->authHeaders($officer))->getJson('/api/visitors/purpose-fields')->assertOk();

        $this->assertEqualsCanonicalizing(Visitor::PURPOSES, collect($res->json('data'))->pluck('value')->all());
        $delivery = collect($res->json('data'))->firstWhere('value', 'delivery');
        $this->assertContains('items', collect($delivery['fields'])->pluck('key')->all());
    }

    public function test_delivery_is_refused_without_its_details_and_no_badge_is_used(): void
    {
        $officer = $this->user('security_officer');
        $data = $this->baseCheckInData(['purpose' => Visitor::PURPOSE_DELIVERY, 'purpose_details' => ['company' => 'LBC Express']]);

        $this->withHeaders($this->authHeaders($officer))->postJson('/api/visitors', $data)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['purpose_details.delivery_type', 'purpose_details.items', 'purpose_details.recipient', 'purpose_details.recipient_confirmed']);

        $this->assertDatabaseCount('visitors', 0);
    }

    public function test_delivery_details_are_saved_with_the_visitor(): void
    {
        $officer = $this->user('security_officer');
        $data = $this->baseCheckInData([
            'purpose' => Visitor::PURPOSE_DELIVERY,
            'purpose_details' => $this->deliveryDetails(['unknown_field' => 'ignored']),
        ]);

        $this->withHeaders($this->authHeaders($officer))->postJson('/api/visitors', $data)
            ->assertStatus(201)
            ->assertJsonPath('data.purpose_details.company', 'LBC Express')
            ->assertJsonPath('data.purpose_details.recipient_confirmed', true)
            ->assertJsonMissingPath('data.purpose_details.unknown_field');

        $this->assertSame('3 boxes of bond paper', Visitor::first()->purpose_details['items']);
    }

    public function test_meeting_needs_a_host_and_the_host_confirmation(): void
    {
        $officer = $this->user('security_officer');
        $headers = $this->authHeaders($officer);

        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData(['host_name' => null]))
            ->assertStatus(422)->assertJsonValidationErrors('host_name');

        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData([
            'purpose_details' => $this->meetingDetails(['host_confirmed' => false]),
        ]))->assertStatus(422)->assertJsonValidationErrors('purpose_details.host_confirmed');
    }

    public function test_maintenance_needs_a_work_order_and_who_authorized_it(): void
    {
        $officer = $this->user('security_officer');

        $this->withHeaders($this->authHeaders($officer))->postJson('/api/visitors', $this->baseCheckInData([
            'purpose' => Visitor::PURPOSE_MAINTENANCE,
            'purpose_details' => ['company' => 'CoolAir Inc.', 'work_type' => 'aircon', 'work_location' => 'Room 201', 'workers' => 2, 'tools' => 'Toolbox'],
        ]))->assertStatus(422)->assertJsonValidationErrors(['purpose_details.work_order', 'purpose_details.authorized_by']);
    }

    public function test_editing_an_entry_also_requires_the_details_for_the_chosen_purpose(): void
    {
        $officer = $this->user('security_officer');
        $headers = $this->authHeaders($officer);

        $id = $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData())->assertStatus(201)->json('data.id');

        $change = $this->baseCheckInData(['purpose' => Visitor::PURPOSE_DELIVERY, 'purpose_details' => []]);
        unset($change['badge_number']);

        $this->withHeaders($headers)->patchJson("/api/visitors/{$id}", $change + ['badge_number' => Visitor::find($id)->badge_number])
            ->assertStatus(422)->assertJsonValidationErrors('purpose_details.company');

        $this->withHeaders($headers)->patchJson("/api/visitors/{$id}", array_merge($change, [
            'purpose_details' => $this->deliveryDetails(),
            'badge_number' => Visitor::find($id)->badge_number,
        ]))->assertOk()->assertJsonPath('data.purpose_details.delivery_type', 'parcel');
    }

    public function test_index_reports_the_live_board_by_purpose(): void
    {
        $officer = $this->user('security_officer');
        $headers = $this->authHeaders($officer);

        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData())->assertStatus(201);
        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData([
            'purpose' => Visitor::PURPOSE_DELIVERY, 'purpose_details' => $this->deliveryDetails(), 'host_name' => null,
        ]))->assertStatus(201);

        $this->withHeaders($headers)->getJson('/api/visitors')->assertOk()
            ->assertJsonPath('live.by_purpose.meeting', 1)
            ->assertJsonPath('live.by_purpose.delivery', 1)
            ->assertJsonPath('live.overdue', 0);
    }

    public function test_every_visitor_must_present_an_id(): void
    {
        $officer = $this->user('security_officer');

        $this->withHeaders($this->authHeaders($officer))
            ->postJson('/api/visitors', $this->baseCheckInData(['id_presented' => null, 'id_number' => null]))
            ->assertStatus(422)->assertJsonValidationErrors(['id_presented', 'id_number']);

        $this->assertDatabaseCount('visitors', 0);
    }

    public function test_maintenance_needs_worker_names_hazard_and_id_check(): void
    {
        $officer = $this->user('security_officer');

        $this->withHeaders($this->authHeaders($officer))->postJson('/api/visitors', $this->baseCheckInData([
            'purpose' => Visitor::PURPOSE_MAINTENANCE,
            'purpose_details' => [
                'company' => 'CoolAir Inc.', 'work_type' => 'aircon', 'work_location' => 'Room 201', 'work_order' => 'WO-1',
                'authorized_by' => 'Engr. Reyes', 'workers' => 2, 'tools' => 'Toolbox', 'expected_duration' => 'half_day',
            ],
        ]))->assertStatus(422)->assertJsonValidationErrors([
            'purpose_details.hazard', 'purpose_details.worker_names', 'purpose_details.ids_recorded',
        ]);
    }

    public function test_a_visitor_is_flagged_once_past_the_stay_they_declared(): void
    {
        $officer = $this->user('security_officer');

        // Said "under 30 minutes" but has been inside for 2 hours -> flagged.
        Visitor::create([
            'full_name' => 'Late Visitor', 'purpose' => Visitor::PURPOSE_MEETING,
            'purpose_details' => ['expected_duration' => 'under_30'],
            'checked_in_by' => $officer->id, 'checked_in_at' => now()->subHours(2), 'status' => Visitor::STATUS_CHECKED_IN,
        ]);
        // Said "whole day" and has been inside for 2 hours -> fine.
        Visitor::create([
            'full_name' => 'Long Stay', 'purpose' => Visitor::PURPOSE_MEETING,
            'purpose_details' => ['expected_duration' => 'whole_day'],
            'checked_in_by' => $officer->id, 'checked_in_at' => now()->subHours(2), 'status' => Visitor::STATUS_CHECKED_IN,
        ]);

        $this->withHeaders($this->authHeaders($officer))->getJson('/api/visitors')->assertOk()
            ->assertJsonPath('live.overdue', 1);
    }

    public function test_first_and_last_name_must_both_be_given_when_either_is(): void
    {
        $officer = $this->user('security_officer');
        $headers = $this->authHeaders($officer);

        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData(['full_name' => null, 'first_name' => 'Juan']))
            ->assertStatus(422)->assertJsonValidationErrors('last_name');

        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData(['full_name' => null]))
            ->assertStatus(422)->assertJsonValidationErrors('full_name');

        $this->withHeaders($headers)->postJson('/api/visitors', $this->baseCheckInData(['full_name' => null, 'first_name' => 'Juan', 'last_name' => 'Dela Cruz']))
            ->assertStatus(201)
            ->assertJsonPath('data.full_name', 'Juan Dela Cruz')
            ->assertJsonPath('data.last_name', 'Dela Cruz')
            ->assertJsonPath('data.first_name', 'Juan');
    }

    // ---- who may manage visitors: Security Officer only; Admin and Staff just read the history ----

    public static function readOnlyRoles(): array
    {
        return ['admin' => ['admin'], 'staff' => ['staff']];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('readOnlyRoles')]
    public function test_admin_and_staff_can_read_the_full_visitor_history_across_campuses(string $role): void
    {
        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $officerA = $this->user('security_officer', $campusA);
        $officerB = $this->user('security_officer', $campusB);
        $v1 = app(VisitorService::class)->checkIn($officerA, $this->baseCheckInData(['full_name' => 'Campus A Visitor']));
        $v2 = app(VisitorService::class)->checkIn($officerB, $this->baseCheckInData(['full_name' => 'Campus B Visitor']));
        app(VisitorService::class)->checkOut($v1, $officerA);

        $viewer = $this->user($role);
        $res = $this->withHeaders($this->authHeaders($viewer))->getJson('/api/visitors?status=all');

        $res->assertStatus(200);
        $names = collect($res->json('data.data'))->pluck('full_name');
        $this->assertTrue($names->contains('Campus A Visitor'), 'checked-out history must be visible');
        $this->assertTrue($names->contains('Campus B Visitor'), 'every campus must be visible');
        $this->withHeaders($this->authHeaders($viewer))->getJson('/api/visitors/purpose-fields')->assertStatus(200);
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('readOnlyRoles')]
    public function test_admin_and_staff_cannot_create_edit_check_out_or_delete_a_visitor(string $role): void
    {
        $officer = $this->user('security_officer', $this->campus());
        $visitor = app(VisitorService::class)->checkIn($officer, $this->baseCheckInData(['full_name' => 'Original Name']));
        $before = Visitor::count();

        $h = $this->authHeaders($this->user($role));

        $this->withHeaders($h)->postJson('/api/visitors', $this->baseCheckInData(['full_name' => 'Sneaky Visitor']))->assertStatus(403);
        $this->withHeaders($h)->patchJson("/api/visitors/{$visitor->id}", ['full_name' => 'Changed Name'])->assertStatus(403);
        $this->withHeaders($h)->postJson("/api/visitors/{$visitor->id}/check-out", [])->assertStatus(403);
        $this->withHeaders($h)->deleteJson("/api/visitors/{$visitor->id}")->assertStatus(403);
        $this->withHeaders($h)->getJson('/api/visitors/badges')->assertStatus(403);
        $this->withHeaders($h)->getJson('/api/visitors/student-search?q=ab')->assertStatus(403);

        $this->assertSame($before, Visitor::count(), 'nothing may be created');
        $fresh = $visitor->fresh();
        $this->assertSame('Original Name', $fresh->full_name);
        $this->assertSame(Visitor::STATUS_CHECKED_IN, $fresh->status, 'nothing may be checked out');
        $this->assertNull($fresh->deleted_at, 'nothing may be deleted');
    }

    public function test_security_officer_can_still_manage_visitors_but_cannot_delete_them(): void
    {
        $officer = $this->user('security_officer', $this->campus());
        $h = $this->authHeaders($officer);

        $this->withHeaders($h)->getJson('/api/visitors/badges')->assertStatus(200);
        $created = $this->withHeaders($h)->postJson('/api/visitors', $this->baseCheckInData(['full_name' => 'Desk Visitor']));
        $created->assertStatus(201);
        $id = $created->json('data.id') ?? $created->json('id');
        $this->withHeaders($h)->patchJson("/api/visitors/{$id}", ['notes' => 'edited'] + $this->baseCheckInData(['full_name' => 'Desk Visitor']))->assertStatus(200);
        $this->withHeaders($h)->postJson("/api/visitors/{$id}/check-out", [])->assertStatus(200);
        $this->withHeaders($h)->deleteJson("/api/visitors/{$id}")->assertStatus(403);
    }
}
