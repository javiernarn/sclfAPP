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
        return $user->id === $incident->reported_by || $user->hasAnyRole(['security_officer', 'admin']);
    }

    public function create(User $user): bool
    {
        return true; // any authenticated user may report an incident
    }

    public function manage(User $user): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin']);
    }
}
