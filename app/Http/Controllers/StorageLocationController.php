<?php

namespace App\Http\Controllers;

use App\Models\FoundItem;
use App\Models\StorageLocation;
use App\Services\Audit\AuditLogService;
use App\Services\Inventory\InventoryService;
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
        $locations = StorageLocation::with('campus:id,name', 'building:id,name')
            ->withCount('foundItems')
            ->when($request->campus_id, fn ($q) => $q->where('campus_id', $request->campus_id))
            ->orderBy('code')
            ->get();

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
            'room' => 'nullable|string|max:100',
            'cabinet' => 'nullable|string|max:100',
            'shelf' => 'nullable|string|max:100',
            'box' => 'nullable|string|max:100',
            'code' => 'required|string|max:100|unique:storage_locations,code',
        ]);

        $location = StorageLocation::create($validated);

        $this->audit->log('storage.created', $location, "Storage location {$location->code} created.");

        return response()->json(['success' => true, 'data' => $location], 201);
    }

    public function assign(Request $request, FoundItem $foundItem)
    {
        $this->authorize('manageStorage', FoundItem::class);

        $validated = $request->validate([
            'storage_location_id' => 'required|exists:storage_locations,id',
            'notes' => 'nullable|string|max:500',
        ]);

        $location = StorageLocation::findOrFail($validated['storage_location_id']);
        $item = $this->inventory->assignStorage($foundItem, $location, $request->user(), $validated['notes'] ?? null);

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
        $item = $this->inventory->move($foundItem, $location, $request->user(), $validated['notes'] ?? null);

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
