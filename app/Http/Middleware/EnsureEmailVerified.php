<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks the API for accounts whose email has not been verified yet.
 *
 * Same idea as EnsureProfileSetupComplete: the React app sends unverified
 * people to /app/verify-email, and this makes the rule real on the server so
 * it cannot be skipped by calling the API directly.
 *
 * Only a few calls stay open so the person can see who they are, ask for a
 * new link, correct their email address, or sign out.
 */
class EnsureEmailVerified
{
    protected array $allowedPaths = [
        'api/me',
        'api/logout',
        'api/email/verification-notification',
        'api/email/verify-code',
        // Someone who mistyped their address at sign-up must be able to fix it:
        // the change needs the current password plus a code sent to the new
        // inbox, and confirming it marks the new address as verified.
        'api/profile/email/*',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->hasVerifiedEmail() && ! $request->is(...$this->allowedPaths)) {
            return response()->json([
                'code' => 'email_unverified',
                'message' => 'Please verify your email address to continue. Check your inbox for the link, or request a new one.',
            ], 403);
        }

        return $next($request);
    }
}
