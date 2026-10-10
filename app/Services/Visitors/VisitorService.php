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
        protected BadgePoolService $badges,
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
            $campusId = $data['campus_id'] ?? $officer->campus_id;
            $badgeFields = $this->badges->claim($data['badge_number'] ?? null, $campusId);
            $studentFields = $this->resolveStudent($data);

            $visitor = Visitor::create([
                'campus_id' => $campusId,
                'full_name' => $data['full_name'],
                'id_presented' => $data['id_presented'] ?? null,
                'id_number' => $data['id_number'] ?? null,
                'contact_number' => $data['contact_number'] ?? null,
                'purpose' => $data['purpose'],
                'host_name' => $data['host_name'] ?? null,
                'host_department' => $data['host_department'] ?? null,
                ...$badgeFields,
                ...$studentFields,
                'checked_in_by' => $officer->id,
                'checked_in_at' => now(),
                'status' => Visitor::STATUS_CHECKED_IN,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->badges->afterIssue($campusId, $badgeFields['badge_prefix']);

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
     * Correct a front-desk entry — a mistyped name, wrong host, etc.
     * Doesn't touch status/checked_in_at/checked_out_at; those are
     * checkIn()/checkOut()'s job, not a details fix.
     */
    public function update(Visitor $visitor, User $officer, array $data): Visitor
    {
        if (!in_array($data['purpose'], Visitor::PURPOSES, true)) {
            throw ValidationException::withMessages(['purpose' => 'Invalid visit purpose.']);
        }

        return DB::transaction(function () use ($visitor, $officer, $data) {
            if ($visitor->status !== Visitor::STATUS_CHECKED_IN) {
                // The badge is already handed back — it can't be re-assigned.
                unset($data['badge_number']);
            } elseif (array_key_exists('badge_number', $data)) {
                $incoming = strtoupper(preg_replace('/[\s\-]+/', '', (string) $data['badge_number']));
                $current = strtoupper(preg_replace('/[\s\-]+/', '', (string) $visitor->badge_number));

                if ($incoming === $current) {
                    unset($data['badge_number']); // unchanged (also keeps legacy free-text badges valid)
                } else {
                    $data = array_merge($data, $this->badges->claim($data['badge_number'], $visitor->campus_id, $visitor->id));
                }
            }

            if (array_key_exists('student_user_id', $data) || array_key_exists('student_name', $data)) {
                $data = array_merge($data, $this->resolveStudent($data));
            }

            $before = $visitor->only(array_keys($data));

            $visitor->update($data);

            $this->audit->log(
                'visitor.updated',
                $visitor,
                "Visitor entry for {$visitor->full_name} edited by {$officer->name}.",
                before: $before,
                after: $visitor->only(array_keys($data)),
                actor: $officer,
            );

            return $visitor->fresh();
        });
    }

    /**
     * Remove an erroneous log entry (soft delete) — e.g. a duplicate
     * check-in, or one entered for the wrong person entirely. Admin-only,
     * gated at the controller.
     */
    public function delete(Visitor $visitor, User $officer): void
    {
        $this->audit->log(
            'visitor.deleted',
            $visitor,
            "Visitor entry for {$visitor->full_name} deleted by {$officer->name}.",
            actor: $officer,
        );

        $visitor->delete();
    }

    /**
     * Everyone still on campus right now — the default view of the
     * Visitors page before an officer switches to the full history.
     */
    public function currentlyOnCampusQuery(): Builder
    {
        return Visitor::query()->where('status', Visitor::STATUS_CHECKED_IN);
    }

    /**
     * Link a parent/guardian visit to the student being visited and
     * snapshot the name + student ID.
     */
    protected function resolveStudent(array $data): array
    {
        $studentId = $data['student_user_id'] ?? null;

        if (!$studentId) {
            return [
                'student_user_id' => null,
                'student_name' => $data['student_name'] ?? null,
                'student_number' => $data['student_number'] ?? null,
                'relationship' => $data['relationship'] ?? null,
            ];
        }

        $student = User::query()->role('student')->find($studentId);

        if (!$student) {
            throw ValidationException::withMessages(['student_user_id' => 'That student could not be found.']);
        }

        return [
            'student_user_id' => $student->id,
            'student_name' => $student->name,
            'student_number' => $student->student_id,
            'relationship' => $data['relationship'] ?? null,
        ];
    }

    /**
     * Badges currently handed out and not returned, oldest first, so
     * security can see exactly which physical badges are still outside.
     */
    public function outstandingBadgesQuery(): Builder
    {
        return $this->currentlyOnCampusQuery()
            ->whereNotNull('badge_number')
            ->orderBy('checked_in_at');
    }
}
