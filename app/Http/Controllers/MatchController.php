<?php

namespace App\Http\Controllers;

use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;

class MatchController extends Controller
{
    /**
     * Potential found-item matches for a lost item, most relevant first.
     * Only the reporting owner or staff may view them.
     */
    public function forLostItem(LostItem $lostItem)
    {
        $this->authorize('view', $lostItem);

        $matches = $lostItem->matches()
            ->with('foundItem:id,item_name,category,image_path,status,location_found,date_found')
            ->orderByDesc('score')
            ->get();

        return response()->json($matches);
    }

    public function forFoundItem(FoundItem $foundItem)
    {
        $this->authorize('view', $foundItem);

        $matches = $foundItem->matches()
            ->with('lostItem:id,item_name,category,image_path,status,location_lost,date_lost,user_id')
            ->orderByDesc('score')
            ->get();

        return response()->json($matches);
    }

    /**
     * Owner dismisses a suggested match that isn't theirs.
     */
    public function dismiss(ItemMatch $match)
    {
        $this->authorize('view', $match->lostItem);

        if (auth()->id() !== $match->lostItem->user_id) {
            abort(403);
        }

        $match->update(['status' => ItemMatch::STATUS_DISMISSED]);

        return response()->json(['success' => true, 'message' => 'Match dismissed.']);
    }
}
