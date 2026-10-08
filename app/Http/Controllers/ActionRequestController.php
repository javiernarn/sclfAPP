<?php

namespace App\Http\Controllers;

use App\Models\ActionRequest;
use App\Services\Staff\StaffApprovalService;
use Illuminate\Http\Request;

/**
 * Approval requests between the single admin and staff accounts.
 *
 *  - staff:  file a request, cancel a pending one (the admin is notified of both)
 *  - admin:  see every request, set it to pending / approved / rejected
 */
class ActionRequestController extends Controller
{
    public function __construct(protected StaffApprovalService $approvals)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $requests = ActionRequest::query()
            ->with(['requester:id,name,email,staff_id', 'reviewer:id,name'])
            // Staff only ever see their own; the admin sees everyone's.
            ->when(!$user->hasRole('admin'), fn ($q) => $q->where('requester_id', $user->id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('requester_id') && $user->hasRole('admin'), fn ($q) => $q->where('requester_id', $request->integer('requester_id')))
            // Pending first so the admin's queue is at the top.
            ->orderByRaw("CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END")
            ->latest()
            ->paginate(15);

        return response()->json([
            'data' => $requests->items(),
            'meta' => [
                'current_page' => $requests->currentPage(),
                'last_page' => $requests->lastPage(),
                'total' => $requests->total(),
                'pending_count' => ActionRequest::where('status', ActionRequest::STATUS_PENDING)
                    ->when(!$user->hasRole('admin'), fn ($q) => $q->where('requester_id', $user->id))
                    ->count(),
            ],
        ]);
    }

    /** Staff only — the admin never needs approval. */
    public function store(Request $request)
    {
        abort_unless($request->user()->hasRole('staff') && !$request->user()->hasRole('admin'), 403, 'Only staff accounts send approval requests.');

        $data = $request->validate([
            'method' => ['required', 'in:POST,PUT,PATCH,DELETE'],
            'path' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string', 'min:3', 'max:1000'],
            'summary' => ['nullable', 'string', 'max:255'],
            'payload' => ['nullable', 'array'],
        ], [
            'reason.required' => 'Please tell the admin why you need this.',
            'reason.min' => 'Please tell the admin why you need this.',
        ]);

        $actionRequest = $this->approvals->submit(
            $request->user(),
            $data['method'],
            $data['path'],
            $data['reason'],
            $data['summary'] ?? null,
            $data['payload'] ?? null,
        );

        return response()->json([
            'success' => true,
            'message' => $actionRequest->wasRecentlyCreated
                ? 'Request sent to the admin.'
                : 'You already have an open request for this action.',
            'data' => $actionRequest,
        ], $actionRequest->wasRecentlyCreated ? 201 : 200);
    }

    /** Admin: Approve / Pending / Reject. */
    public function updateStatus(Request $request, ActionRequest $actionRequest)
    {
        abort_unless($request->user()->hasRole('admin'), 403, 'Only the admin can review requests.');

        $data = $request->validate([
            'status' => ['required', 'in:' . implode(',', ActionRequest::REVIEW_STATUSES)],
            'review_note' => ['nullable', 'string', 'max:500'],
        ]);

        $updated = $this->approvals->review($actionRequest, $request->user(), $data['status'], $data['review_note'] ?? null);

        return response()->json(['success' => true, 'message' => 'Request updated.', 'data' => $updated]);
    }

    /** Staff can withdraw their own request while it is still pending. */
    public function cancel(Request $request, ActionRequest $actionRequest)
    {
        abort_unless($actionRequest->requester_id === $request->user()->id, 403);
        abort_unless($actionRequest->status === ActionRequest::STATUS_PENDING, 422, 'Only pending requests can be withdrawn.');

        $this->approvals->withdraw($actionRequest, $request->user());

        return response()->json(['success' => true, 'message' => 'Request withdrawn.']);
    }
}
