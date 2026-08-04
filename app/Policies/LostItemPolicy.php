<?php

namespace App\Policies;

use App\Models\LostItem;
use App\Models\User;

class LostItemPolicy
{
    public function viewAny(User $user): bool
    {
        return true; // all authenticated roles can search/browse lost items
    }

    public function view(User $user, LostItem $lostItem): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['student', 'instructor']);
    }

    public function update(User $user, LostItem $lostItem): bool
    {
        return $user->id === $lostItem->user_id || $user->hasAnyRole(['admin', 'security_officer']);
    }

    public function delete(User $user, LostItem $lostItem): bool
    {
        return $user->id === $lostItem->user_id || $user->hasRole('admin');
    }
}
