<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFoundItemRequest;
use App\Http\Requests\VerifyFoundItemRequest;
use App\Models\FoundItem;
use App\Services\Audit\AuditLogService;
use App\Services\Inventory\InventoryService;
use Illuminate\Http\Request;

class FoundItemController extends Controller
{
    public function __construct(
        protected InventoryService $inventory,
        protected AuditLogService $audit,
    ) {
    }

    public function index(Request $request)
    {
        $this->authorize('viewAny', FoundItem::class);

        $items = FoundItem::query()
            ->with(['finder:id,name', 'storageLocation:id,code'])
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->category, fn ($q) => $q->where('category', $request->category))
            ->when($request->q, function ($q) use ($request) {
                $q->where(function ($sub) use ($request) {
                    $sub->where('item_name', 'like', "%{$request->q}%")
                        ->orWhere('description', 'like', "%{$request->q}%");
                });
            })
            ->latest()
            ->paginate(12);

        return response()->json($items);
    }

    public function store(StoreFoundItemRequest $request)
    {
        $validated = $request->validated();

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('found-items', 'public');
        }

        $item = FoundItem::create([
            'user_id' => auth()->id(),
            'campus_id' => $validated['campus_id'] ?? null,
            'item_name' => $validated['item_name'],
            'description' => $validated['description'],
            'category' => $validated['category'] ?? null,
            'brand' => $validated['brand'] ?? null,
            'color' => $validated['color'] ?? null,
            'model' => $validated['model'] ?? null,
            'unique_characteristics' => $validated['unique_characteristics'] ?? null,
            'location_found' => $validated['location_found'] ?? null,
            'date_found' => $validated['date_found'] ?? null,
            'time_found' => $validated['time_found'] ?? null,
            'image_path' => $imagePath,
        ]);

        $this->audit->log('found_item.created', $item, "Found item #{$item->id} reported.");

        return response()->json([
            'success' => true,
            'message' => 'Found item report submitted. It will be reviewed by Security.',
            'data' => $item,
        ], 201);
    }

    public function show(FoundItem $foundItem)
    {
        $this->authorize('view', $foundItem);

        $foundItem->load(['finder:id,name', 'storageLocation', 'securityOfficer:id,name']);

        return response()->json($foundItem);
    }

    public function verify(VerifyFoundItemRequest $request, FoundItem $foundItem)
    {
        $item = $this->inventory->verify(
            $foundItem,
            $request->user(),
            $request->boolean('approved'),
            $request->input('notes'),
        );

        return response()->json([
            'success' => true,
            'message' => 'Verification recorded.',
            'data' => $item,
        ]);
    }
}
