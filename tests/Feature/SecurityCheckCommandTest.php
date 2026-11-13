<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Handoff Phase 0: `php artisan security:check` audits production safety
 * settings and must never print a secret.
 */
class SecurityCheckCommandTest extends TestCase
{
    /** A configuration that satisfies every check. */
    protected function productionConfig(array $override = []): void
    {
        config(array_merge([
            'app.env' => 'production',
            'app.debug' => false,
            'app.key' => 'base64:' . base64_encode(str_repeat('k', 32)),
            'app.url' => 'https://lostandfound.example.test',
            'session.secure' => true,
            'session.http_only' => true,
            'logging.default' => 'stack',
            'logging.channels.stack.channels' => ['daily'],
            'logging.channels.daily.level' => 'warning',
            'security.headers.csp' => 'enforce',
            'security.headers.hsts' => true,
        ], $override));
    }

    public function test_a_fully_hardened_configuration_passes(): void
    {
        $this->productionConfig();

        $this->artisan('security:check')->assertExitCode(0);
    }

    public function test_debug_mode_fails_the_check(): void
    {
        $this->productionConfig(['app.debug' => true]);

        $this->artisan('security:check')
            ->expectsOutputToContain('APP_DEBUG is false')
            ->assertExitCode(1);
    }

    public function test_a_non_production_environment_fails_the_check(): void
    {
        $this->productionConfig(['app.env' => 'local']);

        $this->artisan('security:check')->assertExitCode(1);
    }

    public function test_csp_off_fails_but_report_only_only_warns(): void
    {
        $this->productionConfig(['security.headers.csp' => 'report-only']);
        $this->artisan('security:check')->assertExitCode(0);
        $this->artisan('security:check', ['--strict' => true])->assertExitCode(1);

        $this->productionConfig(['security.headers.csp' => 'off']);
        $this->artisan('security:check')->assertExitCode(1);
    }

    public function test_missing_hsts_is_a_warning_not_a_failure(): void
    {
        $this->productionConfig(['security.headers.hsts' => false]);

        $this->artisan('security:check')->assertExitCode(0);
        $this->artisan('security:check', ['--strict' => true])->assertExitCode(1);
    }

    public function test_the_app_key_is_never_printed(): void
    {
        $this->productionConfig(['app.key' => 'base64:SUPER-SECRET-KEY-VALUE']);

        Artisan::call('security:check');
        // output() empties its buffer when read, so read it once.
        $output = Artisan::output();

        $this->assertStringNotContainsString('SUPER-SECRET-KEY-VALUE', $output);
        $this->assertStringContainsString('APP_KEY is set', $output);
    }
}
