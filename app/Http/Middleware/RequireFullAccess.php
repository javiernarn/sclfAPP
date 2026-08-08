<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A "2fa-pending" token is issued the moment a password check succeeds for
 * an account with 2FA enabled — it proves "this client knows the
 * password" but NOT "this client passed the second factor". It should be
 * usable for exactly one thing: POST /2fa/login-verify. Apply this
 * middleware to every other protected route (alongside auth:sanctum) so a
 * leaked or intercepted pending token can't be used to touch real data —
 * only auth:sanctum is applied to the verify endpoint itself, so a
 * pending token is scoped as narrowly as it looks like it should be.
 */
class RequireFullAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->user()?->currentAccessToken();

        // Sanctum's can() treats a wildcard ability as matching anything,
        // so checking can('2fa-pending') directly would also be true for
        // a normal full-access token — the actual test is "does this
        // token NOT have full access", since the only two kinds of token
        // this app issues are full-access (['*']) and pending-2FA
        // (['2fa-pending']).
        if ($token && method_exists($token, 'can') && !$token->can('*')) {
            abort(403, 'Two-factor verification required before this account can be used.');
        }

        return $next($request);
    }
}
