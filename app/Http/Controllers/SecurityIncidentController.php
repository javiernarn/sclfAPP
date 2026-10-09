<?php

namespace App\Http\Controllers;

use App\Models\ReportAttachment;
use App\Models\SecurityIncident;
use App\Models\User;
use App\Services\Attachments\ReportAttachmentService;
use App\Services\Incidents\IncidentService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SecurityIncidentController extends Controller
{
    public function __construct(
        protected IncidentService $incidents,
        protected ReportAttachmentService $attachments,
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
        $isStaff = $viewer->hasAnyRole(['security_officer', 'admin', 'staff']);

        $query = SecurityIncident::query()
            ->with(['reporter:id,name', 'assignee:id,name', 'assignee.roles:id,name', 'campus:id,name,code'])
            ->when(!$isStaff, fn ($q) => $q->where('reported_by', $viewer->id))
            ->when(
                $isStaff && $viewer->campus_id && !$viewer->hasAdminAccess(),
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
        ] + ReportAttachment::rules(), ReportAttachment::messages());

        try {
            $incident = $this->incidents->report($request->user(), $validated);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        // Optional photo/video evidence. The report itself is already
        // saved, so a storage hiccup here is surfaced as a warning rather
        // than failing (and losing) the whole report.
        $attachmentError = null;
        try {
            $this->attachments->attach($incident, $request->user(), $request->file('attachments', []));
        } catch (\Throwable $e) {
            report($e);
            $attachmentError = 'Your report was filed, but the photos/videos could not be saved. You can tell Security directly or file a new report with them.';
        }

        return response()->json([
            'success' => true,
            'data' => $incident,
            'attachment_error' => $attachmentError,
        ], 201);
    }

    public function show(Request $request, SecurityIncident $securityIncident)
    {
        $this->authorize('view', $securityIncident);

        return response()->json(['data' => $this->withDetails($securityIncident)]);
    }

    /**
     * Everything the detail page needs to show WHO is involved. The people
     * come with their roles and their ID (student_id / staff_id feed the
     * `display_id` accessor, so they must be selected) — otherwise the page
     * could only print a bare name and viewers couldn't tell an admin from a
     * guard. Also used for the lifecycle endpoints below: ->fresh() drops
     * every relation, which used to leave "Resolved by" blank right after
     * pressing Mark Resolved until the page was reloaded.
     */
    protected function withDetails(SecurityIncident $incident): SecurityIncident
    {
        return $incident->load([
            'reporter:id,name,email',
            'assignee:id,name,student_id,staff_id',
            'assignee.roles:id,name',
            'resolver:id,name,student_id,staff_id',
            'resolver.roles:id,name',
            'campus:id,name,code',
            'relatedFoundItem:id,item_name,status',
            'attachments',
        ]);
    }

    /**
     * Edit a report's details. The reporter may fix their own report only
     * while it's brand new (still 'reported' — see
     * SecurityIncidentPolicy::update()); staff can edit anytime short of
     * closed. Status itself doesn't change here — that's assign/resolve/
     * close/reopen's job.
     */
    public function update(Request $request, SecurityIncident $securityIncident)
    {
        $this->authorize('update', $securityIncident);

        $validated = $request->validate([
            'category' => 'required|string|in:' . implode(',', SecurityIncident::CATEGORIES),
            'severity' => 'nullable|string|in:' . implode(',', SecurityIncident::SEVERITIES),
            'title' => 'required|string|max:150',
            'description' => 'required|string|max:5000',
            'location_text' => 'nullable|string|max:255',
            'occurred_at' => 'required|date|before_or_equal:now',
        ]);

        try {
            $incident = $this->incidents->update($securityIncident, $request->user(), $validated);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Report updated.', 'data' => $this->withDetails($incident)]);
    }

    /**
     * Admin-only: permanently remove an incident report (soft delete).
     * See SecurityIncidentPolicy::delete() for why this is more
     * restricted than 'manage'.
     */
    public function destroy(Request $request, SecurityIncident $securityIncident)
    {
        $this->authorize('delete', $securityIncident);

        $this->incidents->delete($securityIncident, $request->user());

        return response()->json(['success' => true, 'message' => 'Incident deleted.']);
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

        return response()->json(['success' => true, 'message' => "Assigned to {$officer->name}.", 'data' => $this->withDetails($incident)]);
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

        return response()->json(['success' => true, 'message' => 'Incident resolved.', 'data' => $this->withDetails($incident)]);
    }

    public function close(Request $request, SecurityIncident $securityIncident)
    {
        $this->authorize('manage', SecurityIncident::class);

        try {
            $incident = $this->incidents->close($securityIncident, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Incident closed.', 'data' => $this->withDetails($incident)]);
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

        return response()->json(['success' => true, 'message' => 'Incident reopened.', 'data' => $this->withDetails($incident)]);
    }
}
