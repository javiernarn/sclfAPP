<?php

namespace App\Policies;

use App\Models\Asset;
use App\Models\User;

/**
 * Registering/managing the asset registry is officer/admin-only, but a
 * custodian can always look up an asset that's currently assigned to
 * them — the "My Assets" view on AssetsList mirrors IncidentsList's
 * "My Reports" for the same reason: the person holding the thing should
 * be able to see its record without needing staff access.
 */
class AssetPolicy
{
    public function viewAny(User $user): bool
    {
        return true; // controller scopes to "my assets" for non-staff
    }

    public function view(User $user, Asset $asset): bool
    {
        return $user->id === $asset->assigned_to || $user->hasAnyRole(['security_officer', 'admin']);
    }

    public function manage(User $user): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin']);
    }
}
