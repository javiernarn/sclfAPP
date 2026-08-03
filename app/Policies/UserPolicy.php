<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('admin');
    }

    public function view(User $user, User $target): bool
    {
        return $user->hasRole('admin') || $user->id === $target->id;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('admin');
    }

    public function update(User $user, User $target): bool
    {
        return $user->hasRole('admin');
    }

    /**
     * Any admin may disable any account. The "you can't disable your own
     * account" rule is intentionally NOT enforced here — it's handled in
     * Admin\UserController::destroy() instead, which returns a clear,
     * specific 422 message ("You cannot disable your own account.").
     * Enforcing it here too would make Gate::authorize() fail first with
     * Laravel's generic "This action is unauthorized." message, hiding
     * the actual reason from the admin.
     */
    public function delete(User $user, User $target): bool
    {
        return $user->hasRole('admin');
    }
}
