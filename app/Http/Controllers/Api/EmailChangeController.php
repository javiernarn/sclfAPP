<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\AccountUpdatedMail;
use App\Mail\EmailChangeMail;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use App\Services\Auth\EmailChangeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Profile page > "Change email" for students and instructors.
 *
 *  - Switched on/off with SCLF_EMAIL_CHANGE_ENABLED (config/sclf.php).
 *  - Student: must keep the school format occ.lastname.firstname@gmail.com and
 *    the lastname segment must match their Last name (same rule as register).
 *  - Instructor: any valid Gmail address.
 *  - Needs the CURRENT password, then a 6-digit code that was emailed to the
 *    NEW address, so nobody can point an account at an inbox they don't own.
 *  - After the switch every other session is signed out and the old address
 *    gets a warning (same AccountUpdatedMail the Admin screen uses).
 */
class EmailChangeController extends Controller
{
    public function __construct(protected AuditLogService $audit, protected EmailChangeService $changes)
    {
    }

    /** Is the form available to this account, and is a code already waiting? */
    public function status(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'enabled' => $this->changes->allowedFor($user),
            'pending_email' => $this->changes->allowedFor($user) ? $this->changes->pendingEmail($user) : null,
            'resend_in' => $this->changes->secondsUntilResend($user),
            'code_minutes' => (int) config('sclf.email_change.code_ttl_minutes', 15),
        ]);
    }

    /** Step 1: validate, check the password, email the code to the new address. */
    public function request(Request $request)
    {
        $user = $request->user();
        $this->guard($user);

        $request->merge(['new_email' => Str::lower(trim((string) $request->input('new_email')))]);

        $validated = $request->validate([
            'new_email' => $this->emailRules($user),
            'current_password' => ['required', 'string'],
        ], [
            'new_email.regex' => $user->hasRole('student')
                ? 'Email must follow the format occ.lastname.firstname@gmail.com (numbers after the first name are optional).'
                : 'Enter a valid Gmail address, e.g. juan.delacruz@gmail.com.',
            'new_email.unique' => 'That email address is already in use by another account.',
            'new_email.required' => 'Enter the new email address.',
        ]);

        if (! Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Your current password is incorrect.'],
            ]);
        }

        // Don't let "resend" be used to flood somebody's inbox.
        if ($this->changes->pendingEmail($user) === $validated['new_email']) {
            $wait = $this->changes->secondsUntilResend($user);
            if ($wait > 0) {
                return response()->json([
                    'message' => "Please wait {$wait} seconds before asking for another code.",
                    'resend_in' => $wait,
                ], 429);
            }
        }

        $code = $this->changes->issue($user, $validated['new_email']);
        $minutes = (int) config('sclf.email_change.code_ttl_minutes', 15);

        try {
            Mail::send(new EmailChangeMail($this->fullName($user), $validated['new_email'], $user->email, $code, $minutes));
        } catch (Throwable $e) {
            report($e);
            $this->changes->cancel($user);

            return response()->json([
                'message' => 'We could not send the code right now. Please try again in a few minutes.',
            ], 503);
        }

        $this->audit->log(
            'user.email_change_requested',
            $user,
            "User #{$user->id} asked to change their email address (code sent to the new address).",
        );

        return response()->json([
            'success' => true,
            'message' => 'We sent a 6-digit code to your new email address.',
            'sent_to' => $validated['new_email'],
            'expires_in_minutes' => $minutes,
            'resend_in' => (int) config('sclf.email_change.resend_after_seconds', 60),
        ]);
    }

    /** Step 2: the typed code switches the address. */
    public function confirm(Request $request, \App\Services\Auth\RefreshTokenService $tokens)
    {
        $user = $request->user();
        $this->guard($user);

        $request->validate(['code' => ['required', 'digits:6']]);

        [$result, $newEmail] = $this->changes->check($user, (string) $request->input('code'));

        if ($result !== EmailChangeService::OK) {
            $messages = [
                EmailChangeService::INVALID => 'That code is not correct. Please check it and try again.',
                EmailChangeService::EXPIRED => 'That code has expired. Go back and request a new one.',
                EmailChangeService::LOCKED => 'Too many wrong attempts. Go back and request a new code.',
            ];

            return response()->json(['message' => $messages[$result]], 422);
        }

        // Somebody could have registered this address while the code was out.
        // Same rules again, against the stored address, right before saving.
        $taken = User::where('email', $newEmail)->where('id', '!=', $user->id)->exists();
        if ($taken) {
            return response()->json(['message' => 'That email address was just taken by another account. Please choose a different one.'], 422);
        }

        $oldEmail = $user->email;

        // The code proved they own the new inbox, so it counts as verified.
        $user->forceFill(['email' => $newEmail, 'email_verified_at' => now()])->save();

        // Same rule as a password change: other devices must sign in again.
        // A real login has a PersonalAccessToken with an id; session/test auth
        // (TransientToken) has none, so read it defensively.
        $currentToken = $user->currentAccessToken();
        $currentTokenId = $currentToken instanceof \Laravel\Sanctum\PersonalAccessToken ? $currentToken->getKey() : null;
        $user->tokens()
            ->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))
            ->delete();
        $tokens->revokeAllForUser($user, $currentTokenId);

        $this->audit->log(
            'user.email_changed',
            $user,
            "User #{$user->id} changed their own email address.",
            ['email' => $oldEmail],
            ['email' => $newEmail],
        );

        try {
            Mail::send(new AccountUpdatedMail(
                $this->fullName($user),
                $oldEmail,
                [['label' => 'Email', 'old' => $oldEmail, 'new' => $newEmail]],
                false,
                'you, from the Profile page',
                rtrim(config('app.url'), '/') . '/login',
                toOldAddress: true,
            ));
        } catch (Throwable $e) {
            report($e);
        }

        return response()->json([
            'success' => true,
            'message' => 'Your email address has been changed.',
            'email' => $newEmail,
            'email_verified' => true,
        ]);
    }

    /** Throw away a waiting code (the "use a different email" link). */
    public function cancel(Request $request)
    {
        $this->changes->cancel($request->user());

        return response()->json(['success' => true]);
    }

    protected function guard(User $user): void
    {
        if (! $this->changes->isEnabled()) {
            abort(403, 'Changing your email is turned off right now.');
        }

        if (! $this->changes->allowedFor($user)) {
            abort(403, 'Only students and instructors can change their email here.');
        }
    }

    protected function fullName(User $user): string
    {
        return trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? '')) ?: (string) $user->name;
    }

    /**
     * Student  -> occ.lastname.firstname@gmail.com, lastname = their Last name.
     * Instructor -> any real-looking Gmail (6-30 letters/digits/dots, no
     *               leading/trailing/double dots — Gmail's own rules).
     */
    protected function emailRules(User $user): array
    {
        $common = [
            'required', 'string', 'email', 'max:255', 'lowercase',
            Rule::unique('users', 'email')->ignore($user->id),
            function ($attribute, $value, $fail) use ($user) {
                if (Str::lower((string) $value) === Str::lower((string) $user->email)) {
                    $fail('That is already your email address.');
                }
            },
        ];

        if ($user->hasRole('student')) {
            return array_merge($common, [
                'regex:/^occ\.[a-z]+\.[a-z]+\d{0,6}@gmail\.com$/',
                function ($attribute, $value, $fail) use ($user) {
                    $expected = $this->nameSegment((string) $user->last_name);
                    $actual = explode('.', Str::lower((string) $value))[1] ?? '';

                    if ($expected === '' || $actual !== $expected) {
                        $fail('The email must start with occ.' . ($expected ?: 'lastname') . '. so it matches your Last name.');
                    }
                },
            ]);
        }

        return array_merge($common, [
            'regex:/^(?![.])(?!.*\.\.)[a-z0-9.]{5,29}[a-z0-9]@gmail\.com$/',
        ]);
    }

    /** "De la Cruz" -> "delacruz" (same as AuthController::emailNameSegment). */
    protected function nameSegment(string $name): string
    {
        return preg_replace('/[^a-z]/', '', strtolower(Str::ascii($name)));
    }
}
