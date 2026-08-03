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

        $users = User::query()
            ->when($request->boolean('include_disabled'), fn ($q) => $q->withTrashed())
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

        $user = User::create([
            'name' => trim($validated['first_name'] . ' ' . $validated['last_name']),
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'] ?? null,
            'password' => Hash::make($validated['password']),
        ]);

        $user->assignRole($validated['role']);

        $this->audit->log('user.created', $user, "User #{$user->id} created with role '{$validated['role']}' by admin #" . $request->user()->id);

        return response()->json([
            'success' => true,
            'message' => 'Account created successfully.',
            'data' => ['user' => $user->only('id', 'name', 'email'), 'role' => $validated['role']],
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $this->authorize('update', $user);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone_number' => [
                'sometimes', 'nullable', 'string', 'regex:/^09\d{9}$/',
                \Illuminate\Validation\Rule::unique('users', 'phone_number')->ignore($user->id),
            ],
            'is_active' => 'sometimes|boolean',
            'role' => 'sometimes|in:student,faculty,security_officer,admin',
        ], [
            'phone_number.regex' => 'Enter a valid Philippine mobile number, e.g. 09171234567.',
            'phone_number.unique' => 'That phone number is already linked to another account.',
        ]);

        $before = $user->only('name', 'phone_number');

        $user->fill(collect($validated)->except('role')->toArray())->save();

        if (isset($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        $this->audit->log('user.updated', $user, "User #{$user->id} updated by admin #" . $request->user()->id, $before, $validated);

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
