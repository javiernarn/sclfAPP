<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use App\Services\Auth\RefreshTokenService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
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

    // Plain-language messages for a reset link that can't be used any more.
    // Deliberately identical for "no such account", "wrong token", "already
    // used" and "replaced by a newer link" so the page can't be used to learn
    // anything about who has an account.
    private const LINK_INVALID = 'This reset link is no longer valid. It may have already been used, been replaced by a newer link, or never belonged to this account. Please request a new link.';
    private const LINK_EXPIRED = 'This reset link has expired. For your security, links only work for a short time. Please request a new one.';

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
     * Work out whether a reset link can still be used, without changing
     * anything. Returns 'ok', 'expired' or 'invalid'.
     *
     * Laravel keeps exactly ONE row per account in password_reset_tokens:
     *  - asking for a new link replaces the old row (so the older email's
     *    link stops working), and
     *  - a successful reset deletes the row (so the same link can never be
     *    used twice).
     * "No row / wrong token / unknown account" are therefore all reported
     * as 'invalid' on purpose — see LINK_INVALID.
     */
    private function linkState(string $email, string $token): string
    {
        $user = User::where('email', $email)->first();
        if (! $user) {
            return 'invalid';
        }

        $table = config('auth.passwords.users.table', 'password_reset_tokens');
        $row = DB::table($table)->where('email', $user->getEmailForPasswordReset())->first();

        if (! $row || ! Hash::check($token, $row->token)) {
            return 'invalid';
        }

        $minutes = (int) config('auth.passwords.users.expire', 60);
        if (Carbon::parse($row->created_at)->addMinutes($minutes)->isPast()) {
            return 'expired';
        }

        return 'ok';
    }

    /**
     * Called by the Reset Password page the moment it opens (and again if the
     * browser restores it from the back/forward cache), so a link that was
     * already used / expired / replaced shows "link no longer valid" straight
     * away instead of letting the person type a new password first.
     *
     * Always answers 200 — an unusable link is a normal outcome, not an error.
     */
    public function checkToken(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
        ]);

        $state = $this->linkState(strtolower(trim($request->email)), (string) $request->token);

        return response()->json([
            'success' => true,
            'data' => [
                'valid' => $state === 'ok',
                'reason' => $state,
                'message' => match ($state) {
                    'expired' => self::LINK_EXPIRED,
                    'invalid' => self::LINK_INVALID,
                    default => null,
                },
            ],
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
                'message' => 'Your password has been reset successfully. You can now sign in with your new password.',
            ]);
        }

        // Too many reset attempts on this account in a short time.
        if ($status === Password::RESET_THROTTLED) {
            return response()->json([
                'success' => false,
                'code' => 'throttled',
                'message' => 'Too many attempts. Please wait a minute and try again.',
            ], 429);
        }

        // Link already used / expired / replaced / wrong account. `code` lets
        // the page swap the form for the "link no longer valid" screen.
        $state = $this->linkState(strtolower(trim($request->email)), (string) $request->token);

        return response()->json([
            'success' => false,
            'code' => $state === 'expired' ? 'link_expired' : 'link_invalid',
            'message' => $state === 'expired' ? self::LINK_EXPIRED : self::LINK_INVALID,
        ], 422);
    }
}
