<?php

namespace App\Http\Controllers\Api;

use App\Rules\FormalProfilePhoto;
use App\Support\PrivateMedia;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use App\Services\Auth\RefreshTokenReuseException;
use App\Services\Auth\RefreshTokenService;
use App\Support\RefreshCookie;
use App\Services\Auth\SessionDisplacedException;
use App\Services\Auth\TwoFactorAuthService;
use Illuminate\Http\Request;
// use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    // Login lockout: 5 failed attempts, then a 10-minute cooldown before
    // the next attempt is allowed — keyed per email+IP so one person
    // mistyping their password can't lock out everyone behind the same
    // network, and switching emails doesn't reset someone else's lockout.
    private const LOGIN_MAX_ATTEMPTS = 5;
    private const LOGIN_DECAY_SECONDS = 600; // 10 minutes

    public function __construct(
        protected AuditLogService $audit,
        protected RefreshTokenService $tokens,
        protected TwoFactorAuthService $twoFactor,
    ) {
    }

    /**
     * The user+roles shape returned by register/login/me/2FA-verify.
     * Pulled into one place so all four response sites stay in sync —
     * in particular so two_factor_enabled is never accidentally missing
     * from one of them (the frontend's Profile page depends on it to
     * decide which Security-card state to render).
     */
    private function userPayload(User $user): array
    {
        // Accounts inserted without going through Eloquent (old seeds/imports)
        // get their dashboard token the first time they load their profile.
        if (empty($user->public_token)) {
            $user->forceFill(['public_token' => bin2hex(random_bytes(16))])->saveQuietly();
        }

        return [
            'user' => array_merge($user->only(
                'id', 'name', 'first_name', 'last_name', 'email', 'phone_number',
                'address', 'gender', 'student_id', 'staff_id', 'display_id', 'course', 'teaching_course',
                'profile_picture_url', 'two_factor_enabled', 'must_setup_profile', 'public_token',
                'email_notifications', 'auto_save'
            ), [
                // The React app sends unverified accounts to /app/verify-email.
                'email_verified' => $user->hasVerifiedEmail(),
                // Profile page shows the "Change email" form only when this is true
                // (SCLF_EMAIL_CHANGE_ENABLED in .env AND the account is a student/instructor).
                'email_change_enabled' => app(\App\Services\Auth\EmailChangeService::class)->allowedFor($user),
            ]),
            'roles' => $user->getRoleNames(),
        ];
    }

    private function loginThrottleKey(Request $request): string
    {
        return Str::lower($request->input('email')) . '|' . $request->ip();
    }

    /**
     * Lightweight uniqueness probe used by the multi-step Register form
     * (and the Admin "Create Account" form): lets the frontend block
     * "Next"/"Create Account" the moment a phone/email/student ID is
     * already registered to someone else, instead of only discovering the
     * collision after the whole form is filled out and submitted.
     *
     * Intentionally does NOT reveal *whose* account it belongs to — only
     * whether the value is taken — to avoid leaking account existence
     * details beyond what's needed.
     */
    public function checkAvailability(Request $request)
    {
        $validated = $request->validate([
            'field' => 'required|string|in:email,phone_number,student_id',
            'value' => 'required|string|max:255',
        ]);

        $value = $validated['field'] === 'email'
            ? strtolower(trim($validated['value']))
            : trim($validated['value']);

        // withTrashed() so this matches the same 'unique:users' rule used
        // by the real registration/admin-create endpoints, which checks
        // the raw table and therefore still counts disabled/archived
        // (soft-deleted) accounts as taken.
        $taken = User::withTrashed()->where($validated['field'], $value)->exists();

        return response()->json([
            'available' => !$taken,
        ]);
    }

    /**
     * "De la Cruz" -> "delacruz", "Peña-Reyes" -> "penareyes": a name as it
     * appears inside the occ.lastname.firstname email. Mirrors
     * emailNameSegment() in resources/js/utils/validators.js.
     */
    private static function emailNameSegment(string $name): string
    {
        $ascii = \Illuminate\Support\Str::ascii($name);

        return preg_replace('/[^a-z]/', '', strtolower($ascii));
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255', 'regex:/^[\pL\s\'-]+$/u'],
            'last_name' => ['required', 'string', 'max:255', 'regex:/^[\pL\s\'-]+$/u'],
            // Institutional email convention: occ.lastname.firstname@gmail.com
            // (optional digits after the first name). The lastname segment
            // must equal the Last name submitted on the form.
            'email' => [
                'required', 'string', 'email', 'max:255', 'lowercase', 'unique:users',
                'regex:/^occ\.[a-z]+\.[a-z]+\d{0,6}@gmail\.com$/i',
                function ($attribute, $value, $fail) use ($request) {
                    $expected = self::emailNameSegment((string) $request->input('last_name'));
                    $actual = explode('.', strtolower((string) $value))[1] ?? '';

                    if ($expected === '' || $actual !== $expected) {
                        $fail('The email must start with occ.' . ($expected ?: 'lastname') . '. so it matches your Last name.');
                    }
                },
            ],
            // Philippine mobile numbers: 11 digits starting with 09.
            'phone_number' => ['required', 'string', 'regex:/^09\d{9}$/', 'unique:users,phone_number'],
            'address' => 'required|string|max:255',
            'gender' => 'required|string|in:male,female,other,prefer_not_to_say',
            // School ID convention: YYYY-N-NNNNN, e.g. 2021-2-04062.
            'student_id' => ['required', 'string', 'max:50', 'regex:/^\d{4}-\d-\d{5}$/', 'unique:users'],
            'course' => 'required|string|max:255',
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
            'profile_picture' => ['required', 'image', 'max:5120', new FormalProfilePhoto],
        ], [
            'profile_picture.required' => 'A profile picture is required so staff can verify you at a glance.',
            'first_name.regex' => 'First name can only contain letters, spaces, hyphens and apostrophes.',
            'last_name.regex' => 'Last name can only contain letters, spaces, hyphens and apostrophes.',
            'email.regex' => 'Email must follow the format occ.lastname.firstname@gmail.com (numbers after the first name are optional).',
            'email.unique' => 'That email address is already in use by another account. Please sign in instead, or use a different email.',
            'phone_number.regex' => 'Enter a valid Philippine mobile number, e.g. 09171234567.',
            'phone_number.unique' => 'That phone number is already linked to another account.',
            'student_id.regex' => 'Student ID must follow the format YYYY-N-NNNNN, e.g. 2021-2-04062.',
            'student_id.unique' => 'That student ID is already registered to another account. If this is your ID, please sign in or contact an administrator.',
        ]);

        $profilePicturePath = null;
        if ($request->hasFile('profile_picture')) {
            $profilePicturePath = $request->file('profile_picture')->store('profile-pictures', PrivateMedia::DISK);
        }

        $user = User::create([
            'name' => trim($validated['first_name'] . ' ' . $validated['last_name']),
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'],
            'address' => $validated['address'],
            'gender' => $validated['gender'],
            'student_id' => $validated['student_id'],
            'course' => $validated['course'],
            'profile_picture' => $profilePicturePath,
            'password' => Hash::make($validated['password']),
        ]);

        $user->assignRole('student');

        $this->audit->log('user.registered', $user, "Student account #{$user->id} self-registered.");

        // Self-registered accounts must prove they own the email address.
        // They are signed in so they can see the "check your email" screen
        // and ask for a new link, but EnsureEmailVerified keeps the rest of
        // the API closed until they click the link.
        EmailVerificationController::send($user);

        $pair = $this->tokens->issue($user, $request);

        // Registering signs them straight in, so this counts as their
        // first session — their next login is a "Welcome back".
        $user->recordLogin();

        return RefreshCookie::respond($request, array_merge(
            $this->userPayload($user),
            [
                'first_login' => true,
                'access_token' => $pair['access_token'],
                'expires_in' => $pair['expires_in'],
            ]
        ), $pair['refresh_token'], true, 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $throttleKey = $this->loginThrottleKey($request);

        if (RateLimiter::tooManyAttempts($throttleKey, self::LOGIN_MAX_ATTEMPTS)) {
            $minutes = (int) ceil(RateLimiter::availableIn($throttleKey) / 60);

            $this->audit->log('auth.throttled_login', null, "Login throttled for email '{$request->email}' after too many attempts.");

            throw ValidationException::withMessages([
                'email' => ["Too many login attempts. Please try again in {$minutes} minute" . ($minutes === 1 ? '' : 's') . '.'],
            ]);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            RateLimiter::hit($throttleKey, self::LOGIN_DECAY_SECONDS);

            $this->audit->log('auth.failed_login', null, "Failed login attempt for email '{$request->email}'.", null, null, $user);

            $remaining = self::LOGIN_MAX_ATTEMPTS - RateLimiter::attempts($throttleKey);
            $message = $remaining > 0
                ? "The provided credentials are incorrect. {$remaining} attempt" . ($remaining === 1 ? '' : 's') . ' remaining before your account is temporarily locked.'
                : 'Too many login attempts. Please try again in 10 minutes.';

            throw ValidationException::withMessages([
                'email' => [$message],
            ]);
        }

        if (!$user->is_active) {
            $this->audit->log('auth.blocked_login', $user, "Login blocked — account #{$user->id} is disabled.");

            throw ValidationException::withMessages([
                'email' => ['This account has been disabled. Please contact an administrator.'],
            ]);
        }

        RateLimiter::clear($throttleKey);

        // Pass $user as the actor: no one is authenticated yet at this point, so
        // without it user_id is saved as null and the Audit Log shows no name.
        $this->audit->log('auth.login', $user, "User #{$user->id} logged in.", actor: $user);

        if ($this->twoFactor->isEnabled($user)) {
            // Don't hand out a real, usable token yet — just a narrowly
            // scoped, short-lived one that RequireFullAccess will reject
            // everywhere except the verify endpoint. The frontend uses
            // two_factor_required to switch the login form into the
            // OTP-entry step instead of navigating into the app.
            return response()->json([
                'two_factor_required' => true,
                'temp_token' => $this->tokens->issuePendingTwoFactorToken($user),
            ]);
        }

        $pair = $this->tokens->issue($user, $request);

        $firstLogin = $user->recordLogin();

        // "Keep me signed in" -> a 30-day refresh cookie; otherwise a session cookie.
        return RefreshCookie::respond($request, array_merge(
            $this->userPayload($user),
            [
                'first_login' => $firstLogin,
                'access_token' => $pair['access_token'],
                'expires_in' => $pair['expires_in'],
            ]
        ), $pair['refresh_token'], $request->boolean('remember'));
    }

    /**
     * Exchange a still-valid, not-yet-rotated refresh token for a new
     * access+refresh pair. Deliberately NOT behind auth:sanctum — by the
     * time a client needs this, its access token has usually already
     * expired, so there's nothing valid to authenticate the request with
     * except the refresh token itself.
     */
    public function refreshToken(Request $request)
    {
        // Cookie mode: the token only ever comes from the HttpOnly cookie. A
        // refresh token in the request body is accepted only when the cookie
        // switch is off (legacy mode) or SCLF_REFRESH_ALLOW_BODY=true.
        $bodyAllowed = ! RefreshCookie::enabled() || config('sclf.refresh_cookie.allow_body', false);
        $raw = RefreshCookie::read($request) ?? ($bodyAllowed ? $request->input('refresh_token') : null);

        if (! is_string($raw) || $raw === '') {
            return RefreshCookie::forget($request, response()->json([
                'message' => 'Your session has expired. Please sign in again.',
                'errors' => ['refresh_token' => ['Your session has expired. Please sign in again.']],
            ], 422));
        }

        try {
            $pair = $this->tokens->rotate($raw, $request);
        } catch (SessionDisplacedException $e) {
            // 401 + machine-readable code: the frontend shows the
            // "signed in on another device" alert instead of a generic
            // session-expired toast.
            return RefreshCookie::forget($request, response()->json([
                'message' => $e->getMessage(),
                'code' => 'session_displaced',
                'device' => $e->device,
            ], 401));
        } catch (RefreshTokenReuseException $e) {
            return RefreshCookie::forget($request, response()->json([
                'message' => $e->getMessage(),
                'errors' => ['refresh_token' => [$e->getMessage()]],
            ], 422));
        } catch (\RuntimeException $e) {
            return RefreshCookie::forget($request, response()->json([
                'message' => 'Your session has expired. Please sign in again.',
                'errors' => ['refresh_token' => ['Your session has expired. Please sign in again.']],
            ], 422));
        }

        // The browser app tells us whether this session was a "keep me signed
        // in" one, so the rotated cookie keeps the same lifetime.
        return RefreshCookie::respond($request, [
            'access_token' => $pair['access_token'],
            'expires_in' => $pair['expires_in'],
        ], $pair['refresh_token'], $request->boolean('remember'));
    }

    public function logout(Request $request)
    {
        $this->audit->log('auth.logout', $request->user(), "User #{$request->user()->id} logged out.");

        $accessTokenId = $request->user()->currentAccessToken()->id;
        $this->tokens->revokeForAccessToken($accessTokenId);
        $request->user()->currentAccessToken()->delete();

        return RefreshCookie::forget($request, response()->json(['message' => 'Logged out successfully']));
    }

    public function me(Request $request)
    {
        return response()->json($this->userPayload($request->user()));
    }

    /**
     * Change the password for the currently authenticated user.
     *
     * Unlike the public forgot/reset-password flow (PasswordResetController),
     * this requires the user's *current* password rather than an emailed
     * token — the standard "change password while logged in" flow, shown
     * from the Profile page's Security card.
     */
    public function changePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Your current password is incorrect.'],
            ]);
        }

        if (Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Your new password must be different from your current password.'],
            ]);
        }

        $user->forceFill([
            'password' => Hash::make($validated['password']),
        ])->save();

        // Revoke every other active token (other devices/sessions) and keep
        // only the one used to make this request, so a changed password
        // actually locks out anyone who might have an old session.
        $currentTokenId = $user->currentAccessToken()?->id;
        $user->tokens()->where('id', '!=', $currentTokenId)->delete();
        $this->tokens->revokeAllForUser($user, $currentTokenId);

        return response()->json([
            'success' => true,
            'message' => 'Your password has been changed successfully.',
        ]);
    }
}