<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Read-only production-readiness audit. Run it ON THE LIVE SERVER after every
 * deploy (and after editing .env):
 *
 *     php artisan security:check
 *
 * It only reports pass / warn / FAIL per setting. It never prints a secret:
 * for APP_KEY and similar it says only whether the value is present.
 *
 * Exit code: 1 when any check FAILS (so a deploy script can stop), otherwise 0.
 * Add --strict to treat warnings as failures too.
 *
 * Locally (APP_ENV=local, APP_DEBUG=true) it is expected to fail: it judges
 * the environment against the production targets in SECURITY_PHASES.
 */
class SecurityCheck extends Command
{
    protected $signature = 'security:check {--strict : Treat warnings as failures}';

    protected $description = 'Audit production safety settings (debug, key, HTTPS, cookies, CSP, HSTS, file exposure)';

    /** @var array<int, array{0: string, 1: string, 2: string}> status, label, detail */
    protected array $results = [];

    public function handle(): int
    {
        $this->checkEnvironment();
        $this->checkAppKey();
        $this->checkHttps();
        $this->checkLogging();
        $this->checkSecurityHeaders();
        $this->checkFileExposure();

        $fails = 0;
        $warns = 0;

        foreach ($this->results as [$status, $label, $detail]) {
            $tag = match ($status) {
                'pass' => '<info> PASS </info>',
                'warn' => '<comment> WARN </comment>',
                default => '<error> FAIL </error>',
            };
            $this->line("{$tag} {$label}" . ($detail !== '' ? " - {$detail}" : ''));

            $status === 'fail' && $fails++;
            $status === 'warn' && $warns++;
        }

        $this->newLine();
        $this->line(sprintf('%d failed, %d warning(s), %d passed.', $fails, $warns, count($this->results) - $fails - $warns));

        if ($fails > 0 || ($warns > 0 && $this->option('strict'))) {
            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    protected function add(string $status, string $label, string $detail = ''): void
    {
        $this->results[] = [$status, $label, $detail];
    }

    protected function checkEnvironment(): void
    {
        config('app.env') === 'production'
            ? $this->add('pass', 'APP_ENV is production')
            : $this->add('fail', 'APP_ENV is production', 'currently "' . config('app.env') . '"');

        config('app.debug') === false
            ? $this->add('pass', 'APP_DEBUG is false')
            : $this->add('fail', 'APP_DEBUG is false', 'debug pages can leak paths, SQL and environment details');
    }

    protected function checkAppKey(): void
    {
        // Presence only: the value is never printed.
        trim((string) config('app.key')) !== ''
            ? $this->add('pass', 'APP_KEY is set')
            : $this->add('fail', 'APP_KEY is set', 'run: php artisan key:generate');
    }

    protected function checkHttps(): void
    {
        str_starts_with((string) config('app.url'), 'https://')
            ? $this->add('pass', 'APP_URL uses https://')
            : $this->add('fail', 'APP_URL uses https://', 'links in emails and QR codes would be http');

        config('session.secure') === true
            ? $this->add('pass', 'SESSION_SECURE_COOKIE is true')
            : $this->add('warn', 'SESSION_SECURE_COOKIE is true', 'set it to true once HTTPS works everywhere');

        config('session.http_only') !== false
            ? $this->add('pass', 'Session cookie is HttpOnly')
            : $this->add('fail', 'Session cookie is HttpOnly', 'SESSION_HTTP_ONLY must not be false');
    }

    protected function checkLogging(): void
    {
        $stack = (array) config('logging.channels.stack.channels', []);
        $channel = config('logging.default') === 'stack' ? ($stack[0] ?? 'single') : config('logging.default');

        $level = strtolower((string) config("logging.channels.{$channel}.level", 'debug'));

        in_array($level, ['debug', 'info'], true)
            ? $this->add('warn', 'LOG_LEVEL is warning or higher', "currently \"{$level}\": noisy, and may log request details")
            : $this->add('pass', 'LOG_LEVEL is warning or higher');

        // A single ever-growing file is what produced a 20k-line laravel.log.
        $channel === 'single'
            ? $this->add('warn', 'Log files rotate', 'set LOG_STACK=daily so old logs are deleted after LOG_DAILY_DAYS')
            : $this->add('pass', 'Log files rotate');
    }

    protected function checkSecurityHeaders(): void
    {
        $csp = config('security.headers.csp', 'report-only');

        match ($csp) {
            'enforce' => $this->add('pass', 'CSP is enforced'),
            'off' => $this->add('fail', 'CSP is enforced', 'SECURITY_CSP=off sends no policy at all'),
            default => $this->add('warn', 'CSP is enforced', 'report-only blocks nothing; test the app, then set SECURITY_CSP=enforce'),
        };

        config('security.headers.hsts')
            ? $this->add('pass', 'HSTS is enabled')
            : $this->add('warn', 'HSTS is enabled', 'enable SECURITY_HSTS=true once HTTPS is confirmed everywhere (browsers remember it)');
    }

    protected function checkFileExposure(): void
    {
        // These must never sit inside the web root. (public/storage is NOT
        // listed: it is the normal `storage:link` symlink.)
        $exposed = [];
        foreach (['.env', '.git', 'composer.json', 'artisan', 'vendor', 'app'] as $name) {
            if (file_exists(public_path($name))) {
                $exposed[] = $name;
            }
        }

        $exposed === []
            ? $this->add('pass', 'No sensitive files inside public/')
            : $this->add('fail', 'No sensitive files inside public/', 'found: ' . implode(', ', $exposed));

        // Permission bits are meaningless on Windows (XAMPP), so skip there.
        $env = base_path('.env');
        if (DIRECTORY_SEPARATOR === '/' && is_file($env)) {
            (fileperms($env) & 0o077) === 0
                ? $this->add('pass', '.env is readable only by its owner')
                : $this->add('warn', '.env is readable only by its owner', 'run: chmod 600 .env');
        }
    }
}
