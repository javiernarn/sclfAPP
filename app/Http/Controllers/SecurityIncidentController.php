<?php

namespace App\Http\Controllers;

use App\Models\SecurityIncident;
use App\Models\User;
use App\Services\Incidents\IncidentService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SecurityIncidentController extends Controller
{
    public function __construct(
        protected IncidentService $incidents,
    ) {
    }

    /**
     * Security/admin see everything (campus-scoped, like every other
     * staff list in this app); a student/instructor only ever sees the
     * incidents they personally reported — this is a "My Reports" list
     * for them, not a general incident feed.
     */
    public function index(Request $request)
    {
        $viewer = $request->user();
        $isStaff = $viewer->hasAnyRole(['security_officer', 'admin']);

        $query = SecurityIncident::query()
            ->with(['reporter:id,name', 'assignee:id,name', 'campus:id,name,code'])
            ->when(!$isStaff, fn ($q) => $q->where('reported_by', $viewer->id))
            ->when(
                $isStaff && $viewer->campus_id && !$viewer->hasRole('admin'),
                fn ($q) => $q->where('campus_id', $viewer->campus_id)
            )
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('severity'), fn ($q) => $q->where('severity', $request->string('severity')))
            ->orderByDesc('occurred_at');

        return response()->json(['data' => $query->paginate(20)]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', SecurityIncident::class);

        $validated = $request->validate([
            'category' => 'required|string|in:' . implode(',', SecurityIncident::CATEGORIES),
            'severity' => 'nullable|string|in:' . implode(',', SecurityIncident::SEVERITIES),
            'title' => 'required|string|max:150',
            'description' => 'required|string|max:5000',
            'location_text' => 'nullable|string|max:255',
            'occurred_at' => 'required|date|before_or_equal:now',
            'related_found_item_id' => 'nullable|exists:found_items,id',
        ]);

        try {
            $incident = $this->incidents->report($request->user(), $validated);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'data' => $incident], 201);
    }

    public function show(Request $request, SecurityIncident $securityIncident)
    {
        $this->authorize('view', $securityIncident);

        $securityIncident->load([
            'reporter:id,name,email',
            'assignee:id,name',
            'resolver:id,name',
            'campus:id,name,code',
            'relatedFoundItem:id,item_name,status',
        ]);

        return response()->json(['data' => $securityIncident]);
    }

    public function assign(Request $request, SecurityIncident $securityIncident)
    {
        $this->authorize('manage', SecurityIncident::class);

        $validated = $request->validate([
            'officer_id' => 'required|exists:users,id',
        ]);

        $officer = User::findOrFail($validated['officer_id']);

        try {
            $incident = $this->incidents->assign($securityIncident, $officer, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => "Assigned to {$officer->name}.", 'data' => $incident]);
    }

    public function resolve(Request $request, SecurityIncident $securityIncident)
    {
        $this->authorize('manage', SecurityIncident::class);

        $validated = $request->validate([
            'resolution_notes' => 'required|string|max:2000',
        ]);

        try {
            $incident = $this->incidents->resolve($securityIncident, $request->user(), $validated['resolution_notes']);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Incident resolved.', 'data' => $incident]);
    }

    public function close(Request $request, SecurityIncident $securityIncident)
    {
        $this->authorize('manage', SecurityIncident::class);

        try {
            $incident = $this->incidents->close($securityIncident, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Incident closed.', 'data' => $incident]);
    }

    public function reopen(Request $request, SecurityIncident $securityIncident)
    {
        $this->authorize('manage', SecurityIncident::class);

        $validated = $request->validate([
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $incident = $this->incidents->reopen($securityIncident, $request->user(), $validated['notes'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Incident reopened.', 'data' => $incident]);
    }
}
