<?php

namespace App\Http\Controllers;

use App\Models\LostItem;
use Illuminate\Http\Request;

class LostItemController extends Controller
{
    public function index()
    {
        $lostItems = LostItem::with('user:id,name')
            ->latest()
            ->paginate(10)
            ->through(fn ($item) => [
                'id' => $item->id,
                'item_name' => $item->item_name,
                'category' => $item->category,
                'status' => $item->status,
                'reporter' => $item->user->name,
            ]);

        return response()->json($lostItems);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'item_name' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'nullable|string|max:100',
            'location_lost' => 'nullable|string|max:255',
            'date_lost' => 'nullable|date',
            'image' => 'nullable|image|max:2048',
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('lost-items', 'public');
        }

        $lostItem = LostItem::create([
            'user_id' => auth()->id(),
            'item_name' => $validated['item_name'],
            'description' => $validated['description'],
            'category' => $validated['category'] ?? null,
            'location_lost' => $validated['location_lost'] ?? null,
            'date_lost' => $validated['date_lost'] ?? null,
            'image_path' => $imagePath,
        ]);

        return response()->json($lostItem, 201);
    }

    public function show(LostItem $lostItem)
    {
        $lostItem->load('user:id,name');

        return response()->json([
            'id' => $lostItem->id,
            'item_name' => $lostItem->item_name,
            'description' => $lostItem->description,
            'category' => $lostItem->category,
            'location_lost' => $lostItem->location_lost,
            'date_lost' => $lostItem->date_lost,
            'status' => $lostItem->status,
            'image_url' => $lostItem->image_path ? asset('storage/' . $lostItem->image_path) : null,
            'reporter' => $lostItem->user->name,
        ]);
    }
}