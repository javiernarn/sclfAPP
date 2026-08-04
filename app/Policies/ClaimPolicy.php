<?php

namespace App\Policies;

use App\Models\Claim;
use App\Models\User;

class ClaimPolicy
{
    public function viewAny(User $user): bool
    {
        return true; // controller scopes to "own" claims for students/faculty
    }

    public function view(User $user, Claim $claim): bool
    {
        return $user->id === $claim->claimant_id || $user->hasAnyRole(['security_officer', 'admin']);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['student', 'faculty']);
    }

    public function addEvidence(User $user, Claim $claim): bool
    {
        return $user->id === $claim->claimant_id;
    }

    public function review(User $user, Claim $claim): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin']);
    }

    public function cancel(User $user, Claim $claim): bool
    {
        return $user->id === $claim->claimant_id || $user->hasRole('admin');
    }

    public function generateRelease(User $user, Claim $claim): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin']);
    }

    // Only the claimant may download their own release QR — this is their
    // pickup pass, not something staff or other students should be able
    // to pull for them.
    public function downloadRelease(User $user, Claim $claim): bool
    {
        return $user->id === $claim->claimant_id;
    }
}
