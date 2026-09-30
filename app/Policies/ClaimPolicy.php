<?php

namespace App\Policies;

use App\Models\Claim;
use App\Models\User;

class ClaimPolicy
{
    public function viewAny(User $user): bool
    {
        return true; // controller scopes to "own" claims for students/instructor
    }

    public function view(User $user, Claim $claim): bool
    {
        return $user->id === $claim->claimant_id || $user->hasAnyRole(['security_officer', 'admin', 'staff']);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['student', 'instructor']);
    }

    public function addEvidence(User $user, Claim $claim): bool
    {
        return $user->id === $claim->claimant_id;
    }

    public function review(User $user, Claim $claim): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin', 'staff']);
    }

    public function cancel(User $user, Claim $claim): bool
    {
        return $user->id === $claim->claimant_id || $user->hasAdminAccess();
    }

    // Admin-only: permanently remove a claim record from the list (e.g.
    // cleaning up duplicate/cancelled clutter). This is separate from
    // `cancel`, which just transitions status — this actually deletes.
    public function delete(User $user, Claim $claim): bool
    {
        return $user->hasAdminAccess();
    }

    public function generateRelease(User $user, Claim $claim): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin', 'staff']);
    }

    // Only the claimant may download their own release QR — this is their
    // pickup pass, not something staff or other students should be able
    // to pull for them.
    public function downloadRelease(User $user, Claim $claim): bool
    {
        return $user->id === $claim->claimant_id;
    }
}
