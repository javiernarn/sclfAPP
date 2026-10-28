<?php

namespace App\Http\Controllers\Admin;

use App\Rules\FormalProfilePhoto;
use App\Support\PrivateMedia;
use App\Http\Controllers\Controller;
use App\Http\Requests\AdminCreateUserRequest;
use App\Mail\AccountCreatedMail;
use App\Mail\AccountUpdatedMail;
use App\Models\Campus;
use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Throwable;

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
            ->when($request->q, fn ($q) => $q->where('name', 'like', \App\Support\Like::contains($request->q))
                ->orWhere('email', 'like', \App\Support\Like::contains($request->q)))
            ->latest()
            ->paginate(15);

        return response()->json($users);
    }

    /**
     * Full profile detail for a single user — everything the admin "User
     * Details" page shows: the account's own fields plus a few activity
     * counts (reports/claims) so the admin gets a sense of the account's
     * history at a glance. The page's own audit-log section fetches that
     * separately via GET /audit-logs?user_id=... (AuditLogController),
     * which already supports filtering to just this user.
     *
     * Every count here is deliberately scoped by intake_channel rather
     * than just counting the raw relation, because CounterIntakeService
     * blurs "who reported/claimed this" for counter walk-ins: the officer
     * ends up as the FoundItem's user_id (no independent finder exists in
     * that flow) and the owner's Claim is created for them, not by them.
     * Without the split, a busy security officer's counter check-ins
     * showed up as "Found Items Reported", and a student who never opened
     * the app to file anything still showed up with "Claims Filed".
     */
    public function show(Request $request, User $user)
    {
        $this->authorize('view', $user);

        $user->loadCount([
            'lostItems',
            // Items genuinely found and reported through the app —
            // excludes counter check-ins, where user_id is the officer's,
            // not a finder's.
            'foundItems as found_items_count' => fn ($q) => $q
                ->where('intake_channel', FoundItem::CHANNEL_ONLINE_REPORT),
            // Claims this person filed themselves via report -> match ->
            // claim, as opposed to a claim an officer created for them.
            'claims as claims_count' => fn ($q) => $q->whereHas(
                'foundItem',
                fn ($fq) => $fq->where('intake_channel', FoundItem::CHANNEL_ONLINE_REPORT)
            ),
            // Claims that exist only because an officer checked an item
            // straight in for this person at the counter — pre-approved,
            // never went through this claimant filing anything.
            'claims as counter_claims_count' => fn ($q) => $q->whereHas(
                'foundItem',
                fn ($fq) => $fq->where('intake_channel', FoundItem::CHANNEL_COUNTER_INTAKE)
            ),
            'claims as cancelled_claims_count' => fn ($q) => $q->where('status', Claim::STATUS_CANCELLED),
            // Security-desk activity: relevant for security officers and
            // admins, but harmless (and simply zero) to compute for any
            // account — nothing here assumes a particular role.
            'counterCheckIns as counter_checkins_count',
            'itemsReleased as items_released_count',
        ]);
        $user->load('roles:id,name');

        return response()->json([
            'data' => $user,
        ]);
    }

    /**
     * Admin-only account creation. Unlike public registration, the role is
     * explicitly selected here by an already-authorized admin — still never
     * trusted from an unauthenticated/self-elevating source.
     */
    public function store(AdminCreateUserRequest $request)
    {
        $validated = $request->validated();

        // Instructor / Security Officer / Admin each get a system-generated
        // ID number instead of the self-chosen student_id used by public
        // registration — e.g. SEC-2026-0001. See User::generateStaffId().
        $staffId = User::generateStaffId($validated['role']);

        $profilePicturePath = null;
        if ($request->hasFile('profile_picture')) {
            $profilePicturePath = $request->file('profile_picture')->store('profile-pictures', PrivateMedia::DISK);
        }

        // Staff accounts are the admin's to create — a Staff member can
        // never mint another Staff (or anything above their own level).
        if ($validated['role'] === 'staff' && !$request->user()->isAdmin()) {
            abort(403, 'Only the Admin can create Staff accounts.');
        }

        $user = User::create([
            'name' => trim($validated['first_name'] . ' ' . $validated['last_name']),
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'] ?? null,
            'gender' => $validated['gender'] ?? null,
            'campus_id' => $validated['campus_id'] ?? null,
            // Teaching course is only meaningful for instructors.
            'teaching_course' => $validated['role'] === 'instructor' ? ($validated['teaching_course'] ?? null) : null,
            'staff_id' => $staffId,
            'profile_picture' => $profilePicturePath,
            'password' => Hash::make($validated['password']),
            // Every account created through this admin-only endpoint is
            // instructor/security_officer/admin (see
            // AdminCreateUserRequest) — none of them self-register, so
            // whatever the admin just typed here (password, name, photo)
            // is still theirs to see. Force the account's first login to
            // go through SetupAccountPage so the user personalizes their
            // own password/photo/name before anything else is reachable
            // — after that point the admin no longer knows the live
            // credentials. See EnsureProfileSetupComplete.
            'must_setup_profile' => true,
        ]);

        // The admin vouches for the address they typed in, so these accounts
        // skip the email-verification step (email_verified_at is not
        // mass-assignable, hence forceFill).
        $user->forceFill(['email_verified_at' => now()])->save();

        $user->assignRole($validated['role']);

        $this->audit->log(
            'user.created',
            $user,
            "User #{$user->id} created with role '{$validated['role']}'" .
                ($staffId ? " (ID {$staffId})" : '') .
                ' by ' . ($request->user()->isAdmin() ? 'admin' : 'staff') . ' #' . $request->user()->id
        );

        // Tell the new user their account exists, with the details the admin
        // entered and the temporary password. A mail failure never undoes the
        // account — the admin is told instead (see `email_sent`).
        $emailSent = $this->sendAccountCreatedEmail($user, $validated, $staffId, $request->user());

        return response()->json([
            'success' => true,
            'message' => 'Account created successfully.',
            'data' => [
                'user' => $user->only('id', 'name', 'email', 'staff_id', 'gender', 'profile_picture_url'),
                'role' => $validated['role'],
                'email_sent' => $emailSent,
            ],
        ], 201);
    }

    /**
     * Email the new account's owner their details + temporary password in the
     * branded SCLF format (resources/views/emails/account-created.blade.php).
     * Sent right away, not queued, so the password never sits in the jobs
     * table. The password is never written to the audit log.
     */
    protected function sendAccountCreatedEmail(User $user, array $validated, ?string $staffId, User $creator): bool
    {
        $roleLabels = [
            'instructor' => 'Instructor',
            'security_officer' => 'Security Officer',
            'staff' => 'Staff',
            'admin' => 'Admin',
        ];
        $genderLabels = [
            'male' => 'Male',
            'female' => 'Female',
            'other' => 'Other',
            'prefer_not_to_say' => 'Prefer not to say',
        ];

        try {
            Mail::send(new AccountCreatedMail(
                fullName: $user->name,
                userEmail: $user->email,
                temporaryPassword: $validated['password'],
                roleLabel: $roleLabels[$validated['role']] ?? ucfirst($validated['role']),
                staffId: $staffId,
                campusName: ! empty($validated['campus_id']) ? Campus::find($validated['campus_id'])?->name : null,
                phoneNumber: $validated['phone_number'] ?? null,
                genderLabel: $genderLabels[$validated['gender'] ?? ''] ?? null,
                // Role only (never the person's name) so the recipient knows who
                // set up the account: the Administrator or a Staff member.
                createdBy: $creator->isAdmin() ? 'the Administrator' : 'SCLF Staff',
                loginUrl: rtrim(config('app.url'), '/') . '/login',
                teachingCourse: $validated['role'] === 'instructor' ? ($validated['teaching_course'] ?? null) : null,
            ));

            return true;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }

    /** Readable account fields, used to work out what an edit changed. */
    protected function accountSnapshot(User $user): array
    {
        $roleLabels = ['instructor' => 'Instructor', 'security_officer' => 'Security Officer', 'staff' => 'Staff', 'admin' => 'Admin', 'student' => 'Student'];
        $role = $user->roles->pluck('name')->first();
        $genderLabels = ['male' => 'Male', 'female' => 'Female', 'other' => 'Other', 'prefer_not_to_say' => 'Prefer not to say'];

        return [
            'Full name' => $user->name,
            'Email' => $user->email,
            'Role' => $role ? ($roleLabels[$role] ?? ucwords(str_replace('_', ' ', $role))) : null,
            'ID number' => $user->staff_id ?: $user->student_id,
            'Campus' => $user->campus_id ? Campus::find($user->campus_id)?->name : null,
            'Phone number' => $user->phone_number,
            'Gender' => $genderLabels[$user->gender ?? ''] ?? null,
            'Teaching course' => $user->hasRole('instructor') ? $user->teaching_course : null,
            'Account status' => $user->is_active ? 'Active' : 'Disabled',
        ];
    }

    /**
     * Tell the person what an admin/staff edit changed (role, ID, email...).
     * Best-effort: a mail failure must never fail the edit itself.
     */
    protected function sendAccountUpdatedEmail(User $user, array $before, bool $passwordReset, User $editor): void
    {
        $after = $this->accountSnapshot($user);
        $changes = [];
        foreach ($after as $label => $new) {
            if (($before[$label] ?? null) !== $new) {
                $changes[] = ['label' => $label, 'old' => $before[$label] ?? null, 'new' => $new];
            }
        }

        if (! $changes && ! $passwordReset) {
            return;
        }

        $updatedBy = $editor->isAdmin() ? 'the Administrator' : 'SCLF Staff';
        $loginUrl = rtrim(config('app.url'), '/') . '/login';

        try {
            Mail::send(new AccountUpdatedMail($user->name, $user->email, $changes, $passwordReset, $updatedBy, $loginUrl));

            // Email address changed: also warn the previous address.
            $oldEmail = $before['Email'] ?? null;
            if ($oldEmail && $oldEmail !== $user->email) {
                Mail::send(new AccountUpdatedMail($user->name, $oldEmail, $changes, false, $updatedBy, $loginUrl, toOldAddress: true));
            }
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * Full account-editing endpoint used by the admin "Edit user" modal —
     * covers everything an admin might need to fix or recover for a staff
     * account, including their login email and password. This is the
     * account-recovery path for instructor/security/admin accounts: since
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
            'password' => ['sometimes', 'nullable', 'string', \Illuminate\Validation\Rules\Password::defaults()],
            'phone_number' => [
                'sometimes', 'nullable', 'string', 'regex:/^09\d{9}$/',
                \Illuminate\Validation\Rule::unique('users', 'phone_number')->ignore($user->id),
            ],
            'gender' => 'sometimes|nullable|string|in:male,female,other,prefer_not_to_say',
            'campus_id' => 'sometimes|nullable|exists:campuses,id',
            'is_active' => 'sometimes|boolean',
            'role' => 'sometimes|in:student,instructor,security_officer,staff,admin',
            // ID number for the NEW role, typed by the admin when changing
            // role (the person can't redo first-time setup). Blank = auto-generate.
            'id_number' => ['sometimes', 'nullable', 'string', 'max:50'],
            // Teaching course (instructors only), from the registration course list.
            'teaching_course' => ['sometimes', 'nullable', 'string', 'max:255'],
            'profile_picture' => ['sometimes', 'nullable', 'image', 'max:5120', new FormalProfilePhoto],
        ], [
            'email.unique' => 'That email address is already in use by another account.',
            'phone_number.regex' => 'Enter a valid Philippine mobile number, e.g. 09171234567.',
            'phone_number.unique' => 'That phone number is already linked to another account.',
            'first_name.regex' => 'First name can only contain letters, spaces, hyphens and apostrophes.',
            'last_name.regex' => 'Last name can only contain letters, spaces, hyphens and apostrophes.',
        ]);

        // One admin, ever. Nobody can be promoted to admin, and the admin
        // account itself is never edited/demoted by anyone but the admin.
        if (($validated['role'] ?? null) === 'admin' && !$user->isAdmin()) {
            abort(422, 'There is only one Admin account. Use the Staff role for everyone else.');
        }
        if ($user->isAdmin() && !$request->user()->isAdmin()) {
            abort(403, 'Only the Admin can change the Admin account.');
        }
        // Staff may not touch other Staff accounts, nor hand out the Staff role.
        $this->guardStaffTarget($request, $user);
        if (($validated['role'] ?? null) === 'staff' && !$user->hasRole('staff') && !$request->user()->isAdmin()) {
            abort(403, 'Only the Admin can give someone the Staff role.');
        }
        if ($user->isAdmin() && isset($validated['role']) && $validated['role'] !== 'admin') {
            abort(422, 'The Admin account cannot be given another role.');
        }

        // Guard against an admin accidentally locking themselves out by
        // stripping their own admin role through this generic form — the
        // dedicated disable/restore endpoints already have their own
        // "can't disable yourself" guard; this mirrors that for roles.
        if (
            isset($validated['role']) && $validated['role'] !== 'admin'
            && $user->id === $request->user()->id && $user->isAdmin()
        ) {
            abort(422, 'You cannot remove your own admin role.');
        }

        // Validate a manually typed ID for the new role before anything is saved.
        $newIdNumber = trim((string) ($validated['id_number'] ?? ''));
        $roleChanging = isset($validated['role']) && ! $user->hasRole($validated['role']);
        if ($roleChanging && $newIdNumber !== '') {
            // Any real ID is accepted as typed (e.g. SEC-1591-221-02026) — only a
            // loose character check, since actual ID numbers don't all follow
            // the auto-generated PREFIX-YYYY-NNNN pattern.
            if (! preg_match('/^[A-Za-z0-9][A-Za-z0-9\-\/\. ]{0,49}$/', $newIdNumber)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'id_number' => 'ID number can only contain letters, numbers, dashes, slashes and dots.',
                ]);
            }
            $column = (User::STAFF_ID_PREFIXES[$validated['role']] ?? null) ? 'staff_id' : 'student_id';
            $taken = User::withTrashed()->where($column, $newIdNumber)->where('id', '!=', $user->id)->exists();
            if ($taken) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'id_number' => 'That ID number is already used by another account.',
                ]);
            }
        }

        $before = $user->only('name', 'first_name', 'last_name', 'email', 'phone_number', 'gender', 'campus_id');
        $emailSnapshot = $this->accountSnapshot($user);

        $attributes = collect($validated)->except(['role', 'password', 'profile_picture', 'id_number', 'teaching_course'])->toArray();
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
            $attributes['profile_picture'] = $request->file('profile_picture')->store('profile-pictures', PrivateMedia::DISK);
            if ($oldPicture) {
                \Illuminate\Support\Facades\Storage::disk(PrivateMedia::DISK)->delete($oldPicture);
            }
        }

        // Teaching course belongs to instructors only: set/clear it with the
        // account's resulting role.
        $resultingRole = $validated['role'] ?? $user->roles->pluck('name')->first();
        if ($resultingRole !== 'instructor') {
            if ($user->teaching_course !== null && isset($validated['role'])) {
                $attributes['teaching_course'] = null;
            }
        } elseif (array_key_exists('teaching_course', $validated)) {
            $attributes['teaching_course'] = $validated['teaching_course'] ?: null;
        }

        $user->fill($attributes);

        $passwordReset = array_key_exists('password', $validated) && filled($validated['password']);
        if ($passwordReset) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        if (isset($validated['role'])) {
            $previousRole = $user->roles->pluck('name')->first();
            $user->syncRoles([$validated['role']]);

            // Role changed (e.g. Instructor -> Security Officer): the account
            // needs an ID for its new role. Use the number the admin typed, or
            // auto-generate one with the new role's prefix (SEC-YYYY-NNNN).
            if ($previousRole !== $validated['role']) {
                $newPrefix = User::STAFF_ID_PREFIXES[$validated['role']] ?? null;
                if ($newPrefix) {
                    $user->staff_id = $newIdNumber !== '' ? $newIdNumber : User::generateStaffId($validated['role']);
                    $user->student_id = null; // display_id prefers student_id, so clear the old one
                } else {
                    // Student: keep the typed student ID; staff ID no longer applies.
                    $user->staff_id = null;
                    if ($newIdNumber !== '') {
                        $user->student_id = $newIdNumber;
                    }
                }
                $user->save();
            }
        }

        // A password reset is effectively a recovery action — sign out
        // every existing session/token so the account is immediately
        // secured under the new password rather than leaving old tokens
        // (possibly the ones the person lost control of) still valid.
        if ($passwordReset) {
            $user->tokens()->delete();
        }

        $this->sendAccountUpdatedEmail($user->fresh('roles'), $emailSnapshot, $passwordReset, $request->user());

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
        if ($user->isAdmin()) {
            abort(403, 'The Admin account cannot be disabled.');
        }
        $this->guardStaffTarget($request, $user);

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

        if ($user->isAdmin() && !$request->user()->isAdmin()) {
            abort(403, 'Only the Admin can change the Admin account.');
        }
        $this->guardStaffTarget($request, $user);

        if ($user->trashed()) {
            $user->restore();
        }

        $user->update(['is_active' => true]);

        $this->audit->log('user.enabled', $user, "User #{$user->id} re-enabled by admin #" . $request->user()->id);

        return response()->json(['success' => true, 'message' => 'Account re-enabled.', 'data' => $user->fresh()]);
    }

    /**
     * Only the Admin may edit, disable or re-enable a Staff account. A Staff
     * member acting on their own account is also blocked here — self-service
     * changes go through the Profile page instead.
     */
    protected function guardStaffTarget(Request $request, User $target): void
    {
        $actor = $request->user();

        if (!$actor->isAdmin() && $target->hasRole('staff')) {
            abort(403, 'Only the Admin can manage Staff accounts.');
        }
    }
}
