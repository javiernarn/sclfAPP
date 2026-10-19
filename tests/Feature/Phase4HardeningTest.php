<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Phase 4 of the security hardening (see PHASE_4.md): security headers,
 * HTTPS-aware config and the security:watch alert command.
 */
class Phase4HardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_response_carries_the_basic_security_headers(): void
    {
        $response = $this->getJson('/api/me'); // 401 is fine, headers still apply

        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $this->assertStringContainsString('camera=(self)', $response->headers->get('Permissions-Policy'));
    }

    public function test_hsts_is_only_sent_on_https_when_enabled(): void
    {
        config(['security.headers.hsts' => true]);

        $this->getJson('/api/me')->assertHeaderMissing('Strict-Transport-Security');

        $this->getJson('https://localhost/api/me')->assertHeader('Strict-Transport-Security');

        config(['security.headers.hsts' => false]);

        $this->getJson('https://localhost/api/me')->assertHeaderMissing('Strict-Transport-Security');
    }

    public function test_csp_is_report_only_by_default_and_only_on_html_pages(): void
    {
        $page = $this->withoutVite()->get('/login');
        $page->assertHeader('Content-Security-Policy-Report-Only');
        $page->assertHeaderMissing('Content-Security-Policy');
        $this->assertStringContainsString("script-src 'self'", $page->headers->get('Content-Security-Policy-Report-Only'));
        $this->assertStringContainsString("frame-ancestors 'none'", $page->headers->get('Content-Security-Policy-Report-Only'));

        $this->getJson('/api/me')->assertHeaderMissing('Content-Security-Policy-Report-Only');
    }

    public function test_csp_can_be_enforced_or_turned_off(): void
    {
        config(['security.headers.csp' => 'enforce']);
        $this->withoutVite()->get('/login')->assertHeader('Content-Security-Policy');

        config(['security.headers.csp' => 'off']);
        $page = $this->withoutVite()->get('/login');
        $page->assertHeaderMissing('Content-Security-Policy');
        $page->assertHeaderMissing('Content-Security-Policy-Report-Only');
    }

    public function test_security_watch_is_quiet_when_nothing_happens(): void
    {
        Mail::fake();

        $this->artisan('security:watch')->assertSuccessful();

        Mail::assertNothingSent();
    }

    public function test_security_watch_alerts_the_admin_once_when_logins_fail_in_bulk(): void
    {
        Mail::fake();
        $this->seed(RoleSeeder::class);

        $admin = User::factory()->create(['email' => 'admin@example.com', 'is_active' => true]);
        $admin->assignRole('admin');

        for ($i = 0; $i < 31; $i++) {
            // AuditLog has no automatic timestamps, so created_at must be set.
            AuditLog::create([
                'action' => 'auth.failed_login',
                'description' => 'test',
                'ip_address' => '203.0.113.' . ($i % 40),
                'created_at' => now(),
            ]);
        }

        $this->artisan('security:watch')->assertSuccessful();
        $this->artisan('security:watch')->assertSuccessful(); // cooldown: no second email

        Mail::assertSentCount(1);
    }

    public function test_security_watch_dry_run_never_sends_email(): void
    {
        Mail::fake();

        for ($i = 0; $i < 31; $i++) {
            AuditLog::create(['action' => 'auth.failed_login', 'description' => 'test', 'ip_address' => '203.0.113.' . $i, 'created_at' => now()]);
        }

        $this->artisan('security:watch --dry-run')->assertSuccessful();

        Mail::assertNothingSent();
    }
}
