<?php

namespace App\Services\Facilities;

use App\Models\Department;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Audit\AuditLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Submit -> acknowledge -> in_progress -> complete -> close lifecycle for
 * facilities/IT/maintenance service requests, plus a requester-initiated
 * cancel. Mirrors IncidentService's shape (small transactional methods,
 * each validating current status, each audit-logged) with two additions
 * incidents don't need: department routing and cancel().
 */
class ServiceRequestService
{
    public function __construct(
        protected AuditLogService $audit,
    ) {
    }

    /**
     * Anyone authenticated may file a request — a student noticing a
     * leaking faucet shouldn't have to find a staff member to log it.
     */
    public function submit(User $requester, array $data): ServiceRequest
    {
        if (!in_array($data['category'], ServiceRequest::CATEGORIES, true)) {
            throw ValidationException::withMessages(['category' => 'Invalid request category.']);
        }

        if (!in_array($data['priority'] ?? ServiceRequest::PRIORITY_MEDIUM, ServiceRequest::PRIORITIES, true)) {
            throw ValidationException::withMessages(['priority' => 'Invalid priority.']);
        }

        $campusId = $data['campus_id'] ?? $requester->campus_id;

        if (!empty($data['department_id'])) {
            $department = Department::find($data['department_id']);
            if (!$department || ($campusId && $department->campus_id !== $campusId)) {
                throw ValidationException::withMessages(['department_id' => 'Invalid department for this campus.']);
            }
        }

        return DB::transaction(function () use ($requester, $data, $campusId) {
            $request = ServiceRequest::create([
                'campus_id' => $campusId,
                'requested_by' => $requester->id,
                'department_id' => $data['department_id'] ?? null,
                'category' => $data['category'],
                'priority' => $data['priority'] ?? ServiceRequest::PRIORITY_MEDIUM,
                'title' => $data['title'],
                'description' => $data['description'],
                'location_text' => $data['location_text'] ?? null,
                'status' => ServiceRequest::STATUS_SUBMITTED,
            ]);

            $this->audit->log(
                'service_request.submitted',
                $request,
                "Service request #{$request->id} ({$request->category}) submitted by {$requester->name}.",
                actor: $requester,
            );

            return $request;
        });
    }

    /**
     * Hand the request to a staff member. Auto-advances submitted ->
     * acknowledged, same reasoning as IncidentService::assign(); a
     * re-assignment past that point just changes who owns it.
     */
    public function assign(ServiceRequest $request, User $staff, User $actor): ServiceRequest
    {
        if ($request->isTerminal()) {
            throw ValidationException::withMessages(['status' => 'This request is already closed or cancelled.']);
        }

        if (!$staff->hasAnyRole(['security_officer', 'admin'])) {
            throw ValidationException::withMessages(['staff' => 'Requests can only be assigned to staff accounts.']);
        }

        return DB::transaction(function () use ($request, $staff, $actor) {
            $request->update([
                'assigned_to' => $staff->id,
                'status' => $request->status === ServiceRequest::STATUS_SUBMITTED
                    ? ServiceRequest::STATUS_ACKNOWLEDGED
                    : $request->status,
            ]);

            $this->audit->log(
                'service_request.assigned',
                $request,
                "Service request #{$request->id} assigned to {$staff->name} by {$actor->name}.",
                actor: $actor,
            );

            $staff->notify(new SclfNotification(
                type: SclfNotification::TYPE_SERVICE_REQUEST_ASSIGNED,
                title: 'Service Request Assigned To You',
                message: "\"{$request->title}\" was assigned to you by {$actor->name}.",
                relatedType: ServiceRequest::class,
                relatedId: $request->id,
            ));

            return $request->fresh();
        });
    }

    /**
     * Mark work as actually underway. Requires an acknowledged request
     * (i.e. someone's already assigned) — there's no point in "starting"
     * work nobody owns yet.
     */
    public function start(ServiceRequest $request, User $actor): ServiceRequest
    {
        if ($request->status !== ServiceRequest::STATUS_ACKNOWLEDGED) {
            throw ValidationException::withMessages(['status' => 'Only acknowledged requests can be started.']);
        }

        return DB::transaction(function () use ($request, $actor) {
            $request->update(['status' => ServiceRequest::STATUS_IN_PROGRESS]);

            $this->audit->log(
                'service_request.started',
                $request,
                "Service request #{$request->id} started by {$actor->name}.",
                actor: $actor,
            );

            return $request->fresh();
        });
    }

    /**
     * Mark the work done with a required note on what was actually done.
     * Not terminal by itself — see close()/reopen() — same two-step
     * "resolved then closed" pattern as IncidentService::resolve()/close().
     */
    public function complete(ServiceRequest $request, User $staff, string $notes): ServiceRequest
    {
        if ($request->isTerminal()) {
            throw ValidationException::withMessages(['status' => 'This request is already closed or cancelled.']);
        }

        return DB::transaction(function () use ($request, $staff, $notes) {
            $request->update([
                'status' => ServiceRequest::STATUS_COMPLETED,
                'completion_notes' => $notes,
                'completed_by' => $staff->id,
                'completed_at' => now(),
            ]);

            $this->audit->log(
                'service_request.completed',
                $request,
                "Service request #{$request->id} completed by {$staff->name}.",
                actor: $staff,
            );

            $request->requester?->notify(new SclfNotification(
                type: SclfNotification::TYPE_SERVICE_REQUEST_COMPLETED,
                title: 'Your Service Request Was Completed',
                message: "\"{$request->title}\" has been completed by {$staff->name}.",
                relatedType: ServiceRequest::class,
                relatedId: $request->id,
            ));

            return $request->fresh();
        });
    }

    /**
     * Archive a completed request. Terminal, like FoundItem::STATUS_DISPOSED —
     * only reachable from "completed".
     */
    public function close(ServiceRequest $request, User $actor): ServiceRequest
    {
        if ($request->status !== ServiceRequest::STATUS_COMPLETED) {
            throw ValidationException::withMessages(['status' => 'Only completed requests can be closed.']);
        }

        return DB::transaction(function () use ($request, $actor) {
            $request->update([
                'status' => ServiceRequest::STATUS_CLOSED,
                'closed_at' => now(),
            ]);

            $this->audit->log(
                'service_request.closed',
                $request,
                "Service request #{$request->id} closed by {$actor->name}.",
                actor: $actor,
            );

            return $request->fresh();
        });
    }

    /**
     * Bring a completed request back to "acknowledged" — the fix didn't
     * hold. Not available once closed, same design choice as
     * IncidentService::reopen().
     */
    public function reopen(ServiceRequest $request, User $actor, ?string $notes = null): ServiceRequest
    {
        if ($request->status !== ServiceRequest::STATUS_COMPLETED) {
            throw ValidationException::withMessages(['status' => 'Only completed requests can be reopened.']);
        }

        return DB::transaction(function () use ($request, $actor, $notes) {
            $request->update([
                'status' => ServiceRequest::STATUS_ACKNOWLEDGED,
                'completed_at' => null,
            ]);

            $this->audit->log(
                'service_request.reopened',
                $request,
                "Service request #{$request->id} reopened by {$actor->name}." . ($notes ? " Reason: {$notes}" : ''),
                actor: $actor,
            );

            return $request->fresh();
        });
    }

    /**
     * Requester-initiated cancel — the one action in this lifecycle
     * incidents don't have (see the migration's comment for why). Also
     * reachable by staff, since a request someone forgot about is
     * sometimes better closed out by whoever's tidying the queue than
     * left waiting on the original requester.
     */
    public function cancel(ServiceRequest $request, User $actor): ServiceRequest
    {
        if (!$request->isCancellable()) {
            throw ValidationException::withMessages(['status' => 'This request can no longer be cancelled.']);
        }

        return DB::transaction(function () use ($request, $actor) {
            $request->update([
                'status' => ServiceRequest::STATUS_CANCELLED,
                'cancelled_by' => $actor->id,
                'cancelled_at' => now(),
            ]);

            $this->audit->log(
                'service_request.cancelled',
                $request,
                "Service request #{$request->id} cancelled by {$actor->name}.",
                actor: $actor,
            );

            return $request->fresh();
        });
    }
}
