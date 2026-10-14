<?php

use App\Models\LostItem;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast channels (private — the browser must pass the callback below)
|--------------------------------------------------------------------------
|
| The events on these channels carry NO item details, only "match #12 now
| scores 87". The page that hears one re-fetches through the normal REST
| endpoints, which apply the same access rules as always. So even a leaked
| socket message reveals nothing about a report.
*/

// Security Officer / Admin / Staff — every match change.
Broadcast::channel('lost-found.handlers', function (User $user) {
    return $user->is_active !== false && $user->hasAnyRole(User::LOST_FOUND_HANDLER_ROLES);
});

// One lost report: its owner, or a handler.
Broadcast::channel('lost-items.{lostItemId}', function (User $user, int $lostItemId) {
    if ($user->is_active === false) {
        return false;
    }
    if ($user->hasAnyRole(User::LOST_FOUND_HANDLER_ROLES)) {
        return true;
    }

    return LostItem::whereKey($lostItemId)->where('user_id', $user->id)->exists();
});
