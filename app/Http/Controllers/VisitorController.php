<?php

namespace App\Http\Controllers;

use App\Models\Visitor;
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
    public function __construct(
        protected VisitorService $visitors,
    ) {
    }

    /**
     * Defaults to who's currently on campus; pass ?history=1 for the
     * full checked-in + checked-out log instead.
     */
    public function index(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $viewer = $request->user();

        $query = $request->boolean('history')
            ? Visitor::query()
            : $this->visitors->currentlyOnCampusQuery();

        $query = $query
            ->with(['checkedInBy:id,name', 'checkedOutBy:id,name', 'campus:id,name,code'])
            ->when(
                $viewer->campus_id && !$viewer->hasRole('admin'),
                fn ($q) => $q->where('campus_id', $viewer->campus_id)
            )
            ->when($request->filled('search'), function ($q) use ($request) {
                $q->where('full_name', 'like', '%' . $request->string('search') . '%');
            })
            ->orderByDesc('checked_in_at');

        return response()->json([
            'data' => $query->paginate(20),
            'currently_on_campus' => $this->visitors->currentlyOnCampusQuery()
                ->when(
                    $viewer->campus_id && !$viewer->hasRole('admin'),
                    fn ($q) => $q->where('campus_id', $viewer->campus_id)
                )
                ->count(),
        ]);
    }

    public function store(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $validated = $request->validate([
            'full_name' => 'required|string|max:150',
            'id_presented' => 'nullable|string|max:100',
            'id_number' => 'nullable|string|max:100',
            'purpose' => 'required|string|in:' . implode(',', Visitor::PURPOSES),
            'host_name' => 'nullable|string|max:150',
            'host_department' => 'nullable|string|max:150',
            'badge_number' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $visitor = $this->visitors->checkIn($request->user(), $validated);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => "{$visitor->full_name} checked in.", 'data' => $visitor], 201);
    }

    public function checkOut(Request $request, Visitor $visitor)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

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

        return response()->json(['success' => true, 'message' => "{$visitor->full_name} checked out.", 'data' => $visitor]);
    }
}
