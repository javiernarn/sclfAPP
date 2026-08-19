<?php

namespace App\Services\Incidents;

use App\Models\SecurityIncident;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Audit\AuditLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Report -> assign -> resolve -> close lifecycle for security incidents.
 * Mirrors DispositionService's shape: small transactional methods, each
 * validating the current status before acting, each writing an audit
 * log entry. There's no InventoryMovement-style side table here since an
 * incident isn't tied to a shelf slot — the status/timestamp columns on
 * the row itself are the whole history.
 */
class IncidentService
{
    public function __construct(
        protected AuditLogService $audit,
    ) {
    }

    /**
     * Anyone authenticated can report an incident — this is deliberately
     * not gated to staff, since the person best placed to report
     * something (a student who witnessed it) is often not an officer.
     */
    public function report(User $reporter, array $data): SecurityIncident
    {
        if (!in_array($data['category'], SecurityIncident::CATEGORIES, true)) {
            throw ValidationException::withMessages(['category' => 'Invalid incident category.']);
        }

        if (!in_array($data['severity'] ?? SecurityIncident::SEVERITY_LOW, SecurityIncident::SEVERITIES, true)) {
            throw ValidationException::withMessages(['severity' => 'Invalid severity.']);
        }

        return DB::transaction(function () use ($reporter, $data) {
            $incident = SecurityIncident::create([
                'campus_id' => $data['campus_id'] ?? $reporter->campus_id,
                'reported_by' => $reporter->id,
                'category' => $data['category'],
                'severity' => $data['severity'] ?? SecurityIncident::SEVERITY_LOW,
                'title' => $data['title'],
                'description' => $data['description'],
                'location_text' => $data['location_text'] ?? null,
                'occurred_at' => $data['occurred_at'],
                'status' => SecurityIncident::STATUS_REPORTED,
                'related_found_item_id' => $data['related_found_item_id'] ?? null,
            ]);

            $this->audit->log(
                'incident.reported',
                $incident,
                "Security incident #{$incident->id} ({$incident->category}) reported by {$reporter->name}.",
                actor: $reporter,
            );

            return $incident;
        });
    }

    /**
     * Hand an incident to a specific officer. Auto-advances status from
     * "reported" to "under_review" the same way DispositionService
     * doesn't require a separate step for what's really implied by the
     * action — but a re-assignment (already under_review, handing it to
     * someone else) doesn't regress the status, it just changes who owns
     * it.
     */
    public function assign(SecurityIncident $incident, User $officer, User $actor): SecurityIncident
    {
        if ($incident->isTerminal()) {
            throw ValidationException::withMessages(['status' => 'Closed incidents cannot be reassigned.']);
        }

        if (!$officer->hasAnyRole(['security_officer', 'admin'])) {
            throw ValidationException::withMessages(['officer' => 'Incidents can only be assigned to security staff.']);
        }

        return DB::transaction(function () use ($incident, $officer, $actor) {
            $incident->update([
                'assigned_to' => $officer->id,
                'status' => $incident->status === SecurityIncident::STATUS_REPORTED
                    ? SecurityIncident::STATUS_UNDER_REVIEW
                    : $incident->status,
            ]);

            $this->audit->log(
                'incident.assigned',
                $incident,
                "Security incident #{$incident->id} assigned to {$officer->name} by {$actor->name}.",
                actor: $actor,
            );

            $officer->notify(new SclfNotification(
                type: SclfNotification::TYPE_INCIDENT_ASSIGNED,
                title: 'Incident Assigned To You',
                message: "\"{$incident->title}\" was assigned to you by {$actor->name}.",
                relatedType: SecurityIncident::class,
                relatedId: $incident->id,
            ));

            return $incident->fresh();
        });
    }

    /**
     * Mark an incident resolved with a required explanation of the
     * outcome. Not terminal by itself — resolved incidents can still be
     * reopened if something new comes up, or closed to archive them once
     * everyone's satisfied. See close()/reopen().
     */
    public function resolve(SecurityIncident $incident, User $officer, string $notes): SecurityIncident
    {
        if ($incident->isTerminal()) {
            throw ValidationException::withMessages(['status' => 'Closed incidents cannot be resolved again.']);
        }

        return DB::transaction(function () use ($incident, $officer, $notes) {
            $incident->update([
                'status' => SecurityIncident::STATUS_RESOLVED,
                'resolution_notes' => $notes,
                'resolved_by' => $officer->id,
                'resolved_at' => now(),
            ]);

            $this->audit->log(
                'incident.resolved',
                $incident,
                "Security incident #{$incident->id} resolved by {$officer->name}.",
                actor: $officer,
            );

            return $incident->fresh();
        });
    }

    /**
     * Archive a resolved incident. Terminal, like FoundItem::STATUS_DISPOSED —
     * only reachable from "resolved" so nobody accidentally closes a
     * still-open case.
     */
    public function close(SecurityIncident $incident, User $officer): SecurityIncident
    {
        if ($incident->status !== SecurityIncident::STATUS_RESOLVED) {
            throw ValidationException::withMessages(['status' => 'Only resolved incidents can be closed.']);
        }

        return DB::transaction(function () use ($incident, $officer) {
            $incident->update([
                'status' => SecurityIncident::STATUS_CLOSED,
                'closed_at' => now(),
            ]);

            $this->audit->log(
                'incident.closed',
                $incident,
                "Security incident #{$incident->id} closed by {$officer->name}.",
                actor: $officer,
            );

            return $incident->fresh();
        });
    }

    /**
     * Bring a resolved incident back to "under_review" — something new
     * came up, or the resolution didn't hold. Not available once closed:
     * a closed case that needs to reopen is an exception for a human to
     * handle directly (e.g. report a fresh incident referencing it),
     * same design choice as DispositionService::restore() being blocked
     * once an item is actually disposed.
     */
    public function reopen(SecurityIncident $incident, User $officer, ?string $notes = null): SecurityIncident
    {
        if ($incident->status !== SecurityIncident::STATUS_RESOLVED) {
            throw ValidationException::withMessages(['status' => 'Only resolved incidents can be reopened.']);
        }

        return DB::transaction(function () use ($incident, $officer, $notes) {
            $incident->update([
                'status' => SecurityIncident::STATUS_UNDER_REVIEW,
                'resolved_at' => null,
            ]);

            $this->audit->log(
                'incident.reopened',
                $incident,
                "Security incident #{$incident->id} reopened by {$officer->name}." . ($notes ? " Reason: {$notes}" : ''),
                actor: $officer,
            );

            return $incident->fresh();
        });
    }
}
