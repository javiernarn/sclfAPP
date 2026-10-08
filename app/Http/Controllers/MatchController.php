<?php

namespace App\Http\Controllers;

use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Notifications\SclfNotification;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\Request;

class MatchController extends Controller
{
    public function __construct(protected AuditLogService $audit)
    {
    }

    /**
     * The handlers' match queue (Security Officer, Admin, Staff — see
     * User::LOST_FOUND_HANDLER_ROLES): every candidate pairing the engine
     * recorded, best score first, so someone is actually working them
     * instead of only the report owner ever seeing a match.
     *
     * ?status=pending|notified|claimed|dismissed|open (open = pending + notified,
     * the default) and ?q= to search either item's name.
     *
     * Counter check-ins are left out: those items already have a known,
     * confirmed owner (see CounterIntakeService) and are not up for matching.
     */
    public function index(Request $request)
    {
        $status = $request->query('status', 'open');

        $matches = ItemMatch::query()
            ->with([
                'lostItem:id,user_id,item_name,category,color,brand,location_lost,date_lost,status,image_path',
                'lostItem.user:id,name',
                'foundItem:id,item_name,category,color,brand,location_found,date_found,status,image_path,intake_channel',
            ])
            ->whereHas('lostItem')
            ->whereHas('foundItem', fn ($q) => $q->where(function ($w) {
                $w->whereNull('intake_channel')->orWhere('intake_channel', '!=', FoundItem::CHANNEL_COUNTER_INTAKE);
            }))
            ->when(
                $status === 'open',
                fn ($q) => $q->whereIn('status', [ItemMatch::STATUS_PENDING, ItemMatch::STATUS_NOTIFIED]),
                fn ($q) => $status === 'all' ? $q : $q->where('status', $status)
            )
            ->when($request->query('q'), function ($q, $term) {
                $q->where(function ($w) use ($term) {
                    $w->whereHas('lostItem', fn ($l) => $l->where('item_name', 'like', "%{$term}%"))
                        ->orWhereHas('foundItem', fn ($f) => $f->where('item_name', 'like', "%{$term}%"));
                });
            })
            ->orderByDesc('score')
            ->orderByDesc('id')
            ->paginate(12);

        return response()->json($matches);
    }

    /**
     * Handler confirms the pairing looks real and tells the person who
     * reported the lost item. They then open the found item and file the
     * claim, which goes through the normal verification flow — a match is
     * never ownership on its own.
     */
    public function notifyOwner(ItemMatch $match)
    {
        if ($match->status === ItemMatch::STATUS_DISMISSED) {
            abort(422, 'This match was dismissed. It cannot be sent to the owner.');
        }
        if ($match->status === ItemMatch::STATUS_CLAIMED) {
            abort(422, 'A claim was already filed for this match.');
        }

        $match->loadMissing('lostItem.user', 'foundItem');

        $owner = $match->lostItem?->user;
        if (!$owner) {
            abort(422, 'The person who reported this lost item no longer has an account.');
        }

        $owner->notify(new SclfNotification(
            SclfNotification::TYPE_POTENTIAL_MATCH,
            'Security found a possible match',
            "A staff member reviewed \"{$match->lostItem->item_name}\" and thinks it may match \"{$match->foundItem->item_name}\". Open it to check and file a claim.",
            LostItem::class,
            $match->lostItem->id,
        ));

        $match->update(['status' => ItemMatch::STATUS_NOTIFIED]);

        $this->audit->log(
            'match.owner_notified',
            $match,
            "Match #{$match->id} (lost #{$match->lost_item_id} / found #{$match->found_item_id}) sent to the owner by user #" . auth()->id() . '.'
        );

        return response()->json([
            'success' => true,
            'message' => 'The owner has been notified.',
            'data' => $match->fresh(),
        ]);
    }

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

        if ($user->id !== $reportOwnerId && !$user->hasAnyRole(['security_officer', 'admin', 'staff'])) {
            abort(403, 'You can only view match candidates for a report you filed yourself.');
        }
    }

    /**
     * Owner dismisses a suggested match that isn't theirs — or a handler
     * (security / admin / staff) rules the pairing out from the Matches queue.
     */
    public function dismiss(ItemMatch $match)
    {
        $this->authorize('view', $match->lostItem);

        $isHandler = auth()->user()->hasAnyRole(\App\Models\User::LOST_FOUND_HANDLER_ROLES);

        if (!$isHandler && (int) auth()->id() !== (int) $match->lostItem->user_id) {
            abort(403, 'You can only dismiss matches on a lost item report you filed yourself.');
        }

        $match->update(['status' => ItemMatch::STATUS_DISMISSED]);

        return response()->json(['success' => true, 'message' => 'Match dismissed.']);
    }
}
