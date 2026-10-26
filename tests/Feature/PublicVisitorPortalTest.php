<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Campus;
use App\Models\User;
use App\Models\Visitor;
use App\Services\Visitors\BadgePoolService;
use App\Services\Visitors\VisitorService;
use App\Support\VisitorBadgeLink;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The public page behind the QR code on a visitor badge: signed badge links,
 * step-by-step release of information, and the "not me / found badge" path.
 */
class PublicVisitorPortalTest extends TestCase
{
    use RefreshDatabase;

    private function officer(?Campus $campus = null): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true, 'campus_id' => $campus?->id]);
        $user->assignRole('security_officer');

        return $user;
    }

    private function checkIn(User $officer, array $overrides = []): Visitor
    {
        $pool = app(BadgePoolService::class);

        return app(VisitorService::class)->checkIn($officer, array_merge([
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'id_presented' => "Driver's License",
            'id_number' => 'N01-23-456789',
            'contact_number' => '09171234567',
            'purpose' => Visitor::PURPOSE_MEETING,
            'purpose_details' => [
                'meeting_type' => 'official', 'appointment' => 'scheduled', 'agenda' => 'Secret agenda text',
                'expected_duration' => 'to_1h', 'host_confirmed' => true,
            ],
            'host_name' => 'Dean Santos',
            'host_department' => 'Registrar',
            'badge_number' => $pool->label($pool->prefixFor(), 7),
        ], $overrides));
    }

    private function url(Visitor $v, string $suffix = ''): string
    {
        return '/api/public/visitor/' . VisitorBadgeLink::token($v->campus_id, $v->badge_number) . $suffix;
    }

    public function test_badge_links_are_signed_and_cannot_be_tampered_with(): void
    {
        $token = VisitorBadgeLink::token(3, 'M-07');

        $this->assertMatchesRegularExpression('/^3-M07-[a-f0-9]{20}$/', $token);
        $this->assertSame([3, 'M-07'], VisitorBadgeLink::parse($token));
        $this->assertSame([null, 'M-200'], VisitorBadgeLink::parse(VisitorBadgeLink::token(null, 'M-200')));

        $this->assertNull(VisitorBadgeLink::parse(str_replace('M07', 'M08', $token))); // other badge, same signature
        $this->assertNull(VisitorBadgeLink::parse('3-M07-' . str_repeat('a', 20)));
        $this->assertNull(VisitorBadgeLink::parse('nonsense'));
        $this->assertNull(VisitorBadgeLink::token(1, 'not a badge'));
    }

    public function test_a_checked_in_visitor_gets_a_badge_url_in_the_api(): void
    {
        $officer = $this->officer();
        $visitor = $this->checkIn($officer);

        $this->assertStringEndsWith('/visitor/' . VisitorBadgeLink::token(null, $visitor->badge_number), $visitor->badge_url);
    }

    public function test_names_are_stored_in_parts_and_older_full_names_are_split(): void
    {
        $officer = $this->officer();

        $a = $this->checkIn($officer);
        $this->assertSame(['Juan', 'Dela Cruz'], [$a->first_name, $a->last_name]);
        $this->assertSame('Juan Dela Cruz', $a->full_name);

        $pool = app(BadgePoolService::class);
        $b = app(VisitorService::class)->checkIn($officer, [
            'full_name' => 'Maria Clara Santos', 'id_presented' => 'UMID', 'id_number' => '1', 'contact_number' => '09171234567',
            'purpose' => Visitor::PURPOSE_OTHER, 'purpose_details' => ['details' => 'x', 'authorized_by' => 'y', 'expected_duration' => 'to_1h'],
            'badge_number' => $pool->label($pool->prefixFor(), 8),
        ]);
        $this->assertSame(['Maria Clara', 'Santos'], [$b->first_name, $b->last_name]);
    }

    public function test_the_first_step_shows_only_the_first_name_and_needs_no_login(): void
    {
        $visitor = $this->checkIn($this->officer());

        $res = $this->getJson($this->url($visitor))->assertOk()
            ->assertJsonPath('state', 'active')
            ->assertJsonPath('visitor.first_name', 'Juan')
            ->assertJsonPath('verify_with', 'last_name');

        $body = json_encode($res->json());
        foreach (['Dela Cruz', 'Cruz', 'Dean Santos', 'Registrar', 'N01-23-456789', '09171234567', 'Secret agenda'] as $private) {
            $this->assertStringNotContainsString($private, $body);
        }
        $this->assertSame(1, $visitor->fresh()->badge_scan_count);
    }

    public function test_confirming_shows_the_welcome_page_without_private_details(): void
    {
        $visitor = $this->checkIn($this->officer());

        $res = $this->postJson($this->url($visitor, '/confirm'), ['last_name' => 'Dela Cruz'])->assertOk()
            ->assertJsonPath('state', 'welcome')
            ->assertJsonPath('visitor.last_name', 'Dela Cruz')
            ->assertJsonPath('visit.purpose_label', 'Meeting')
            ->assertJsonPath('visit.host_name', 'Dean Santos')
            ->assertJsonPath('visit.expected_stay', '30 minutes – 1 hour');

        $this->assertNotEmpty($res->json('guidance'));
        $this->assertNotEmpty($res->json('portal.privacy'));
        $this->assertNotNull($visitor->fresh()->welcomed_at);

        $body = json_encode($res->json());
        foreach (['N01-23-456789', '09171234567', 'Secret agenda'] as $private) {
            $this->assertStringNotContainsString($private, $body);
        }
    }

    public function test_maintenance_welcome_hides_worker_names_and_work_order(): void
    {
        $officer = $this->officer();
        $visitor = $this->checkIn($officer, [
            'purpose' => Visitor::PURPOSE_MAINTENANCE,
            'host_name' => null,
            'purpose_details' => [
                'company' => 'CoolAir Inc.', 'work_type' => 'aircon', 'work_location' => 'Room 201', 'work_order' => 'WO-SECRET-9',
                'authorized_by' => 'Engr. Reyes', 'hazard' => 'height', 'workers' => 2, 'worker_names' => "Pedro Pen\nLuis Lan",
                'tools' => 'Ladder', 'expected_duration' => 'half_day', 'ids_recorded' => true,
            ],
        ]);

        $res = $this->postJson($this->url($visitor, '/confirm'), ['last_name' => 'Dela Cruz'])->assertOk();
        $body = json_encode($res->json());

        $this->assertStringContainsString('Room 201', $body);
        $this->assertStringContainsString('Work at height', $body);
        $this->assertStringNotContainsString('WO-SECRET-9', $body);
        $this->assertStringNotContainsString('Pedro Pen', $body);
    }

    public function test_not_me_tells_the_finder_who_owns_the_badge_and_alerts_security(): void
    {
        $visitor = $this->checkIn($this->officer());

        $res = $this->postJson($this->url($visitor, '/not-me'))->assertOk()
            ->assertJsonPath('state', 'found')
            ->assertJsonPath('owner.first_name', 'Juan')
            ->assertJsonPath('owner.last_initial', 'D.')
            ->assertJsonPath('visit.purpose_label', 'Meeting')
            ->assertJsonPath('visit.host_name', 'Dean Santos')
            ->assertJsonPath('visit.host_department', 'Registrar');

        // The finder must not be able to read the last name here — it is the answer to the unlock question.
        $this->assertStringNotContainsString('Cruz', json_encode($res->json()));
        $this->assertNotNull($visitor->fresh()->badge_found_reported_at);
        $this->assertNull($visitor->fresh()->welcomed_at);
        $this->assertSame(1, AuditLog::where('action', 'visitor.badge_found_reported')->count());

        // Pressing it again does not spam the audit log.
        $this->postJson($this->url($visitor, '/not-me'))->assertOk();
        $this->assertSame(1, AuditLog::where('action', 'visitor.badge_found_reported')->count());
    }

    public function test_after_check_out_the_badge_page_shows_nothing_about_the_visitor(): void
    {
        $officer = $this->officer();
        $visitor = $this->checkIn($officer);
        $url = $this->url($visitor);
        app(VisitorService::class)->checkOut($visitor, $officer);

        foreach ([$this->getJson($url), $this->postJson($url . '/confirm', ['last_name' => 'Dela Cruz']), $this->postJson($url . '/not-me')] as $res) {
            $res->assertOk()->assertJsonPath('state', 'inactive');
            $this->assertStringNotContainsString('Dela Cruz', json_encode($res->json()));
        }
    }

    public function test_a_forged_link_is_rejected(): void
    {
        $visitor = $this->checkIn($this->officer());
        $forged = '/api/public/visitor/0-' . str_replace('-', '', $visitor->badge_number) . '-' . str_repeat('0', 20);

        $this->getJson($forged)->assertStatus(404)->assertJsonPath('state', 'invalid');
        $this->postJson($forged . '/confirm', ['last_name' => 'Dela Cruz'])->assertStatus(404);
        $this->postJson($forged . '/not-me')->assertStatus(404);
    }

    public function test_visitors_of_another_campus_are_not_reachable_with_a_link_for_this_campus(): void
    {
        $campusA = Campus::create(['code' => 'A', 'name' => 'Campus A']);
        $visitor = $this->checkIn($this->officer($campusA));

        // Same badge label, but signed for a different campus -> that campus has nobody with this badge.
        $other = '/api/public/visitor/' . VisitorBadgeLink::token($campusA->id + 1, $visitor->badge_number);
        $this->getJson($other)->assertOk()->assertJsonPath('state', 'inactive');
        $this->getJson($this->url($visitor))->assertOk()->assertJsonPath('state', 'active');
    }

    public function test_export_command_writes_a_link_for_every_badge(): void
    {
        $path = sys_get_temp_dir() . '/badge-links-' . uniqid() . '.csv';

        $this->artisan('visitor:badge-links', ['--campus' => 0, '--prefix' => 'M', '--out' => $path])->assertSuccessful();

        $lines = file($path, FILE_IGNORE_NEW_LINES);
        $this->assertCount(app(BadgePoolService::class)->size() + 1, $lines); // + header
        $this->assertStringContainsString('M-01', $lines[1]);
        $this->assertStringContainsString('/visitor/0-M01-', $lines[1]);
        @unlink($path);
    }

    public function test_a_wrong_or_missing_last_name_does_not_unlock_the_details(): void
    {
        $visitor = $this->checkIn($this->officer());

        foreach (['Santos', '', 'Juan'] as $guess) {
            $res = $this->postJson($this->url($visitor, '/confirm'), ['last_name' => $guess])
                ->assertStatus(422)->assertJsonPath('state', 'wrong');
            $body = json_encode($res->json());
            foreach (['Dean Santos', 'Registrar', 'Meeting'] as $private) {
                $this->assertStringNotContainsString($private, $body);
            }
        }
        $this->assertNull($visitor->fresh()->welcomed_at);
    }

    public function test_the_last_name_check_ignores_case_spaces_and_accents(): void
    {
        $visitor = $this->checkIn($this->officer(), ['first_name' => 'José', 'last_name' => 'Dela Peña']);

        $this->postJson($this->url($visitor, '/confirm'), ['last_name' => '  dela   PENA '])
            ->assertOk()->assertJsonPath('state', 'welcome');
    }

    public function test_five_wrong_answers_lock_the_badge_page_and_flag_it_for_security(): void
    {
        $visitor = $this->checkIn($this->officer());
        $url = $this->url($visitor, '/confirm');

        foreach ([4, 3, 2, 1] as $left) {
            $this->postJson($url, ['last_name' => 'Wrong'])->assertStatus(422)->assertJsonPath('attempts_left', $left);
        }
        $this->postJson($url, ['last_name' => 'Wrong'])->assertStatus(429)->assertJsonPath('state', 'locked');

        // Even the right answer is refused while locked.
        $this->postJson($url, ['last_name' => 'Dela Cruz'])->assertStatus(429)->assertJsonPath('state', 'locked');

        $this->assertNotNull($visitor->fresh()->badge_found_reported_at);
        $this->assertSame(1, AuditLog::where('action', 'visitor.portal_locked')->count());
    }

    public function test_a_correct_answer_resets_the_wrong_attempts(): void
    {
        $visitor = $this->checkIn($this->officer());
        $url = $this->url($visitor, '/confirm');

        $this->postJson($url, ['last_name' => 'Wrong'])->assertStatus(422);
        $this->postJson($url, ['last_name' => 'Wrong'])->assertStatus(422);
        $this->postJson($url, ['last_name' => 'Dela Cruz'])->assertOk();
        $this->postJson($url, ['last_name' => 'Wrong'])->assertStatus(422)->assertJsonPath('attempts_left', 4);
    }
}
