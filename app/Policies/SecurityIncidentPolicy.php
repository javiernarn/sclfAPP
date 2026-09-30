<?php

namespace App\Policies;

use App\Models\SecurityIncident;
use App\Models\User;

class SecurityIncidentPolicy
{
    public function viewAny(User $user): bool
    {
        return true; // controller scopes to "own reports" for student/instructor
    }

    public function view(User $user, SecurityIncident $incident): bool
    {
        return $user->id === $incident->reported_by || $user->hasAnyRole(['security_officer', 'admin', 'staff']);
    }

    public function create(User $user): bool
    {
        return true; // any authenticated user may report an incident
    }

    public function manage(User $user): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin', 'staff']);
    }

    /**
     * Fixing a typo/detail on your own report is allowed while it's still
     * sitting in the initial 'reported' state — once staff have started
     * working it (under_review) or it's resolved/closed, only staff can
     * touch it, same "hands off once it's in motion" rule as
     * ClaimPolicy applies to a submitted claim's own edits.
     */
    public function update(User $user, SecurityIncident $incident): bool
    {
        if ($user->hasAnyRole(['security_officer', 'admin', 'staff'])) {
            return !$incident->isTerminal();
        }

        return $user->id === $incident->reported_by && $incident->status === SecurityIncident::STATUS_REPORTED;
    }

    /**
     * Deleting a security incident outright (rather than just closing it)
     * is admin-only — these are the campus's security record, more
     * sensitive than a routine lost & found report.
     */
    public function delete(User $user, SecurityIncident $incident): bool
    {
        return $user->hasAdminAccess();
    }
}
