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
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();