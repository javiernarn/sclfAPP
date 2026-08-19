<?php

namespace App\Policies;

use App\Models\ServiceRequest;
use App\Models\User;

class ServiceRequestPolicy
{
    public function viewAny(User $user): bool
    {
        return true; // controller scopes to "my requests" for non-staff
    }

    public function view(User $user, ServiceRequest $serviceRequest): bool
    {
        return $user->id === $serviceRequest->requested_by || $user->hasAnyRole(['security_officer', 'admin']);
    }

    public function create(User $user): bool
    {
        return true; // any authenticated user may file a request
    }

    public function manage(User $user): bool
    {
        return $user->hasAnyRole(['security_officer', 'admin']);
    }

    /**
     * The requester can call off their own request; staff can also
     * cancel on someone's behalf (e.g. tidying up a stale queue entry).
     */
    public function cancel(User $user, ServiceRequest $serviceRequest): bool
    {
        return $user->id === $serviceRequest->requested_by || $user->hasAnyRole(['security_officer', 'admin']);
    }
}
