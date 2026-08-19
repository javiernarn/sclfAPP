<?php

namespace App\Services\Counter;

use App\Models\StorageLocation;
use App\Models\StorageLocationOfficer;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Assigns/unassigns security officers to a counter (or any storage
 * location, though in practice this is only used for counters). Keeps a
 * full history — see StorageLocationOfficer — rather than overwriting a
 * single "assigned officer" column, so multiple officers can be on the
 * same counter and a past assignment is never silently lost.
 */
class CounterAssignmentService
{
    public function __construct(
        protected AuditLogService $audit,
    ) {
    }

    /**
     * Assign an officer to a location. No-ops (returns the existing row)
     * if the officer already has an active assignment there, rather than
     * creating a duplicate open assignment.
     */
    public function assign(StorageLocation $location, User $officer, User $assignedBy): StorageLocationOfficer
    {
        if (!$officer->hasAnyRole(['security_officer', 'admin'])) {
            throw ValidationException::withMessages([
                'user_id' => ['Only a security officer or admin can be assigned to a counter.'],
            ]);
        }

        if (!$officer->canOperateInCampus($location->campus_id)) {
            throw ValidationException::withMessages([
                'user_id' => ['That officer is assigned to a different campus than this counter.'],
            ]);
        }

        return DB::transaction(function () use ($location, $officer, $assignedBy) {
            $existing = StorageLocationOfficer::query()
                ->where('storage_location_id', $location->id)
                ->where('user_id', $officer->id)
                ->current()
                ->first();

            if ($existing) {
                return $existing;
            }

            $assignment = StorageLocationOfficer::create([
                'storage_location_id' => $location->id,
                'user_id' => $officer->id,
                'assigned_by' => $assignedBy->id,
                'assigned_at' => now(),
            ]);

            $this->audit->log(
                'counter.officer_assigned',
                $location,
                "{$officer->name} assigned to {$location->label} by {$assignedBy->name}.",
            );

            return $assignment;
        });
    }

    /**
     * End an officer's active assignment to a location. No-ops if they
     * don't currently have one.
     */
    public function unassign(StorageLocation $location, User $officer, User $unassignedBy): void
    {
        DB::transaction(function () use ($location, $officer, $unassignedBy) {
            $assignment = StorageLocationOfficer::query()
                ->where('storage_location_id', $location->id)
                ->where('user_id', $officer->id)
                ->current()
                ->first();

            if (!$assignment) {
                return;
            }

            $assignment->update(['unassigned_at' => now()]);

            $this->audit->log(
                'counter.officer_unassigned',
                $location,
                "{$officer->name} unassigned from {$location->label} by {$unassignedBy->name}.",
            );
        });
    }
}
