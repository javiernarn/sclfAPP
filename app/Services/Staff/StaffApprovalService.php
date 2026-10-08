<?php

namespace App\Services\Staff;

use App\Models\ActionRequest;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Audit\AuditLogService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Everything about the "staff asks, admin approves, staff executes" flow
 * that isn't HTTP plumbing:
 *
 *  - turning a URL the staff member just tried into a stable signature
 *  - looking up / consuming an approval for that signature
 *  - a readable one-line summary for the admin's review screen
 */
class StaffApprovalService
{
    public const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    /** Keys never copied into a request's payload preview. */
    private const SENSITIVE_KEY = '/pass|token|secret|otp|code/i';

    public function __construct(protected AuditLogService $audit)
    {
    }

    /**
     * Notifications go to a specific user id (the bell is per-account):
     * new request / executed action -> every active admin;
     * approve / reject / pending -> the staff member who asked.
     * A failed notification (e.g. a dead push endpoint) must never undo or
     * block the approval workflow itself, so it is reported and swallowed.
     */
    protected function notifyAdmins(string $type, string $title, string $message, ActionRequest $request, array $extra = []): void
    {
        try {
            User::role('admin')->where('is_active', true)->get()->each(
                fn (User $admin) => $admin->notify(new SclfNotification($type, $title, $message, ActionRequest::class, $request->id, $extra))
            );
        } catch (\Throwable $e) {
            report($e);
        }
    }

    protected function notifyRequester(string $type, string $title, string $message, ActionRequest $request): void
    {
        try {
            $request->requester?->notify(new SclfNotification(
                $type, $title, $message, ActionRequest::class, $request->id,
                ['link' => '/app/notifications']
            ));
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function isExempt(Request $request): bool
    {
        return $request->is(...config('sclf.staff_approval.exempt_paths', []));
    }

    /**
     * Stable identity of "this action on this record".
     * Works whether or not implicit route-model binding has already run
     * (a bound parameter is a Model, an unbound one is a raw id string).
     *
     * @return array{0: string, 1: ?string} [route pattern, "param=value&..."]
     */
    public function signature(Route $route): array
    {
        $parts = [];
        foreach ($route->parameters() as $name => $value) {
            if ($value instanceof Model) {
                $value = $value->getKey();
            }
            if (is_scalar($value)) {
                $parts[$name] = "{$name}={$value}";
            }
        }
        ksort($parts);

        return [$route->uri(), $parts ? implode('&', $parts) : null];
    }

    /** The oldest usable approval for this exact action, if any. */
    public function findApproved(User $user, string $method, Route $route): ?ActionRequest
    {
        [$uri, $subject] = $this->signature($route);

        return ActionRequest::query()
            ->where('requester_id', $user->id)
            ->where('method', strtoupper($method))
            ->where('route_uri', $uri)
            ->where('subject_key', $subject)
            ->where('status', ActionRequest::STATUS_APPROVED)
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->oldest('reviewed_at')
            ->first();
    }

    /**
     * Fields the admin approved are frozen: if the approved request named a
     * role (e.g. Instructor) the staff member cannot use that approval to
     * create a different one (e.g. Security Officer).
     *
     * @return string|null a human message when the live request does not match, else null
     */
    public function lockedFieldMismatch(ActionRequest $approval, Request $request): ?string
    {
        $fields = config('sclf.staff_approval.locked_fields.' . strtoupper($approval->method) . ' ' . $approval->route_uri, []);

        foreach ($fields as $field) {
            $approved = $approval->payload[$field] ?? null;
            $actual = $request->input($field);

            // Nothing was sent for this field (e.g. an edit that leaves the role alone): nothing to abuse.
            if ($actual === null || $actual === '') {
                if ($approved !== null && strtoupper($approval->method) === 'POST') {
                    return "This approval is for a specific {$field}. Send the {$field} that was approved.";
                }
                continue;
            }

            if ($approved === null || (string) $approved !== (string) $actual) {
                $label = str_replace('_', ' ', (string) ($approved ?? 'none'));

                return "This approval only covers {$field} '{$label}'. Ask the admin for a new approval to use a different {$field}.";
            }
        }

        return null;
    }

    /** Called after the approved action actually succeeded. Approvals are single-use. */
    public function markExecuted(ActionRequest $approval, User $user): void
    {
        $approval->update([
            'status' => ActionRequest::STATUS_EXECUTED,
            'executed_at' => now(),
        ]);

        $this->audit->log(
            'staff.action_executed',
            $approval,
            "Staff #{$user->id} executed approved request #{$approval->id}: {$approval->summary}",
            null,
            null,
            $user,
        );

        $this->notifyAdmins(
            SclfNotification::TYPE_STAFF_REQUEST_EXECUTED,
            'Staff ' . $this->crudLabel($approval->method) . ' Completed',
            "{$user->name} carried out the approved {$this->crudWord($approval->method)}: {$approval->summary}.",
            $approval,
        );
    }

    /**
     * Resolve a method + path (e.g. DELETE "api/admin/users/5") to the route
     * it would hit, using the app's own router — so the client can never
     * claim an approval for a route it isn't really calling.
     */
    public function resolveRoute(string $method, string $path): Route
    {
        $path = '/' . ltrim(parse_url($path, PHP_URL_PATH) ?: $path, '/');
        $probe = Request::create($path, strtoupper($method));

        try {
            return app('router')->getRoutes()->match($probe);
        } catch (HttpException) {
            throw ValidationException::withMessages([
                'path' => ['That action does not exist.'],
            ]);
        }
    }

    /**
     * Create (or return the already-open) request for an action.
     * Re-asking for something that's already pending/approved just returns it.
     */
    public function submit(User $staff, string $method, string $path, ?string $reason, ?string $summary, ?array $payload): ActionRequest
    {
        $method = strtoupper($method);
        $route = $this->resolveRoute($method, $path);
        [$uri, $subject] = $this->signature($route);

        // A request for something the staff member could already do freely
        // (or for the request endpoints themselves) makes no sense.
        $probe = Request::create('/' . ltrim($path, '/'), $method);
        if ($this->isExempt($probe)) {
            throw ValidationException::withMessages([
                'path' => ['That action does not need approval.'],
            ]);
        }

        // A locked field (e.g. the role of a new account) must be named in the
        // request, so the admin knows exactly what they are approving.
        $payload = $payload ? $this->sanitisePayload($payload) : null;
        foreach (config('sclf.staff_approval.locked_fields.' . $method . ' ' . $uri, []) as $field) {
            if ($method === 'POST' && empty($payload[$field] ?? null)) {
                throw ValidationException::withMessages([
                    'payload' => ["Choose the {$field} you need so the admin knows what to approve."],
                ]);
            }
        }

        $existing = ActionRequest::query()
            ->where('requester_id', $staff->id)
            ->where('method', $method)
            ->where('route_uri', $uri)
            ->where('subject_key', $subject)
            ->whereIn('status', [ActionRequest::STATUS_PENDING, ActionRequest::STATUS_APPROVED])
            ->latest()
            ->first();

        // Same action but a different locked value (Instructor vs Security
        // Officer) is a different request, not a duplicate.
        if ($existing && $this->samePayloadLocks($existing, $method, $uri, $payload)) {
            return $existing;
        }

        $request = ActionRequest::create([
            'requester_id' => $staff->id,
            'method' => $method,
            'route_uri' => $uri,
            'subject_key' => $subject,
            'summary' => $summary ? mb_substr($summary, 0, 255) : $this->describe($method, $uri, $subject, $payload),
            'reason' => $reason,
            'payload' => $payload,
            'status' => ActionRequest::STATUS_PENDING,
        ]);

        $this->audit->log(
            'staff.request_created',
            $request,
            "Staff #{$staff->id} requested approval: {$request->summary}",
            null,
            null,
            $staff,
        );

        $this->notifyAdmins(
            SclfNotification::TYPE_STAFF_REQUEST_SUBMITTED,
            'Staff ' . $this->crudLabel($method) . ' Request',
            "{$staff->name} is asking to: {$request->summary}." . ($reason ? " Reason: " . \Illuminate\Support\Str::limit($reason, 120) : ''),
            $request,
        );

        return $request;
    }

    protected function samePayloadLocks(ActionRequest $existing, string $method, string $uri, ?array $payload): bool
    {
        foreach (config('sclf.staff_approval.locked_fields.' . $method . ' ' . $uri, []) as $field) {
            if ((string) ($existing->payload[$field] ?? '') !== (string) ($payload[$field] ?? '')) {
                return false;
            }
        }

        return true;
    }

    /** Staff withdrew their own pending request — the admin's bell should know it's gone. */
    public function withdraw(ActionRequest $request, User $staff): void
    {
        $summary = $request->summary;
        $method = $request->method;
        $id = $request->id;

        $this->audit->log(
            'staff.request_withdrawn',
            $request,
            "Staff #{$staff->id} withdrew request #{$id}: {$summary}",
            null,
            null,
            $staff,
        );

        $request->delete();

        // The record is gone, so link to the queue instead of a dead row.
        try {
            User::role('admin')->where('is_active', true)->get()->each(
                fn (User $admin) => $admin->notify(new SclfNotification(
                    SclfNotification::TYPE_STAFF_REQUEST_WITHDRAWN,
                    'Staff ' . $this->crudLabel($method) . ' Request Withdrawn',
                    "{$staff->name} withdrew their request: {$summary}.",
                    null,
                    null,
                    ['link' => '/app/admin/requests'],
                ))
            );
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /** POST -> Create, PUT/PATCH -> Edit, DELETE -> Delete. */
    protected function crudLabel(string $method): string
    {
        return match (strtoupper($method)) {
            'POST' => 'Create',
            'PUT', 'PATCH' => 'Edit',
            'DELETE' => 'Delete',
            default => 'Action',
        };
    }

    protected function crudWord(string $method): string
    {
        return strtolower($this->crudLabel($method)) . ' request';
    }

    /** Admin sets pending / approved / rejected. */
    public function review(ActionRequest $request, User $admin, string $status, ?string $note): ActionRequest
    {
        if ($request->status === ActionRequest::STATUS_EXECUTED) {
            abort(422, 'This request was already carried out and can no longer be changed.');
        }

        $before = $request->only('status', 'review_note');

        $request->update([
            'status' => $status,
            'review_note' => $note,
            'reviewer_id' => $status === ActionRequest::STATUS_PENDING ? null : $admin->id,
            'reviewed_at' => $status === ActionRequest::STATUS_PENDING ? null : now(),
            'expires_at' => $status === ActionRequest::STATUS_APPROVED
                ? now()->addHours((int) config('sclf.staff_approval.ttl_hours', 24))
                : null,
        ]);

        $this->audit->log(
            'staff.request_' . $status,
            $request,
            "Admin #{$admin->id} set request #{$request->id} to {$status}: {$request->summary}",
            $before,
            $request->only('status', 'review_note'),
            $admin,
        );

        [$type, $title, $verb] = match ($status) {
            ActionRequest::STATUS_APPROVED => [SclfNotification::TYPE_STAFF_REQUEST_APPROVED, 'Request Approved', 'approved'],
            ActionRequest::STATUS_REJECTED => [SclfNotification::TYPE_STAFF_REQUEST_REJECTED, 'Request Rejected', 'rejected'],
            default => [SclfNotification::TYPE_STAFF_REQUEST_PENDING, 'Request On Hold', 'put on hold'],
        };
        $tail = $status === ActionRequest::STATUS_APPROVED
            ? ' You can do it now — it works once and expires in ' . (int) config('sclf.staff_approval.ttl_hours', 24) . ' hours.'
            : ($note ? " Note: {$note}" : '');

        $this->notifyRequester($type, $title, "The admin {$verb} your request: {$request->summary}.{$tail}", $request);

        return $request->fresh(['requester:id,name,email,staff_id', 'reviewer:id,name']);
    }

    public function sanitisePayload(array $payload): array
    {
        $clean = [];
        foreach ($payload as $key => $value) {
            if (!is_string($key) || preg_match(self::SENSITIVE_KEY, $key)) {
                continue;
            }
            if (is_scalar($value) || $value === null) {
                $clean[$key] = is_string($value) ? mb_substr($value, 0, 300) : $value;
            }
        }

        return array_slice($clean, 0, 25, true);
    }

    /** "PUT api/admin/users/{user}" + "user=5" -> "Edit user #5" (falls back to a generic line). */
    public function describe(string $method, string $uri, ?string $subject, ?array $payload = null): string
    {
        $id = null;
        if ($subject && preg_match('/=(\d+)/', $subject, $m)) {
            $id = $m[1];
        }
        $target = $id ? " #{$id}" : '';

        $known = [
            // Users
            'POST api/admin/users' => 'Create a user account',
            'PUT api/admin/users/{user}' => "Edit user{$target}",
            'DELETE api/admin/users/{user}' => "Disable user{$target}",
            'POST api/admin/users/{id}/restore' => "Re-enable user{$target}",
            'DELETE api/admin/users/{user}/claims/cancelled' => "Delete cancelled claims of user{$target}",
            'POST api/admin/departments' => 'Create a department',
            'PUT api/admin/departments/{department}' => "Edit department{$target}",
            'DELETE api/admin/departments/{department}' => "Delete department{$target}",
            // Lost & found, matches, claims
            'DELETE api/lost-items/{lostItem}' => "Delete lost item{$target}",
            'POST api/found-items/{foundItem}/verify' => "Review found item report{$target} (accept or reject)",
            'POST api/matches/{match}/notify-owner' => "Confirm match{$target} and notify the owner",
            'POST api/matches/{match}/dismiss' => "Dismiss match{$target}",
            'DELETE api/claims/{claim}' => "Delete claim{$target}",
            'PATCH api/claims/{claim}/review' => "Review claim{$target} (approve or reject)",
            'POST api/claims/{claim}/generate-release' => "Generate release for claim{$target}",
            'POST api/claims/{claim}/regenerate-release' => "Regenerate release for claim{$target}",
            'POST api/claims/{claim}/manual-release' => "Manually release claim{$target}",
            'POST api/qr/{qrRelease}/revoke' => "Revoke QR release{$target}",
            // Inventory
            'POST api/storage-locations' => 'Create a storage location',
            'PATCH api/storage-locations/{storageLocation}' => "Edit storage location{$target}",
            'PATCH api/storage-locations/{storageLocation}/capacity' => "Change capacity of storage location{$target}",
            'PATCH api/storage-locations/{storageLocation}/status' => "Change status of counter{$target}",
            'DELETE api/storage-locations/{storageLocation}' => "Delete storage location{$target}",
            'POST api/found-items/{foundItem}/assign-storage' => "Shelve found item{$target}",
            'POST api/found-items/{foundItem}/move-storage' => "Move found item{$target} to another location",
            'POST api/found-items/{foundItem}/dispose' => "Dispose of unclaimed item{$target}",
            'POST api/found-items/{foundItem}/restore' => "Restore disposed item{$target}",
            'POST api/inventory/unclaimed/sweep' => 'Sweep unclaimed items',
            // Counter
            'POST api/counter/check-in' => 'Check an item in at the counter',
            'POST api/storage-locations/{storageLocation}/officers' => "Assign an officer to counter{$target}",
            'DELETE api/storage-locations/{storageLocation}/officers/{user}' => "Remove an officer from counter{$target}",
            'POST api/storage-locations/{storageLocation}/queue/call-next' => "Call the next person at counter{$target}",
            // Incidents, service requests, visitors, assets
            'POST api/security-incidents' => 'Report an incident',
            'PATCH api/security-incidents/{securityIncident}' => "Edit incident{$target}",
            'DELETE api/security-incidents/{securityIncident}' => "Delete incident{$target}",
            'POST api/security-incidents/{securityIncident}/assign' => "Assign incident{$target}",
            'POST api/security-incidents/{securityIncident}/resolve' => "Resolve incident{$target}",
            'POST api/security-incidents/{securityIncident}/close' => "Close incident{$target}",
            'POST api/security-incidents/{securityIncident}/reopen' => "Reopen incident{$target}",
            'POST api/service-requests' => 'File a service request',
            'POST api/service-requests/{serviceRequest}/assign' => "Assign service request{$target}",
            'POST api/service-requests/{serviceRequest}/start' => "Start service request{$target}",
            'POST api/service-requests/{serviceRequest}/complete' => "Complete service request{$target}",
            'POST api/service-requests/{serviceRequest}/close' => "Close service request{$target}",
            'POST api/service-requests/{serviceRequest}/reopen' => "Reopen service request{$target}",
            'POST api/visitors' => 'Log a visitor',
            'POST api/visitors/{visitor}/check-out' => "Check out visitor{$target}",
            'PATCH api/visitors/{visitor}' => "Edit visitor record{$target}",
            'DELETE api/visitors/{visitor}' => "Delete visitor record{$target}",
            'POST api/assets' => 'Register an asset',
            'PATCH api/assets/{asset}' => "Edit asset{$target}",
            'DELETE api/assets/{asset}' => "Delete asset{$target}",
            'POST api/assets/{asset}/assign' => "Assign asset{$target}",
            'POST api/assets/{asset}/unassign' => "Unassign asset{$target}",
            'POST api/assets/{asset}/send-for-repair' => "Send asset{$target} for repair",
            'POST api/assets/{asset}/return-from-repair' => "Return asset{$target} from repair",
            'POST api/assets/{asset}/retire' => "Retire asset{$target}",
            'POST api/assets/{asset}/report-lost' => "Report asset{$target} lost",
        ];

        $role = isset($payload['role']) ? ucwords(str_replace('_', ' ', (string) $payload['role'])) : null;
        if ($role && strtoupper($method) . ' ' . $uri === 'POST api/admin/users') {
            return "Create a {$role} account";
        }

        return $known[strtoupper($method) . ' ' . $uri]
            ?? strtoupper($method) . ' /' . preg_replace('#^api/#', '', $uri) . ($subject ? " ({$subject})" : '');
    }
}
