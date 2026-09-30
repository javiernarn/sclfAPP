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
    protected function notifyAdmins(string $type, string $title, string $message, ActionRequest $request): void
    {
        try {
            User::role('admin')->where('is_active', true)->get()->each(
                fn (User $admin) => $admin->notify(new SclfNotification($type, $title, $message, ActionRequest::class, $request->id))
            );
        } catch (\Throwable $e) {
            report($e);
        }
    }

    protected function notifyRequester(string $type, string $title, string $message, ActionRequest $request): void
    {
        try {
            $request->requester?->notify(new SclfNotification($type, $title, $message, ActionRequest::class, $request->id));
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
            'Staff Action Completed',
            "{$user->name} carried out the approved request: {$approval->summary}.",
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

        $existing = ActionRequest::query()
            ->where('requester_id', $staff->id)
            ->where('method', $method)
            ->where('route_uri', $uri)
            ->where('subject_key', $subject)
            ->whereIn('status', [ActionRequest::STATUS_PENDING, ActionRequest::STATUS_APPROVED])
            ->latest()
            ->first();

        if ($existing) {
            return $existing;
        }

        $request = ActionRequest::create([
            'requester_id' => $staff->id,
            'method' => $method,
            'route_uri' => $uri,
            'subject_key' => $subject,
            'summary' => $summary ? mb_substr($summary, 0, 255) : $this->describe($method, $uri, $subject),
            'reason' => $reason,
            'payload' => $payload ? $this->sanitisePayload($payload) : null,
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
            'Staff Approval Request',
            "{$staff->name} is asking to: {$request->summary}." . ($reason ? " Reason: " . \Illuminate\Support\Str::limit($reason, 120) : ''),
            $request,
        );

        return $request;
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
    public function describe(string $method, string $uri, ?string $subject): string
    {
        $id = null;
        if ($subject && preg_match('/=(\d+)/', $subject, $m)) {
            $id = $m[1];
        }
        $target = $id ? " #{$id}" : '';

        $known = [
            'POST api/admin/users' => 'Create a user account',
            'PUT api/admin/users/{user}' => "Edit user{$target}",
            'DELETE api/admin/users/{user}' => "Disable user{$target}",
            'POST api/admin/users/{id}/restore' => "Re-enable user{$target}",
            'DELETE api/admin/users/{user}/claims/cancelled' => "Delete cancelled claims of user{$target}",
            'DELETE api/claims/{claim}' => "Delete claim{$target}",
            'PATCH api/claims/{claim}/review' => "Review claim{$target}",
            'DELETE api/lost-items/{lostItem}' => "Delete lost item{$target}",
            'POST api/admin/departments' => 'Create a department',
            'PUT api/admin/departments/{department}' => "Edit department{$target}",
            'DELETE api/admin/departments/{department}' => "Delete department{$target}",
            'DELETE api/storage-locations/{storageLocation}' => "Delete storage location{$target}",
            'PATCH api/storage-locations/{storageLocation}' => "Edit storage location{$target}",
            'POST api/storage-locations' => 'Create a storage location',
            'DELETE api/visitors/{visitor}' => "Delete visitor record{$target}",
            'DELETE api/assets/{asset}' => "Delete asset{$target}",
            'PATCH api/assets/{asset}' => "Edit asset{$target}",
            'POST api/assets' => 'Register an asset',
            'DELETE api/security-incidents/{securityIncident}' => "Delete incident{$target}",
        ];

        return $known[strtoupper($method) . ' ' . $uri]
            ?? strtoupper($method) . ' /' . preg_replace('#^api/#', '', $uri) . ($subject ? " ({$subject})" : '');
    }
}
