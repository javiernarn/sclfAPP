<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Visitor;
use App\Services\Visitors\BadgePoolService;
use App\Services\Visitors\PurposeDetails;
use App\Services\Visitors\VisitorService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Front-desk visitor log — officer/admin only, same inline role-check
 * style as DispositionController (no dedicated policy; there's no
 * per-owner view case here the way there is for incidents/claims, so a
 * policy class would just restate "security_officer or admin").
 */
class VisitorController extends Controller
{
    /**
     * Relations every visitor response carries. Roles ride along with the
     * officer relations so the UI can say "Security Officer Jane Doe"
     * instead of a bare name, and so a record returned right after
     * check-in / edit / check-out (which comes back from fresh(), with no
     * relations) still shows who handled it.
     */
    private const VISITOR_RELATIONS = [
        'checkedInBy:id,name',
        'checkedInBy.roles:id,name',
        'checkedOutBy:id,name',
        'checkedOutBy.roles:id,name',
        'campus:id,name,code',
        'student:id,name,student_id,course',
    ];

    public function __construct(
        protected VisitorService $visitors,
    ) {
    }

    /**
     * Defaults to who's currently on campus; pass ?history=1 for the
     * full checked-in + checked-out log instead.
     */
    /** Only the Security Officer may create or change visitors; Admin and Staff are read-only. */
    private function ensureCanManage(Request $request): void
    {
        if (! $request->user()->canManageVisitors()) {
            abort(403, 'Only a Security Officer can log or change visitors. You can view the visitor history.');
        }
    }

    public function index(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin', 'staff'])) {
            abort(403);
        }

        $viewer = $request->user();
        $scopeCampus = fn ($q) => $q->when(
            $viewer->campus_id && !$viewer->hasAdminAccess(),
            fn ($qq) => $qq->where('campus_id', $viewer->campus_id)
        );

        // status: inside (default; badge not returned) | checked_out | all.
        // ?history=1 is kept as an alias for "all" for older clients.
        $status = $request->string('status')->toString()
            ?: ($request->boolean('history') ? 'all' : 'inside');

        $query = match ($status) {
            'checked_out' => Visitor::query()->where('status', Visitor::STATUS_CHECKED_OUT),
            'all' => Visitor::query(),
            default => $this->visitors->currentlyOnCampusQuery(),
        };

        $search = trim($request->string('search')->toString());

        $query = $scopeCampus($query->with(self::VISITOR_RELATIONS))
            ->when($search !== '', function ($q) use ($search) {
                $like = '%' . $search . '%';
                // Visitor name, physical badge number, or the student
                // being visited (name / student ID).
                $q->where(function ($w) use ($like) {
                    $w->where('full_name', 'like', $like)
                        ->orWhere('badge_number', 'like', $like)
                        ->orWhere('student_name', 'like', $like)
                        ->orWhere('student_number', 'like', $like)
                        ->orWhere('host_name', 'like', $like);
                });
            })
            ->orderByDesc('checked_in_at');

        $todayStart = now()->startOfDay();

        return response()->json([
            'data' => $query->paginate(20),
            'currently_on_campus' => $scopeCampus($this->visitors->currentlyOnCampusQuery())->count(),
            'outstanding_badges' => $scopeCampus($this->visitors->outstandingBadgesQuery())
                ->get(['id', 'full_name', 'badge_number', 'checked_in_at'])
                ->map(fn ($v) => [
                    'id' => $v->id,
                    'badge_number' => $v->badge_number,
                    'full_name' => $v->full_name,
                    'checked_in_at' => $v->checked_in_at,
                ])->values(),
            // Live board: who is inside right now, by purpose, and who has stayed too long.
            'live' => [
                'by_purpose' => $scopeCampus($this->visitors->currentlyOnCampusQuery())
                    ->selectRaw('purpose, count(*) as total')->groupBy('purpose')->pluck('total', 'purpose'),
                // Inside longer than the stay they declared (+ a short grace), or past the default cut-off.
                'overdue' => $scopeCampus($this->visitors->currentlyOnCampusQuery())
                    ->get(['id', 'checked_in_at', 'purpose_details'])
                    ->filter(fn ($v) => $v->checked_in_at->lt(now()->subMinutes(PurposeDetails::allowedMinutes($v->purpose_details))))
                    ->count(),
                'server_time' => now()->toIso8601String(),
            ],
            'stats' => [
                'checked_in_today' => $scopeCampus(Visitor::query())->where('checked_in_at', '>=', $todayStart)->count(),
                'checked_out_today' => $scopeCampus(Visitor::query())->where('checked_out_at', '>=', $todayStart)->count(),
            ],
        ]);
    }

    /**
     * Today's badge pool (M1..M200 etc.) with each badge's state, for the
     * badge picker on the check-in form.
     */
    public function badges(Request $request, BadgePoolService $pool)
    {
        $this->ensureCanManage($request);

        return response()->json([
            'data' => $pool->snapshot(
                $request->user()->campus_id,
                $request->filled('visitor_id') ? (int) $request->input('visitor_id') : null,
                $request->input('prefix'),
            ),
        ]);
    }

    /**
     * The extra questions for each purpose of visit — the check-in form is
     * built from this, and the same rules are enforced on store/update.
     */
    public function purposeFields(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin', 'staff'])) {
            abort(403);
        }

        return response()->json(['data' => PurposeDetails::definitions()]);
    }

    /**
     * Typeahead for "who is the visitor's child" — students by name or
     * student ID. Campus-scoped like the rest of the visitor log.
     */
    public function searchStudents(Request $request)
    {
        $this->ensureCanManage($request);

        $viewer = $request->user();
        $q = trim($request->string('q')->toString());

        if (mb_strlen($q) < 2) {
            return response()->json(['data' => []]);
        }

        $students = User::query()
            ->role('student')
            ->where('is_active', true)
            ->when(
                $viewer->campus_id && !$viewer->hasAdminAccess(),
                fn ($query) => $query->where('campus_id', $viewer->campus_id)
            )
            ->where(function ($w) use ($q) {
                $w->where('name', 'like', \App\Support\Like::contains($q))
                    ->orWhere('student_id', 'like', \App\Support\Like::contains($q));
            })
            ->orderBy('name')
            ->limit(8)
            ->get(['id', 'name', 'student_id', 'course']);

        return response()->json(['data' => $students]);
    }

    public function store(Request $request)
    {
        $this->ensureCanManage($request);

        $validated = $request->validate([
            'first_name' => 'required_with:last_name|nullable|string|max:100',
            'last_name' => 'required_with:first_name|nullable|string|max:100',
            'full_name' => 'required_without_all:first_name,last_name|nullable|string|max:150',
            'id_presented' => 'required|string|max:100',
            'id_number' => 'required|string|max:100',
            'contact_number' => ['required', 'string', 'regex:/^09\d{9}$/'],
            'purpose' => 'required|string|in:' . implode(',', Visitor::PURPOSES),
            'host_name' => 'nullable|string|max:150',
            'host_department' => 'nullable|string|max:150',
            'badge_number' => 'required|string|max:50',
            'student_user_id' => 'nullable|integer|exists:users,id|required_if:purpose,' . Visitor::PURPOSE_PARENT_VISIT,
            'relationship' => 'nullable|string|in:' . implode(',', Visitor::RELATIONSHIPS),
            'purpose_details' => 'nullable|array',
            'notes' => 'nullable|string|max:1000',
        ], [
            'first_name.required_with' => 'Enter the visitor\'s first name.',
            'last_name.required_with' => 'Enter the visitor\'s last name.',
            'full_name.required_without_all' => 'Enter the visitor\'s first and last name.',
            'id_presented.required' => 'Select the ID the visitor presented.',
            'id_number.required' => 'Enter the number on the visitor\'s ID.',
            'contact_number.required' => 'Contact number is required.',
            'contact_number.regex' => 'Enter a valid Philippine mobile number, e.g. 09171234567.',
            'badge_number.required' => 'Select the physical badge you are handing to this visitor.',
            'student_user_id.required_if' => 'Select the student (child) this parent/guardian is visiting.',
        ]);

        try {
            $visitor = $this->visitors->checkIn($request->user(), $validated);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => "{$visitor->full_name} checked in.", 'data' => $visitor->load(self::VISITOR_RELATIONS)], 201);
    }

    /**
     * Correct a logged entry's details (name, ID, purpose, host, badge,
     * notes) — for fixing a mistake at intake, not for checking someone
     * out (see checkOut() below).
     */
    public function update(Request $request, Visitor $visitor)
    {
        $this->ensureCanManage($request);

        if (!$request->user()->canOperateInCampus($visitor->campus_id)) {
            abort(403, 'That visitor was checked in at a different campus than your account.');
        }

        $validated = $request->validate([
            'first_name' => 'required_with:last_name|nullable|string|max:100',
            'last_name' => 'required_with:first_name|nullable|string|max:100',
            'full_name' => 'required_without_all:first_name,last_name|nullable|string|max:150',
            'id_presented' => 'required|string|max:100',
            'id_number' => 'required|string|max:100',
            'contact_number' => ['required', 'string', 'regex:/^09\d{9}$/'],
            'purpose' => 'required|string|in:' . implode(',', Visitor::PURPOSES),
            'host_name' => 'nullable|string|max:150',
            'host_department' => 'nullable|string|max:150',
            'badge_number' => 'required|string|max:50',
            'student_user_id' => 'nullable|integer|exists:users,id|required_if:purpose,' . Visitor::PURPOSE_PARENT_VISIT,
            'relationship' => 'nullable|string|in:' . implode(',', Visitor::RELATIONSHIPS),
            'purpose_details' => 'nullable|array',
            'notes' => 'nullable|string|max:1000',
        ], [
            'first_name.required_with' => 'Enter the visitor\'s first name.',
            'last_name.required_with' => 'Enter the visitor\'s last name.',
            'full_name.required_without_all' => 'Enter the visitor\'s first and last name.',
            'id_presented.required' => 'Select the ID the visitor presented.',
            'id_number.required' => 'Enter the number on the visitor\'s ID.',
            'contact_number.required' => 'Contact number is required.',
            'contact_number.regex' => 'Enter a valid Philippine mobile number, e.g. 09171234567.',
            'badge_number.required' => 'Select the physical badge you are handing to this visitor.',
            'student_user_id.required_if' => 'Select the student (child) this parent/guardian is visiting.',
        ]);

        try {
            $visitor = $this->visitors->update($visitor, $request->user(), $validated);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Visitor entry updated.', 'data' => $visitor->load(self::VISITOR_RELATIONS)]);
    }

    /**
     * Visitor entries are not deletable from the app: the log is an audit record.
     * Admin and Staff are read-only on visitors, and officers never had delete.
     * (VisitorService::delete() is kept for a future, deliberate "remove entry" flow.)
     */
    public function destroy(Request $request, Visitor $visitor)
    {
        // Admin and Staff only read the history, and officers have never been allowed to delete
        // entries (the log is an audit record), so no role can delete a visitor from here.
        abort(403, 'Visitor entries cannot be deleted. Admin and Staff can only view the history.');
    }

    public function checkOut(Request $request, Visitor $visitor)
    {
        $this->ensureCanManage($request);

        if (!$request->user()->canOperateInCampus($visitor->campus_id)) {
            abort(403, 'That visitor was checked in at a different campus than your account.');
        }

        $validated = $request->validate([
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $visitor = $this->visitors->checkOut($visitor, $request->user(), $validated['notes'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => "{$visitor->full_name} checked out.", 'data' => $visitor->load(self::VISITOR_RELATIONS)]);
    }
}
