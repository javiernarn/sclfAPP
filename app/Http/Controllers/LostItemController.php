<?php

namespace App\Http\Controllers;

use App\Models\LostItem;
use App\Services\Audit\AuditLogService;
use App\Services\Matching\ItemMatchingService;
use App\Notifications\SclfNotification;
use Illuminate\Http\Request;

class LostItemController extends Controller
{
    public function __construct(
        protected ItemMatchingService $matcher,
        protected AuditLogService $audit,
    ) {
    }

    public function index(Request $request)
    {
        $lostItems = LostItem::with('user:id,name')
            ->when($request->boolean('mine'), fn ($q) => $q->where('user_id', auth()->id()))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->q, fn ($q) => $q->where('item_name', 'like', "%{$request->q}%"))
            ->latest()
            ->paginate(10)
            ->through(fn ($item) => [
                'id' => $item->id,
                'item_name' => $item->item_name,
                'category' => $item->category,
                'status' => $item->status,
                'date_lost' => $item->date_lost,
                'reporter' => $item->user->name ?? 'Deactivated account',
            ]);

        return response()->json($lostItems);
    }

    public function store(Request $request)
    {
        $this->authorize('create', LostItem::class);

        $validated = $request->validate([
            'item_name' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'nullable|string|max:100',
            'brand' => 'nullable|string|max:100',
            'color' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'unique_characteristics' => 'nullable|string|max:500',
            'location_lost' => 'nullable|string|max:255',
            'date_lost' => 'nullable|date',
            'time_lost' => 'nullable',
            'campus_id' => 'nullable|exists:campuses,id',
            'contact_info' => 'nullable|string|max:255',
            'image' => 'nullable|image|max:2048',
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('lost-items', 'public');
        }

        $lostItem = LostItem::create([
            'user_id' => auth()->id(),
            'campus_id' => $validated['campus_id'] ?? null,
            'item_name' => $validated['item_name'],
            'description' => $validated['description'],
            'category' => $validated['category'] ?? null,
            'brand' => $validated['brand'] ?? null,
            'color' => $validated['color'] ?? null,
            'model' => $validated['model'] ?? null,
            'unique_characteristics' => $validated['unique_characteristics'] ?? null,
            'location_lost' => $validated['location_lost'] ?? null,
            'date_lost' => $validated['date_lost'] ?? null,
            'time_lost' => $validated['time_lost'] ?? null,
            'contact_info' => $validated['contact_info'] ?? null,
            'image_path' => $imagePath,
        ]);

        $this->audit->log('lost_item.created', $lostItem, "Lost item #{$lostItem->id} reported.");

        $matches = $this->matcher->runForLostItem($lostItem);

        if (count($matches) > 0) {
            $lostItem->update(['status' => LostItem::STATUS_MATCHED]);

            $lostItem->user?->notify(new SclfNotification(
                SclfNotification::TYPE_POTENTIAL_MATCH,
                'Potential match found',
                'We found ' . count($matches) . ' possible match(es) for your lost item.',
                LostItem::class,
                $lostItem->id,
            ));
        }

        return response()->json([
            'success' => true,
            'message' => 'Lost item report submitted.',
            'data' => $lostItem,
            'matches_found' => count($matches),
        ], 201);
    }

    public function show(LostItem $lostItem)
    {
        $this->authorize('view', $lostItem);

        $lostItem->load('user:id,name');

        return response()->json([
            'id' => $lostItem->id,
            'item_name' => $lostItem->item_name,
            'description' => $lostItem->description,
            'category' => $lostItem->category,
            'brand' => $lostItem->brand,
            'color' => $lostItem->color,
            'model' => $lostItem->model,
            'location_lost' => $lostItem->location_lost,
            'date_lost' => $lostItem->date_lost,
            'status' => $lostItem->status,
            'image_url' => $lostItem->image_url,
            'reporter' => $lostItem->user->name ?? 'Deactivated account',
            'reporter_id' => $lostItem->user_id,
        ]);
    }

    public function destroy(LostItem $lostItem)
    {
        $this->authorize('delete', $lostItem);

        $lostItem->delete(); // soft delete

        $this->audit->log('lost_item.archived', $lostItem, "Lost item #{$lostItem->id} archived.");

        return response()->json(['success' => true, 'message' => 'Report archived.']);
    }
}