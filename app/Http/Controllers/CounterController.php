<?php

namespace App\Http\Controllers;

use App\Models\CounterQueueEntry;
use App\Models\StorageLocation;
use App\Models\User;
use App\Services\Counter\CounterAssignmentService;
use App\Services\Counter\CounterIntakeService;
use App\Services\Counter\CounterQueueService;
use Illuminate\Http\Request;

class CounterController extends Controller
{
    public function __construct(
        protected CounterIntakeService $intake,
        protected CounterAssignmentService $assignments,
        protected CounterQueueService $queue,
    ) {
    }

    /**
     * Look up a student/instructor by school ID or name so the officer can
     * attach an item to the right owner. Deliberately narrow: only the
     * fields needed to confirm identity at the counter, never email/phone/
     * address — this is a public-facing search surface (any officer can
     * search any student), so it's kept as tight as the UI actually needs.
     */
    public function searchOwners(Request $request)
    {
        $request->validate(['q' => 'required|string|min:2|max:100']);

        $owners = User::query()
            ->role(['student', 'instructor'])
            ->where('is_active', true)
            ->where(function ($q) use ($request) {
                $q->where('student_id', 'like', "%{$request->q}%")
                    ->orWhere('name', 'like', "%{$request->q}%");
            })
            ->select('id', 'name', 'student_id', 'course', 'profile_picture')
            ->limit(10)
            ->get();

        return response()->json(['data' => $owners]);
    }

    /**
     * Check an item in at a counter for an already-identified owner. This
     * only logs the item and creates its pre-approved claim — it never
     * hands back a release QR. That's generated separately, later, from
     * the Claims page (same as any other approved claim), so checking an
     * item in and releasing it can't be done by the same officer in one
     * uninterrupted action.
     */
    public function checkIn(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $validated = $request->validate([
            'owner_id' => 'required|exists:users,id',
            'storage_location_id' => 'required|exists:storage_locations,id',
            'item_name' => 'required|string|max:150',
            'description' => 'nullable|string|max:1000',
            'category' => 'nullable|string|max:100',
        ]);

        $owner = User::findOrFail($validated['owner_id']);
        $counter = StorageLocation::findOrFail($validated['storage_location_id']);

        $result = $this->intake->checkIn($request->user(), $owner, $counter, $validated);

        return response()->json([
            'success' => true,
            'message' => "Item checked in for {$owner->name}. They've been notified.",
            'data' => [
                'found_item' => $result['found_item'],
                'claim' => $result['claim'],
            ],
        ], 201);
    }

    /**
     * Officers currently staffing a counter — shown on the Counter page so
     * whoever's on shift can see who else is assigned there.
     */
    public function officers(StorageLocation $storageLocation)
    {
        $officers = $storageLocation->currentOfficers()
            ->select('users.id', 'users.name', 'users.staff_id', 'users.profile_picture')
            ->get();

        return response()->json(['data' => $officers]);
    }

    /**
     * Assign a security officer to a counter. Admin-only: staffing
     * decisions are a supervisory action, distinct from the day-to-day
     * counter operations (check-in, search) any officer can already do.
     */
    public function assignOfficer(Request $request, StorageLocation $storageLocation)
    {
        if (!$request->user()->hasRole('admin')) {
            abort(403);
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $officer = User::findOrFail($validated['user_id']);
        $assignment = $this->assignments->assign($storageLocation, $officer, $request->user());

        return response()->json(['success' => true, 'data' => $assignment], 201);
    }

    /**
     * End an officer's assignment to a counter. Admin-only, mirroring
     * assignOfficer() above.
     */
    public function unassignOfficer(Request $request, StorageLocation $storageLocation, User $user)
    {
        if (!$request->user()->hasRole('admin')) {
            abort(403);
        }

        $this->assignments->unassign($storageLocation, $user, $request->user());

        return response()->json(['success' => true, 'message' => 'Officer unassigned.']);
    }

    /**
     * Per-counter live summary for the Counter Dashboard: status, who's
     * on shift, today's check-in count, and queue counts by state.
     * Campus-scoped for non-admin officers — they only see counters they
     * can actually operate at, same rule as everywhere else in Phase 1/2.
     */
    public function dashboard(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $viewer = $request->user();
        $today = now()->toDateString();

        $counters = StorageLocation::query()
            ->where('type', StorageLocation::TYPE_COUNTER)
            ->with('campus:id,name')
            ->when(
                $viewer->campus_id && !$viewer->hasRole('admin'),
                fn ($q) => $q->where('campus_id', $viewer->campus_id)
            )
            ->withCount([
                'foundItems as checked_in_today_count' => fn ($q) => $q
                    ->where('intake_channel', 'counter_intake')
                    ->whereDate('created_at', $today),
            ])
            ->orderBy('code')
            ->get();

        $counters->each(function (StorageLocation $counter) use ($today) {
            $counter->setAttribute('current_officers', $counter->currentOfficers()
                ->select('users.id', 'users.name', 'users.profile_picture')
                ->get());

            $counter->setAttribute('queue_counts', CounterQueueEntry::query()
                ->where('storage_location_id', $counter->id)
                ->whereDate('created_at', $today)
                ->selectRaw('status, count(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status'));
        });

        return response()->json(['data' => $counters]);
    }

    /**
     * Toggle a counter between open/closed/maintenance/inactive. Any
     * officer/admin can flip open<->closed/maintenance (day-to-day, e.g.
     * "closed for lunch"); campus-scoped like every other counter action.
     */
    public function updateStatus(Request $request, StorageLocation $storageLocation)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        if (!$request->user()->canOperateInCampus($storageLocation->campus_id)) {
            abort(403, 'That counter belongs to a different campus than your account.');
        }

        $validated = $request->validate([
            'status' => 'required|in:' . implode(',', StorageLocation::STATUSES),
        ]);

        $storageLocation->update(['status' => $validated['status']]);

        return response()->json(['success' => true, 'data' => $storageLocation->fresh()]);
    }

    // --- Queue ------------------------------------------------------

    /**
     * Join a counter's queue. Any authenticated user joins themselves;
     * an officer/admin may instead register a walk-in on someone else's
     * behalf by passing user_id (e.g. a student without the app open).
     */
    public function joinQueue(Request $request, StorageLocation $storageLocation)
    {
        $validated = $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'purpose' => 'nullable|string|in:' . implode(',', CounterQueueEntry::PURPOSES),
            'notes' => 'nullable|string|max:500',
        ]);

        $requester = $request->user();

        if (!empty($validated['user_id']) && (int) $validated['user_id'] !== $requester->id) {
            if (!$requester->hasAnyRole(['security_officer', 'admin'])) {
                abort(403, 'Only a security officer or admin can add someone else to the queue.');
            }
            $requester = User::findOrFail($validated['user_id']);
        }

        $entry = $this->queue->join($storageLocation, $requester, $validated['purpose'] ?? null, $validated['notes'] ?? null);

        return response()->json(['success' => true, 'data' => $entry->load('storageLocation:id,label,code')], 201);
    }

    /**
     * The current user's own active queue tickets, across all counters —
     * so the app can show "you're #3 in line at Counter 1" anywhere.
     */
    public function myQueueEntries(Request $request)
    {
        $entries = CounterQueueEntry::query()
            ->where('user_id', $request->user()->id)
            ->active()
            ->with('storageLocation:id,label,code')
            ->latest('created_at')
            ->get();

        return response()->json(['data' => $entries]);
    }

    /**
     * Full queue for a counter (today's entries) — officer/admin only.
     */
    public function listQueue(Request $request, StorageLocation $storageLocation)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $entries = CounterQueueEntry::query()
            ->where('storage_location_id', $storageLocation->id)
            ->whereDate('created_at', now()->toDateString())
            ->with('requester:id,name,student_id,profile_picture', 'handledBy:id,name')
            ->orderBy('ticket_number')
            ->get();

        return response()->json(['data' => $entries]);
    }

    public function callNextInQueue(Request $request, StorageLocation $storageLocation)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $entry = $this->queue->callNext($storageLocation, $request->user());

        if (!$entry) {
            return response()->json(['success' => true, 'message' => 'Nobody is waiting.', 'data' => null]);
        }

        return response()->json(['success' => true, 'data' => $entry]);
    }

    public function callQueueEntry(Request $request, CounterQueueEntry $queueEntry)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        return response()->json(['success' => true, 'data' => $this->queue->call($queueEntry, $request->user())]);
    }

    public function startServingQueueEntry(Request $request, CounterQueueEntry $queueEntry)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        return response()->json(['success' => true, 'data' => $this->queue->startServing($queueEntry, $request->user())]);
    }

    public function completeQueueEntry(Request $request, CounterQueueEntry $queueEntry)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        return response()->json(['success' => true, 'data' => $this->queue->complete($queueEntry, $request->user())]);
    }

    public function markQueueEntryNoShow(Request $request, CounterQueueEntry $queueEntry)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        return response()->json(['success' => true, 'data' => $this->queue->markNoShow($queueEntry, $request->user())]);
    }

    /**
     * Cancel a queue ticket — the requester dropping out of line
     * themselves, or an officer/admin cancelling on their behalf.
     * Authorization for "whose ticket is this" lives in the service.
     */
    public function cancelQueueEntry(Request $request, CounterQueueEntry $queueEntry)
    {
        return response()->json(['success' => true, 'data' => $this->queue->cancel($queueEntry, $request->user())]);
    }
}
