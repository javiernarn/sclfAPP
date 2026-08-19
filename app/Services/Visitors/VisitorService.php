<?php

namespace App\Services\Visitors;

use App\Models\User;
use App\Models\Visitor;
use App\Services\Audit\AuditLogService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VisitorService
{
    public function __construct(
        protected AuditLogService $audit,
    ) {
    }

    /**
     * Log a visitor in at the counter. campus_id defaults to the
     * checking-in officer's own campus, same fallback InventoryService
     * uses elsewhere for campus-scoped records created by staff.
     */
    public function checkIn(User $officer, array $data): Visitor
    {
        if (!in_array($data['purpose'], Visitor::PURPOSES, true)) {
            throw ValidationException::withMessages(['purpose' => 'Invalid visit purpose.']);
        }

        return DB::transaction(function () use ($officer, $data) {
            $visitor = Visitor::create([
                'campus_id' => $data['campus_id'] ?? $officer->campus_id,
                'full_name' => $data['full_name'],
                'id_presented' => $data['id_presented'] ?? null,
                'id_number' => $data['id_number'] ?? null,
                'purpose' => $data['purpose'],
                'host_name' => $data['host_name'] ?? null,
                'host_department' => $data['host_department'] ?? null,
                'badge_number' => $data['badge_number'] ?? null,
                'checked_in_by' => $officer->id,
                'checked_in_at' => now(),
                'status' => Visitor::STATUS_CHECKED_IN,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->audit->log(
                'visitor.checked_in',
                $visitor,
                "Visitor {$visitor->full_name} checked in by {$officer->name}.",
                actor: $officer,
            );

            return $visitor;
        });
    }

    /**
     * Sign a visitor back out. Idempotency isn't needed here the way it
     * is for the retention sweep — this is always a single explicit
     * officer action — but it's still guarded so a double-click or a
     * stale page can't silently overwrite an earlier checkout's
     * timestamp/officer.
     */
    public function checkOut(Visitor $visitor, User $officer, ?string $notes = null): Visitor
    {
        if ($visitor->status !== Visitor::STATUS_CHECKED_IN) {
            throw ValidationException::withMessages(['status' => 'This visitor is already checked out.']);
        }

        return DB::transaction(function () use ($visitor, $officer, $notes) {
            $visitor->update([
                'status' => Visitor::STATUS_CHECKED_OUT,
                'checked_out_by' => $officer->id,
                'checked_out_at' => now(),
                'notes' => $notes ?? $visitor->notes,
            ]);

            $this->audit->log(
                'visitor.checked_out',
                $visitor,
                "Visitor {$visitor->full_name} checked out by {$officer->name}.",
                actor: $officer,
            );

            return $visitor->fresh();
        });
    }

    /**
     * Everyone still on campus right now — the default view of the
     * Visitors page before an officer switches to the full history.
     */
    public function currentlyOnCampusQuery(): Builder
    {
        return Visitor::query()->where('status', Visitor::STATUS_CHECKED_IN);
    }
}
