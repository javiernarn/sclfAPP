<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use App\Services\Auth\RefreshTokenService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;

class PasswordResetController extends Controller
{
    // Find-account lockout: 5 attempts, then a 10-minute cooldown — same
    // shape as the login lockout in Api\AuthController, keyed per
    // email+IP so it can't be used to lock other people out.
    private const FIND_MAX_ATTEMPTS = 5;
    private const FIND_DECAY_SECONDS = 600; // 10 minutes

    // Same wording whether or not the email is registered, so this endpoint
    // can't be used to find out who has an account.
    private const GENERIC_FOUND = 'If an account exists for this email, you can request a reset link.';
    private const GENERIC_SENT = 'If an account exists for this email, a password reset link has been sent.';

    public function __construct(
        protected AuditLogService $audit,
        protected RefreshTokenService $tokens,
    ) {
    }

    private function findThrottleKey(Request $request): string
    {
        return 'find-account|' . Str::lower($request->input('email')) . '|' . $request->ip();
    }

    /**
     * Step 1 of the recovery flow. Kept as a separate step so the UI flow is
     * unchanged, but it no longer looks anything up: every email gets the
     * same answer (see GENERIC_FOUND), so it cannot be used to discover which
     * students have an account or what their names are.
     */
    public function findAccount(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $throttleKey = $this->findThrottleKey($request);

        if (RateLimiter::tooManyAttempts($throttleKey, self::FIND_MAX_ATTEMPTS)) {
            $minutes = (int) ceil(RateLimiter::availableIn($throttleKey) / 60);

            return response()->json([
                'success' => false,
                'message' => "Too many attempts. Please try again in {$minutes} minute" . ($minutes === 1 ? '' : 's') . '.',
            ], 429);
        }

        RateLimiter::hit($throttleKey, self::FIND_DECAY_SECONDS);

        // Never reveal whether the account exists, and never echo back a
        // stored name. Only the caller's own input is returned.
        return response()->json([
            'success' => true,
            'message' => self::GENERIC_FOUND,
            'data' => [
                'email' => strtolower(trim($request->email)),
            ],
        ]);
    }

    /**
     * Step 2: email a password reset link to the (already confirmed)
     * account. Also used to resend the link — clicking it again from the
     * "Account found" screen simply queues another email.
     */
    public function sendResetLink(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = strtolower(trim($request->email));

        // Send after the response goes out so a registered address (which
        // has to build and send an email) can't be told apart from an
        // unknown one by response time. Laravel's own broker still applies
        // its 60-second per-account throttle.
        dispatch(function () use ($email) {
            Password::sendResetLink(['email' => $email]);
        })->afterResponse();

        return response()->json([
            'success' => true,
            'message' => self::GENERIC_SENT,
        ]);
    }

    /**
     * Reset the password for the given token/email pair.
     */
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                // A reset means the old password may have been compromised,
                // so end every session that was opened with it (all devices,
                // access + refresh tokens) and make the person sign in again.
                $user->tokens()->delete();
                $this->tokens->revokeAllForUser($user);

                $this->audit->log(
                    'auth.password_reset',
                    $user,
                    "Password for user #{$user->id} was reset through the email link; all sessions were signed out.",
                    null,
                    null,
                    $user,
                );

                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'success' => true,
                'message' => 'Your password has been reset successfully.',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => __($status),
        ], 422);
    }
}
