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
        return $user->hasAnyRole(['security_officer', 'admin', 'staff']);
    }

    public function manageStorage(User $user): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin', 'staff']);
    }

    public function update(User $user, FoundItem $foundItem): bool
    {
        return $user->isAdmin(); // filed reports are locked — Administrator only
    }

    public function delete(User $user, FoundItem $foundItem): bool
    {
        return $user->isAdmin();
    }
}
