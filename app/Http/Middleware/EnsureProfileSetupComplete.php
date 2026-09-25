<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks every protected endpoint except a short allow-list until an
 * admin-created staff account (instructor / security_officer / admin —
 * see User::$must_setup_profile) has been through the mandatory
 * SetupAccountPage on the frontend. This is the server-side half of that
 * gate: the frontend redirects the person there on its own, but this
 * middleware is what actually stops the API from doing anything else for
 * that account in the meantime — a directly-called endpoint (Postman,
 * browser devtools, a stale tab) is blocked exactly the same as the UI.
 *
 * A student account never has this flag set (they self-register with
 * their own chosen credentials via AuthController::register()), so this
 * middleware is a no-op for them.
 */
class EnsureProfileSetupComplete
{
    /**
     * Paths (relative to the app root, i.e. including the "api/" prefix)
     * reachable even while must_setup_profile is still true — just enough
     * for the frontend's onboarding screen to function: confirm who's
     * signed in, submit the setup form itself, and back out via logout if
     * they landed on the wrong account.
     */
    protected array $allowedPaths = [
        'api/me',
        'api/logout',
        'api/profile/complete-setup',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_setup_profile && !$request->is(...$this->allowedPaths)) {
            abort(423, 'Please finish setting up your account before continuing.');
        }

        return $next($request);
    }
}
