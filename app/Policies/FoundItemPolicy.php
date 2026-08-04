<?php

namespace App\Policies;

use App\Models\FoundItem;
use App\Models\User;

class FoundItemPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, FoundItem $foundItem): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['student', 'instructor', 'security_officer']);
    }

    public function verify(User $user, FoundItem $foundItem): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin']);
    }

    public function manageStorage(User $user): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin']);
    }

    public function update(User $user, FoundItem $foundItem): bool
    {
        return $user->id === $foundItem->user_id || $user->hasAnyRole(['admin', 'security_officer']);
    }

    public function delete(User $user, FoundItem $foundItem): bool
    {
        return $user->hasRole('admin');
    }
}
