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
     *
     * Deliberately NOT the 'view' ability here — LostItemPolicy::view()
     * returns true for any authenticated user, since it also backs the
     * public lost-items browse/detail pages. Match candidates are a
     * narrower thing: they tie this specific report to specific found
     * items, so only the person who filed it (or staff) should see them.
     */
    public function forLostItem(LostItem $lostItem)
    {
        $this->authorizeMatchAccess($lostItem->user_id);

        $matches = $lostItem->matches()
            ->with('foundItem:id,item_name,category,image_path,status,location_found,date_found')
            ->orderByDesc('score')
            ->get();

        return response()->json($matches);
    }

    /**
     * Potential lost-item matches for a found item. Same reasoning as
     * forLostItem() above — only the finder or staff, not the general
     * 'view' ability, since this links a found item to specific lost
     * reports (and whoever filed them).
     */
    public function forFoundItem(FoundItem $foundItem)
    {
        $this->authorizeMatchAccess($foundItem->user_id);

        $matches = $foundItem->matches()
            ->with('lostItem:id,item_name,category,image_path,status,location_lost,date_lost,user_id')
            ->orderByDesc('score')
            ->get();

        return response()->json($matches);
    }

    private function authorizeMatchAccess(?int $reportOwnerId): void
    {
        $user = auth()->user();

        if ($user->id !== $reportOwnerId && !$user->hasAnyRole(['security_officer', 'admin'])) {
            abort(403, 'You can only view match candidates for a report you filed yourself.');
        }
    }

    /**
     * Owner dismisses a suggested match that isn't theirs.
     */
    public function dismiss(ItemMatch $match)
    {
        $this->authorize('view', $match->lostItem);

        if ((int) auth()->id() !== (int) $match->lostItem->user_id) {
            abort(403, 'You can only dismiss matches on a lost item report you filed yourself.');
        }

        $match->update(['status' => ItemMatch::STATUS_DISMISSED]);

        return response()->json(['success' => true, 'message' => 'Match dismissed.']);
    }
}
