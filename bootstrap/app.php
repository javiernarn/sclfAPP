<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

// Windows/XAMPP: the openssl extension needs OPENSSL_CONF to find a valid
// openssl.cnf, or EC key operations (VAPID push encryption/signing) throw
// "Unable to create the key" / "Unable to create the local key". Setting
// it here — rather than relying on a shell/system environment variable —
// makes it work identically under Apache (mod_php), php artisan (CLI),
// and php artisan serve, without depending on how each was launched.
if (PHP_OS_FAMILY === 'Windows' && !getenv('OPENSSL_CONF')) {
    putenv('OPENSSL_CONF=' . dirname(__DIR__) . '/openssl.cnf');
}

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => \App\Http\Middleware\CheckRole::class,
            'account.active' => \App\Http\Middleware\EnsureAccountActive::class,
            'require.full_access' => \App\Http\Middleware\RequireFullAccess::class,
            'profile.setup' => \App\Http\Middleware\EnsureProfileSetupComplete::class,
            'email.verified' => \App\Http\Middleware\EnsureEmailVerified::class,
            'staff.approval' => \App\Http\Middleware\RequireStaffApproval::class,
            'daily.report' => \App\Http\Middleware\OneReportPerDay::class,
        ]);

        // Runs after the route so it can capture the response status code,
        // and after auth so $request->user() is populated when present —
        // see App\Http\Middleware\TrackUserActivity for what it records.
        // Default rate limit for the whole API (the `api` limiter is defined
        // in AppServiceProvider::configureRateLimiting).
        $middleware->throttleApi();

        // Trust the reverse proxy / CDN in front of the app, if there is one,
        // so $request->ip() and https detection are correct (rate limits,
        // audit logs, signed email links). Empty = trust nobody, which is
        // right for plain shared hosting. Cloudflare etc: TRUSTED_PROXIES=*
        // (only if the origin is reachable ONLY through that proxy).
        $trusted = env('TRUSTED_PROXIES');
        if (filled($trusted)) {
            $middleware->trustProxies(
                at: $trusted === '*' ? '*' : array_map('trim', explode(',', $trusted)),
            );
        }

        // Browser security headers on every response (see config/security.php).
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);

        $middleware->appendToGroup('api', [
            \App\Http\Middleware\TrackUserActivity::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // A missing / deleted record becomes a readable message ("deleted on
        // <date> by an Administrator") instead of Laravel's raw
        // "No query results for model [...]". See MissingRecordResponder.
        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\NotFoundHttpException $e, \Illuminate\Http\Request $request) {
            return app(\App\Support\MissingRecordResponder::class)->handle($e, $request);
        });
    })->create();