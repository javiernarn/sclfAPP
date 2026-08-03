<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
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

    private function findThrottleKey(Request $request): string
    {
        return 'find-account|' . Str::lower($request->input('email')) . '|' . $request->ip();
    }

    /**
     * Step 1 of the recovery flow: look up the account by email.
     *
     * Mirrors the Alumni system's "Find my account" step exactly — on a
     * match it hands back the name/email so the UI can show a masked
     * "Account found" confirmation before offering to email a reset link.
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

        $email = strtolower(trim($request->email));
        $user = User::where('email', $email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'No account found with this email address.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Account found',
            'data' => [
                'full_name' => trim($user->first_name . ' ' . $user->last_name) ?: $user->name,
                'email' => $user->email,
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

        if (!User::where('email', $email)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'No account found with this email address.',
            ], 404);
        }

        Password::sendResetLink(['email' => $email]);

        return response()->json([
            'success' => true,
            'message' => 'Password reset link has been sent to your email.',
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
