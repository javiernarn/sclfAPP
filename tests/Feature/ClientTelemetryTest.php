<?php

namespace Tests\Feature;

use App\Models\UserActivity;
use App\Support\ClientTelemetry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class ClientTelemetryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        RateLimiter::clear('client-telemetry-global');
    }

    /** Capture what the "client" channel is asked to write. */
    private function spyLog(): \ArrayObject
    {
        $captured = new \ArrayObject();
        $channel = \Mockery::mock();
        foreach (['error', 'info', 'warning'] as $level) {
            $channel->shouldReceive($level)->andReturnUsing(function ($msg, $ctx = []) use ($captured, $level) {
                $captured->append(['level' => $level, 'message' => $msg, 'context' => $ctx]);
            });
        }
        Log::shouldReceive('channel')->with('client')->andReturn($channel);

        return $captured;
    }

    private function send(array $payload)
    {
        return $this->call('POST', '/api/client-errors', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode($payload));
    }

    public function test_a_crash_is_accepted_without_login_and_logged(): void
    {
        $logged = $this->spyLog();

        $this->send(['type' => 'error', 'message' => 'x is not a function', 'stack' => "TypeError: x\n at a.js:1:2", 'url' => 'https://app.test/app/claims/42?token=abc'])
            ->assertNoContent();

        $this->assertCount(1, $logged);
        $this->assertSame('client_error', $logged[0]['message']);
        $this->assertSame('/app/claims/:id', $logged[0]['context']['path']);
    }

    public function test_personal_data_is_masked_even_if_the_browser_sent_it(): void
    {
        $logged = $this->spyLog();

        $this->send([
            'type' => 'error',
            'message' => 'Failed for juan.delacruz@school.edu phone 09171234567 ' . str_repeat('a', 40) . ' at https://app.test/x?email=a@b.co#frag',
            'stack' => 'at https://app.test/build/main-Abc123.js?secret=1:10:5',
        ])->assertNoContent();

        $json = json_encode($logged->getArrayCopy());
        $this->assertStringNotContainsString('juan.delacruz', $json);
        $this->assertStringNotContainsString('09171234567', $json);
        $this->assertStringNotContainsString(str_repeat('a', 40), $json);
        $this->assertStringNotContainsString('secret=1', $json);
        $this->assertStringNotContainsString('email=a@b.co', $json);
        $this->assertStringContainsString('[email]', $json);
    }

    public function test_no_user_id_or_ip_is_logged_for_a_signed_in_user(): void
    {
        $logged = $this->spyLog();
        $user = \App\Models\User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->call('POST', '/api/client-errors', [], [], [], ['CONTENT_TYPE' => 'application/json', 'REMOTE_ADDR' => '203.0.113.9'], json_encode(['type' => 'error', 'message' => 'boom']))
            ->assertNoContent();

        $json = json_encode($logged->getArrayCopy());
        $this->assertStringNotContainsString('203.0.113.9', $json);
        $this->assertArrayNotHasKey('user_id', $logged[0]['context']);
        $this->assertArrayNotHasKey('ip', $logged[0]['context']);
    }

    public function test_the_same_error_is_logged_once_per_window(): void
    {
        $logged = $this->spyLog();
        $payload = ['type' => 'error', 'message' => 'same bug', 'stack' => 'at a.js:10:1'];

        $this->send($payload)->assertNoContent();
        $this->send(array_merge($payload, ['stack' => 'at a.js:99:7']))->assertNoContent(); // only line numbers differ
        $this->send(['type' => 'error', 'message' => 'a different bug'])->assertNoContent();

        $this->assertCount(2, $logged);
    }

    public function test_oversized_bodies_and_bad_shapes_are_refused(): void
    {
        $this->spyLog();

        $this->send(['type' => 'error', 'message' => str_repeat('x', 20000)])->assertStatus(413);
        $this->call('POST', '/api/client-errors', [], [], [], ['CONTENT_TYPE' => 'application/json'], 'not json')->assertStatus(422);
        $this->send(['type' => 'something-else', 'message' => 'x'])->assertStatus(422);
    }

    public function test_web_vitals_keep_only_known_metrics(): void
    {
        $logged = $this->spyLog();

        $this->send(['type' => 'vitals', 'path' => '/app/dashboard', 'metrics' => [
            ['name' => 'LCP', 'value' => 2410.6, 'rating' => 'good'],
            ['name' => 'CLS', 'value' => 0.01234, 'rating' => 'good'],
            ['name' => 'EVIL', 'value' => 1],
            ['name' => 'INP', 'value' => 'abc'],
        ]])->assertNoContent();

        $this->assertSame('web_vitals', $logged[0]['message']);
        $this->assertSame(['LCP', 'CLS'], array_keys($logged[0]['context']['metrics']));
        $this->assertSame(0.0123, $logged[0]['context']['metrics']['CLS']['value']);
    }

    public function test_csp_reports_in_the_browsers_own_format_are_logged_and_extensions_ignored(): void
    {
        $logged = $this->spyLog();

        $this->call('POST', '/api/client-errors', [], [], [], ['CONTENT_TYPE' => 'application/csp-report'], json_encode(['csp-report' => [
            'document-uri' => 'https://app.test/app/dashboard?x=1', 'effective-directive' => 'script-src-elem',
            'blocked-uri' => 'https://evil.test/a.js?u=1', 'disposition' => 'report',
        ]]))->assertNoContent();
        $this->call('POST', '/api/client-errors', [], [], [], ['CONTENT_TYPE' => 'application/csp-report'], json_encode(['csp-report' => [
            'document-uri' => 'https://app.test/', 'effective-directive' => 'script-src-elem', 'blocked-uri' => 'chrome-extension://abc/x.js',
        ]]))->assertNoContent();

        $this->assertCount(1, $logged);
        $this->assertSame('csp_violation', $logged[0]['message']);
        $this->assertStringNotContainsString('u=1', json_encode($logged->getArrayCopy()));
    }

    public function test_it_is_throttled_per_address(): void
    {
        $this->spyLog();

        for ($i = 0; $i < 120; $i++) {
            $this->send(['type' => 'error', 'message' => "e$i"])->assertNoContent();
        }
        $this->send(['type' => 'error', 'message' => 'one too many'])->assertStatus(429);
    }

    public function test_it_can_be_switched_off(): void
    {
        config(['sclf.telemetry.enabled' => false]);
        Log::shouldReceive('channel')->never();

        $this->send(['type' => 'error', 'message' => 'x'])->assertNoContent();
    }

    public function test_beacons_do_not_pollute_the_user_activity_log(): void
    {
        // Independent of the developer's .env: tracking must be ON for this to mean anything.
        config(['sclf.activity.enabled' => true]);
        $this->spyLog();

        $this->send(['type' => 'error', 'message' => 'x'])->assertNoContent();

        $this->assertSame(0, UserActivity::count());
    }

    public function test_scrub_helpers(): void
    {
        $this->assertSame('/app/lost/:id/edit', ClientTelemetry::path('/app/lost/123/edit?a=1'));
        $this->assertSame('/a/:id', ClientTelemetry::path('https://h.test/a/3f2504e0-4f89-11d3-9a0c-0305e82c3301'));
        $this->assertSame('', ClientTelemetry::path(null));
        $this->assertSame(ClientTelemetry::fingerprint('error', 'm 1', "a.js:1"), ClientTelemetry::fingerprint('error', 'm 2', "a.js:9"));
    }

    public function test_the_csp_header_points_reports_at_the_collector(): void
    {
        config(['security.headers.csp' => 'report-only']);

        $response = $this->get('/login');

        $this->assertStringContainsString('report-uri /api/client-errors', (string) $response->headers->get('Content-Security-Policy-Report-Only'));
    }
}
