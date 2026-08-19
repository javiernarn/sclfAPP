<?php

namespace App\Http\Controllers;

use App\Models\FoundItem;
use App\Models\StorageLocation;
use App\Services\Audit\AuditLogService;
use App\Services\Inventory\InventoryService;
use App\Services\Inventory\StorageCapacityExceededException;
use Illuminate\Http\Request;

class StorageLocationController extends Controller
{
    public function __construct(
        protected InventoryService $inventory,
        protected AuditLogService $audit,
    ) {
    }

    public function index(Request $request)
    {
        $locations = StorageLocation::with('campus:id,name', 'building:id,name', 'creator:id,name')
            ->withCount([
                'foundItems',
                // Physically on the shelf right now, available to be matched/claimed.
                'foundItems as on_shelf_count' => fn ($q) => $q->whereIn('status', [
                    FoundItem::STATUS_STORED,
                    FoundItem::STATUS_MATCHED,
                ]),
                // Approved and matched to a claimant, but still physically here
                // until the claimant actually picks it up.
                'foundItems as claimed_count' => fn ($q) => $q->where('status', FoundItem::STATUS_CLAIMED),
                // A release QR/code has been issued — still on the shelf, but
                // expected to walk out the door very soon.
                'foundItems as pending_release_count' => fn ($q) => $q->where('status', FoundItem::STATUS_RELEASE_PENDING),
                // Flagged unclaimed but not yet disposed of — still
                // physically on the shelf, still counts toward capacity.
                'foundItems as unclaimed_count' => fn ($q) => $q->where('status', FoundItem::STATUS_UNCLAIMED),
                // Already handed back to the owner — no longer physically here.
                // Counted for history only; storage_location_id is kept on the
                // record rather than cleared, so this is what tells the two
                // apart from "still on the shelf".
                'foundItems as released_count' => fn ($q) => $q->where('status', FoundItem::STATUS_RELEASED),
            ])
            ->when($request->campus_id, fn ($q) => $q->where('campus_id', $request->campus_id))
            // ?type=counter / ?type=storage filters the two kinds apart —
            // used by the Inventory page (storage only) and the Counter
            // page (counter only) instead of each mixing in the other's rows.
            ->when($request->type, fn ($q) => $q->where('type', $request->type))
            ->orderBy('code')
            ->get();

        // Computed from the withCount()s above rather than
        // StorageLocation::isAtCapacity() here, to avoid an extra query
        // per row — on_shelf_count only covers stored+matched, so add
        // claimed/pending_release/unclaimed back in to match
        // FoundItem::ON_SHELF_STATUSES (everything still taking a slot).
        $locations->each(function ($location) {
            $occupied = $location->on_shelf_count + $location->claimed_count
                + $location->pending_release_count + $location->unclaimed_count;
            $location->setAttribute(
                'is_at_capacity',
                $location->capacity !== null && $occupied >= $location->capacity
            );
        });

        return response()->json($locations);
    }

    public function store(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $validated = $request->validate([
            'campus_id' => 'required|exists:campuses,id',
            'building_id' => 'nullable|exists:buildings,id',
            'type' => 'nullable|in:' . StorageLocation::TYPE_STORAGE . ',' . StorageLocation::TYPE_COUNTER,
            // Counter locations only need a friendly label (e.g. "Counter 1")
            // — no room/cabinet/shelf/box hierarchy, since it's a front
            // desk spot, not archived storage.
            'label' => 'nullable|string|max:100|required_if:type,' . StorageLocation::TYPE_COUNTER,
            'room' => 'nullable|string|max:100',
            'cabinet' => 'nullable|string|max:100',
            'shelf' => 'nullable|string|max:100',
            'box' => 'nullable|string|max:100',
            'code' => 'required|string|max:100|unique:storage_locations,code',
            'capacity' => 'nullable|integer|min:1',
        ]);

        $location = StorageLocation::create([
            ...$validated,
            'type' => $validated['type'] ?? StorageLocation::TYPE_STORAGE,
            'created_by' => $request->user()->id,
        ]);
        $location->load('creator:id,name');

        $this->audit->log('storage.created', $location, "Storage location {$location->code} created by {$request->user()->name}.");

        return response()->json(['success' => true, 'data' => $location], 201);
    }

    /**
     * Set or clear a location's capacity after the fact — most locations
     * won't get one at creation time (capacity is opt-in, see the
     * migration), and an officer walking the room to actually count shelf
     * slots happens later, not during setup.
     */
    public function updateCapacity(Request $request, StorageLocation $storageLocation)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        if (!$request->user()->canOperateInCampus($storageLocation->campus_id)) {
            abort(403, 'That storage location belongs to a different campus than your account.');
        }

        $validated = $request->validate([
            'capacity' => 'nullable|integer|min:1',
        ]);

        $storageLocation->update(['capacity' => $validated['capacity'] ?? null]);

        $this->audit->log(
            'storage.capacity_updated',
            $storageLocation,
            "Capacity for {$storageLocation->code} set to " . ($validated['capacity'] ?? 'unlimited') . '.'
        );

        return response()->json(['success' => true, 'data' => $storageLocation]);
    }

    public function assign(Request $request, FoundItem $foundItem)
    {
        $this->authorize('manageStorage', FoundItem::class);

        $validated = $request->validate([
            'storage_location_id' => 'required|exists:storage_locations,id',
            'notes' => 'nullable|string|max:500',
        ]);

        $location = StorageLocation::findOrFail($validated['storage_location_id']);

        if (!$request->user()->canOperateInCampus($location->campus_id)) {
            abort(403, 'That storage location belongs to a different campus than your account.');
        }

        try {
            $item = $this->inventory->assignStorage($foundItem, $location, $request->user(), $validated['notes'] ?? null);
        } catch (StorageCapacityExceededException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Item assigned to storage.', 'data' => $item]);
    }

    public function move(Request $request, FoundItem $foundItem)
    {
        $this->authorize('manageStorage', FoundItem::class);

        $validated = $request->validate([
            'storage_location_id' => 'required|exists:storage_locations,id',
            'notes' => 'nullable|string|max:500',
        ]);

        $location = StorageLocation::findOrFail($validated['storage_location_id']);

        if (!$request->user()->canOperateInCampus($location->campus_id)) {
            abort(403, 'That storage location belongs to a different campus than your account.');
        }

        try {
            $item = $this->inventory->move($foundItem, $location, $request->user(), $validated['notes'] ?? null);
        } catch (StorageCapacityExceededException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Item moved.', 'data' => $item]);
    }

    public function history(FoundItem $foundItem)
    {
        $this->authorize('view', $foundItem);

        return response()->json(
            $foundItem->movements()->with('storageLocation:id,code', 'mover:id,name')->latest()->get()
        );
    }
}