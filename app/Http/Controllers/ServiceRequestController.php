<?php

namespace App\Http\Controllers;

use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\Facilities\ServiceRequestService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ServiceRequestController extends Controller
{
    public function __construct(
        protected ServiceRequestService $requests,
    ) {
    }

    /**
     * Same "staff see everything on their campus, everyone else sees
     * only their own" scoping as SecurityIncidentController::index().
     */
    public function index(Request $request)
    {
        $viewer = $request->user();
        $isStaff = $viewer->hasAnyRole(['security_officer', 'admin']);

        $query = ServiceRequest::query()
            ->with(['requester:id,name', 'assignee:id,name', 'department:id,name', 'campus:id,name,code'])
            ->when(!$isStaff, fn ($q) => $q->where('requested_by', $viewer->id))
            ->when(
                $isStaff && $viewer->campus_id && !$viewer->hasRole('admin'),
                fn ($q) => $q->where('campus_id', $viewer->campus_id)
            )
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('priority'), fn ($q) => $q->where('priority', $request->string('priority')))
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->string('category')))
            ->orderByDesc('created_at');

        return response()->json(['data' => $query->paginate(20)]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', ServiceRequest::class);

        $validated = $request->validate([
            'category' => 'required|string|in:' . implode(',', ServiceRequest::CATEGORIES),
            'priority' => 'nullable|string|in:' . implode(',', ServiceRequest::PRIORITIES),
            'title' => 'required|string|max:150',
            'description' => 'required|string|max:5000',
            'location_text' => 'nullable|string|max:255',
            'department_id' => 'nullable|exists:departments,id',
        ]);

        try {
            $serviceRequest = $this->requests->submit($request->user(), $validated);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'data' => $serviceRequest], 201);
    }

    public function show(Request $request, ServiceRequest $serviceRequest)
    {
        $this->authorize('view', $serviceRequest);

        $serviceRequest->load([
            'requester:id,name,email',
            'assignee:id,name',
            'completedBy:id,name',
            'cancelledBy:id,name',
            'department:id,name',
            'campus:id,name,code',
        ]);

        return response()->json(['data' => $serviceRequest]);
    }

    public function assign(Request $request, ServiceRequest $serviceRequest)
    {
        $this->authorize('manage', ServiceRequest::class);

        $validated = $request->validate([
            'staff_id' => 'required|exists:users,id',
        ]);

        $staff = User::findOrFail($validated['staff_id']);

        try {
            $serviceRequest = $this->requests->assign($serviceRequest, $staff, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => "Assigned to {$staff->name}.", 'data' => $serviceRequest]);
    }

    public function start(Request $request, ServiceRequest $serviceRequest)
    {
        $this->authorize('manage', ServiceRequest::class);

        try {
            $serviceRequest = $this->requests->start($serviceRequest, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Work started.', 'data' => $serviceRequest]);
    }

    public function complete(Request $request, ServiceRequest $serviceRequest)
    {
        $this->authorize('manage', ServiceRequest::class);

        $validated = $request->validate([
            'completion_notes' => 'required|string|max:2000',
        ]);

        try {
            $serviceRequest = $this->requests->complete($serviceRequest, $request->user(), $validated['completion_notes']);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Request marked completed.', 'data' => $serviceRequest]);
    }

    public function close(Request $request, ServiceRequest $serviceRequest)
    {
        $this->authorize('manage', ServiceRequest::class);

        try {
            $serviceRequest = $this->requests->close($serviceRequest, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Request closed.', 'data' => $serviceRequest]);
    }

    public function reopen(Request $request, ServiceRequest $serviceRequest)
    {
        $this->authorize('manage', ServiceRequest::class);

        $validated = $request->validate([
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $serviceRequest = $this->requests->reopen($serviceRequest, $request->user(), $validated['notes'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Request reopened.', 'data' => $serviceRequest]);
    }

    public function cancel(Request $request, ServiceRequest $serviceRequest)
    {
        $this->authorize('cancel', $serviceRequest);

        try {
            $serviceRequest = $this->requests->cancel($serviceRequest, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Request cancelled.', 'data' => $serviceRequest]);
    }
}
