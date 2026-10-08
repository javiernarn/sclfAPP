<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function __construct(protected AuditLogService $audit)
    {
    }

    /**
     * One-time mandatory setup for an admin-created staff account
     * (instructor / security_officer / admin). Reached only while
     * must_setup_profile is true — EnsureProfileSetupComplete blocks
     * every other endpoint until this succeeds, and the frontend routes
     * straight here on first login (see SetupAccountPage.jsx).
     *
     * Requires the person to actually replace what the admin set on
     * their behalf — a new password only they know, and their own name
     * and photo — rather than just acknowledging a notice. Phone/gender
     * stay optional (same as the admin "Create Account" form) since not
     * every role or campus collects those.
     *
     * The ID number (staff_id) is theirs to enter here too. Accounts start
     * with a system-generated placeholder (SEC-2026-0001, or the seeded
     * admin's .env value), but the real person knows their real school ID,
     * so it is required and editable — uniqueness is still enforced.
     * The one seeded Admin account can additionally replace its email
     * (the seed value belongs to whoever installed the system, not to the
     * school's actual administrator).
     */
    public function completeSetup(Request $request)
    {
        $user = $request->user();

        // The 'api' middleware group doesn't run ConvertEmptyStringsToNull
        // (unlike 'web'), so a field left blank on purpose arrives as ""
        // rather than null — normalize before validating 'nullable' rules
        // against it (same fix already applied in Admin\UserController::update()).
        foreach (['phone_number', 'gender'] as $nullableField) {
            if ($request->has($nullableField) && $request->input($nullableField) === '') {
                $request->merge([$nullableField => null]);
            }
        }

        // Normalise before validating so the uniqueness checks compare what
        // will actually be stored: IDs are kept uppercase, emails lowercase.
        if ($request->filled('staff_id')) {
            $request->merge(['staff_id' => strtoupper(trim((string) $request->input('staff_id')))]);
        }
        if ($request->filled('email')) {
            $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        }

        // Same normalisation for the optional address.
        if ($request->has('address') && trim((string) $request->input('address')) === '') {
            $request->merge(['address' => null]);
        }

        $emailRules = $user->isAdmin()
            ? ['required', 'email', 'max:255', 'lowercase', Rule::unique('users', 'email')->ignore($user->id)]
            : ['prohibited'];

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255', 'regex:/^[\pL\s\'-]+$/u'],
            'last_name' => ['required', 'string', 'max:255', 'regex:/^[\pL\s\'-]+$/u'],
            // ID number shown on the account (Admin ID / Staff ID / ...).
            'staff_id' => [
                'required', 'string', 'min:3', 'max:50',
                'regex:/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/',
                Rule::unique('users', 'staff_id')->ignore($user->id),
            ],
            'email' => $emailRules,
            'address' => ['nullable', 'string', 'max:255'],
            'phone_number' => [
                'nullable', 'string', 'regex:/^09\d{9}$/',
                Rule::unique('users', 'phone_number')->ignore($user->id),
            ],
            'gender' => ['nullable', 'string', 'in:male,female,other,prefer_not_to_say'],
            'profile_picture' => ['required', 'image', 'max:5120'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ], [
            'first_name.regex' => 'First name can only contain letters, spaces, hyphens and apostrophes.',
            'last_name.regex' => 'Last name can only contain letters, spaces, hyphens and apostrophes.',
            'phone_number.regex' => 'Enter a valid Philippine mobile number, e.g. 09171234567.',
            'phone_number.unique' => 'That phone number is already linked to another account.',
            'profile_picture.required' => 'Please add a profile photo so staff can verify you at a glance.',
            'staff_id.required' => 'Please enter your ID number.',
            'staff_id.regex' => 'ID number can only contain letters, numbers, dashes, dots and slashes.',
            'staff_id.unique' => 'That ID number is already registered to another account.',
            'email.unique' => 'That email address is already in use by another account.',
            'email.prohibited' => 'Only the Admin can change the email address during setup.',
        ]);

        if (Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Choose a new password — it can\'t be the same one the administrator set for you.'],
            ]);
        }

        $oldPicture = $user->profile_picture;
        $profilePicturePath = $request->file('profile_picture')->store('profile-pictures', 'public');

        $user->fill([
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'name' => trim($validated['first_name'] . ' ' . $validated['last_name']),
            'staff_id' => $validated['staff_id'],
            'address' => $validated['address'] ?? null,
            'phone_number' => $validated['phone_number'] ?? null,
            'gender' => $validated['gender'] ?? null,
            'profile_picture' => $profilePicturePath,
        ]);
        if ($user->isAdmin() && isset($validated['email'])) {
            $user->email = $validated['email'];
        }
        $user->password = Hash::make($validated['password']);
        $user->must_setup_profile = false;
        $user->save();

        if ($oldPicture) {
            Storage::disk('public')->delete($oldPicture);
        }

        // The admin-set password is now gone — sign out every other
        // token (there shouldn't be any yet, but this matches the same
        // "a password change invalidates old sessions" rule used by
        // AuthController::changePassword()) and keep only this request's.
        // A real login has a PersonalAccessToken with an id. Session/test
        // auth (actingAs) uses a TransientToken that has none, so read it
        // defensively and, in that case, revoke every stored token.
        $currentToken = $user->currentAccessToken();
        $currentTokenId = $currentToken instanceof \Laravel\Sanctum\PersonalAccessToken
            ? $currentToken->getKey()
            : null;
        $user->tokens()
            ->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))
            ->delete();

        $this->audit->log(
            'user.completed_setup',
            $user,
            "User #{$user->id} completed mandatory first-login account setup."
        );

        return response()->json([
            'success' => true,
            'message' => 'Your account is ready.',
            'user' => $user->fresh()->only(
                'id', 'name', 'first_name', 'last_name', 'email', 'phone_number',
                'address', 'gender', 'student_id', 'staff_id', 'display_id', 'course',
                'profile_picture_url', 'two_factor_enabled', 'must_setup_profile'
            ),
        ]);
    }
}
