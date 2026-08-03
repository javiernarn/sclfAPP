<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminCreateUserRequest;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function __construct(protected AuditLogService $audit)
    {
    }

    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);

        $includeDisabled = $request->boolean('include_disabled');

        $users = User::query()
            // Disabling an account only flips is_active=false — it is
            // deliberately never soft-deleted (see destroy()'s comment) —
            // so the "Show disabled accounts only" checkbox has to filter
            // on is_active, not on Eloquent's trashed state. withTrashed()
            // only matters for the rare legacy row that was soft-deleted
            // before that fix shipped (see restore()); those legacy rows
            // are disabled accounts too, so they belong in the disabled
            // view and nowhere else.
            // Checked  -> only disabled accounts (is_active = false, incl. legacy trashed rows).
            // Unchecked (default) -> only active/enabled accounts.
            ->when(
                $includeDisabled,
                fn ($q) => $q->withTrashed()->where('is_active', false),
                fn ($q) => $q->where('is_active', true)
            )
            ->with('roles:id,name')
            ->when($request->role, fn ($q) => $q->role($request->role))
            ->when($request->q, fn ($q) => $q->where('name', 'like', "%{$request->q}%")
                ->orWhere('email', 'like', "%{$request->q}%"))
            ->latest()
            ->paginate(15);

        return response()->json($users);
    }

    /**
     * Admin-only account creation. Unlike public registration, the role is
     * explicitly selected here by an already-authorized admin — still never
     * trusted from an unauthenticated/self-elevating source.
     */
    public function store(AdminCreateUserRequest $request)
    {
        $validated = $request->validated();

        // Faculty / Security Officer / Admin each get a system-generated
        // ID number instead of the self-chosen student_id used by public
        // registration — e.g. SEC-2026-0001. See User::generateStaffId().
        $staffId = User::generateStaffId($validated['role']);

        $profilePicturePath = null;
        if ($request->hasFile('profile_picture')) {
            $profilePicturePath = $request->file('profile_picture')->store('profile-pictures', 'public');
        }

        $user = User::create([
            'name' => trim($validated['first_name'] . ' ' . $validated['last_name']),
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'] ?? null,
            'gender' => $validated['gender'] ?? null,
            'staff_id' => $staffId,
            'profile_picture' => $profilePicturePath,
            'password' => Hash::make($validated['password']),
        ]);

        $user->assignRole($validated['role']);

        $this->audit->log(
            'user.created',
            $user,
            "User #{$user->id} created with role '{$validated['role']}'" .
                ($staffId ? " (ID {$staffId})" : '') .
                ' by admin #' . $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Account created successfully.',
            'data' => [
                'user' => $user->only('id', 'name', 'email', 'staff_id', 'gender', 'profile_picture_url'),
                'role' => $validated['role'],
            ],
        ], 201);
    }

    /**
     * Full account-editing endpoint used by the admin "Edit user" modal —
     * covers everything an admin might need to fix or recover for a staff
     * account, including their login email and password. This is the
     * account-recovery path for faculty/security/admin accounts: since
     * those roles don't self-register, a staff member locked out (forgot
     * password, and/or lost access to the email on file) can't always
     * complete the normal self-service "Forgot password" flow, so an
     * admin can step in here, correct the email on file and/or set a new
     * temporary password directly.
     */
    public function update(Request $request, User $user)
    {
        $this->authorize('update', $user);

        // The 'api' middleware group (unlike 'web') doesn't run
        // ConvertEmptyStringsToNull, so an intentionally-cleared field
        // arrives as "" rather than null — normalize that here so
        // 'nullable' rules below actually treat it as empty instead of
        // failing the phone/gender format rules against a blank string.
        foreach (['phone_number', 'gender'] as $nullableField) {
            if ($request->has($nullableField) && $request->input($nullableField) === '') {
                $request->merge([$nullableField => null]);
            }
        }

        $validated = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:255', 'regex:/^[\pL\s\'-]+$/u'],
            'last_name' => ['sometimes', 'string', 'max:255', 'regex:/^[\pL\s\'-]+$/u'],
            'email' => [
                'sometimes', 'email', 'max:255', 'lowercase',
                \Illuminate\Validation\Rule::unique('users', 'email')->ignore($user->id),
            ],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
            'phone_number' => [
                'sometimes', 'nullable', 'string', 'regex:/^09\d{9}$/',
                \Illuminate\Validation\Rule::unique('users', 'phone_number')->ignore($user->id),
            ],
            'gender' => 'sometimes|nullable|string|in:male,female,other,prefer_not_to_say',
            'is_active' => 'sometimes|boolean',
            'role' => 'sometimes|in:student,faculty,security_officer,admin',
            'profile_picture' => ['sometimes', 'nullable', 'image', 'max:5120'],
        ], [
            'email.unique' => 'That email address is already in use by another account.',
            'phone_number.regex' => 'Enter a valid Philippine mobile number, e.g. 09171234567.',
            'phone_number.unique' => 'That phone number is already linked to another account.',
            'first_name.regex' => 'First name can only contain letters, spaces, hyphens and apostrophes.',
            'last_name.regex' => 'Last name can only contain letters, spaces, hyphens and apostrophes.',
        ]);

        // Guard against an admin accidentally locking themselves out by
        // stripping their own admin role through this generic form — the
        // dedicated disable/restore endpoints already have their own
        // "can't disable yourself" guard; this mirrors that for roles.
        if (
            isset($validated['role']) && $validated['role'] !== 'admin'
            && $user->id === $request->user()->id && $user->hasRole('admin')
        ) {
            abort(422, 'You cannot remove your own admin role.');
        }

        $before = $user->only('name', 'first_name', 'last_name', 'email', 'phone_number', 'gender');

        $attributes = collect($validated)->except(['role', 'password', 'profile_picture'])->toArray();
        if (isset($validated['first_name']) || isset($validated['last_name'])) {
            $attributes['name'] = trim(
                ($validated['first_name'] ?? $user->first_name) . ' ' . ($validated['last_name'] ?? $user->last_name)
            );
        }

        // Re-uploaded photo replaces the old one — store the new file first,
        // then remove the previous one so a failed upload never leaves the
        // account without a picture.
        if ($request->hasFile('profile_picture')) {
            $oldPicture = $user->profile_picture;
            $attributes['profile_picture'] = $request->file('profile_picture')->store('profile-pictures', 'public');
            if ($oldPicture) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($oldPicture);
            }
        }

        $user->fill($attributes);

        $passwordReset = array_key_exists('password', $validated) && filled($validated['password']);
        if ($passwordReset) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        if (isset($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        // A password reset is effectively a recovery action — sign out
        // every existing session/token so the account is immediately
        // secured under the new password rather than leaving old tokens
        // (possibly the ones the person lost control of) still valid.
        if ($passwordReset) {
            $user->tokens()->delete();
        }

        $auditMessage = "User #{$user->id} updated by admin #" . $request->user()->id;
        if ($passwordReset) {
            $auditMessage .= ' (password reset by admin)';
        }
        // Never write the plaintext password into the audit trail.
        $this->audit->log(
            'user.updated',
            $user,
            $auditMessage,
            $before,
            collect($validated)->except('password')->toArray()
        );

        return response()->json(['success' => true, 'message' => 'User updated.', 'data' => $user->fresh('roles')]);
    }

    public function destroy(Request $request, User $user)
    {
        $this->authorize('delete', $user);

        if ($user->id === $request->user()->id) {
            abort(422, 'You cannot disable your own account.');
        }

        // Disabling ≠ deleting. We intentionally do NOT soft-delete here:
        // a soft-deleted user disappears from every relationship query
        // (lost_items.user, found_items.finder, claims.claimant, etc.),
        // which breaks every page that lists their past reports. Flipping
        // is_active keeps the record — and their history — fully intact,
        // and EnsureAccountActive + the login check are what actually
        // block them out.
        $user->update(['is_active' => false]);
        $user->tokens()->delete(); // kill any existing sessions immediately

        $this->audit->log('user.disabled', $user, "User #{$user->id} disabled by admin #" . $request->user()->id);

        return response()->json(['success' => true, 'message' => 'Account disabled.', 'data' => $user->fresh()]);
    }

    /**
     * Re-enable a previously disabled account. Also transparently restores
     * a soft-deleted record if this account was disabled before this fix
     * shipped (when "disable" incorrectly used a soft delete).
     */
    public function restore(Request $request, int $id)
    {
        $user = User::withTrashed()->findOrFail($id);

        $this->authorize('update', $user);

        if ($user->trashed()) {
            $user->restore();
        }

        $user->update(['is_active' => true]);

        $this->audit->log('user.enabled', $user, "User #{$user->id} re-enabled by admin #" . $request->user()->id);

        return response()->json(['success' => true, 'message' => 'Account re-enabled.', 'data' => $user->fresh()]);
    }
}
