<?php

namespace App\Services\Matching;

use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Services\Claims\LostItemSyncService;

/**
 * Keeps the match queue honest: once an item has left for good, the leads that
 * still point at it are retired instead of lingering as "possible matches".
 *
 *  - found item released / disposed / rejected / deleted  → every other open lead for it is retired
 *  - lost report closed (item returned) / deleted          → every open lead for it is retired
 *
 * Retired leads are marked dismissed with `score_details.retired = <reason>` so they
 * can be told apart from a person's own "not a match" decision (the learner only
 * trains on the latter).
 *
 * Items that are merely claimed / waiting for release are NOT retired — a claim can
 * still be rejected and the item return to the shelf. Those leads are simply hidden
 * (ItemMatch::scopeLive) until the item is available again.
 */
class MatchReconciler
{
    public function __construct(protected LostItemSyncService $lostSync)
    {
    }

    public function retireForFoundItem(FoundItem $found): int
    {
        $reason = $found->trashed() ? 'found_item_deleted' : 'found_item_' . $found->status;

        $matches = ItemMatch::where('found_item_id', $found->id)
            ->whereIn('status', ItemMatch::OPEN_STATUSES)
            ->get();

        return $this->retire($matches, $reason, afterwards: true);
    }

    public function retireForLostItem(LostItem $lost): int
    {
        $reason = $lost->trashed() ? 'lost_item_deleted' : 'lost_item_' . $lost->status;

        $matches = ItemMatch::where('lost_item_id', $lost->id)
            ->whereIn('status', ItemMatch::OPEN_STATUSES)
            ->get();

        return $this->retire($matches, $reason, afterwards: false);
    }

    /**
     * Sweep every open lead (used by the hourly job and for data that predates the hooks).
     *
     * @return array{retired:int}
     */
    public function sweep(): array
    {
        $retired = 0;

        ItemMatch::query()
            ->whereIn('status', ItemMatch::OPEN_STATUSES)
            ->with([
                'lostItem' => fn ($q) => $q->withTrashed(),
                'foundItem' => fn ($q) => $q->withTrashed(),
            ])
            ->chunkById(200, function ($chunk) use (&$retired) {
                foreach ($chunk as $match) {
                    $reason = $this->goneReason($match);
                    if ($reason === null) {
                        continue;
                    }
                    $match->retire($reason);
                    $retired++;
                    if ($match->lostItem && !$match->lostItem->trashed() && $match->lostItem->status === LostItem::STATUS_MATCHED) {
                        $this->lostSync->recompute($match->lostItem);
                    }
                }
            });

        return ['retired' => $retired];
    }

    /** Why this lead can never lead anywhere again, or null when it still can. */
    public function goneReason(ItemMatch $match): ?string
    {
        $lost = $match->lostItem;
        $found = $match->foundItem;

        if (!$found || $found->trashed()) {
            return 'found_item_deleted';
        }
        if (!$lost || $lost->trashed()) {
            return 'lost_item_deleted';
        }
        if (in_array($found->status, FoundItem::TERMINAL_STATUSES, true)) {
            return 'found_item_' . $found->status;
        }
        if ($lost->status === LostItem::STATUS_CLOSED) {
            return 'lost_item_closed';
        }

        return null;
    }

    /**
     * Plain-words reason a lead is not actionable right now (shown on the comparison), or null.
     * Covers the temporary states too (claimed / waiting for release).
     */
    public function unavailableReason(ItemMatch $match): ?string
    {
        $match->loadMissing(['lostItem' => fn ($q) => $q->withTrashed(), 'foundItem' => fn ($q) => $q->withTrashed()]);

        if ($gone = $this->goneReason($match)) {
            return match ($gone) {
                'found_item_released' => 'This found item was already released to its owner.',
                'found_item_disposed' => 'This found item was already disposed of.',
                'found_item_rejected' => 'This found report was rejected.',
                'found_item_deleted' => 'This found report was deleted.',
                'lost_item_deleted' => 'This lost report was deleted.',
                default => 'This lost report is already closed — the item was returned.',
            };
        }

        $found = $match->foundItem;
        $lost = $match->lostItem;
        if (in_array($found->status, [FoundItem::STATUS_CLAIMED, FoundItem::STATUS_RELEASE_PENDING], true)) {
            return 'This found item already has an approved claim and is waiting for release.';
        }
        if ($lost->status === LostItem::STATUS_CLAIMED) {
            return 'The owner of this lost report already has an approved claim for another item.';
        }
        if (!in_array($found->status, FoundItem::MATCHABLE_STATUSES, true)) {
            return 'This found item is not currently on hand (' . str_replace('_', ' ', $found->status) . ').';
        }

        return null;
    }

    /** @param \Illuminate\Support\Collection<int, ItemMatch> $matches */
    protected function retire($matches, string $reason, bool $afterwards): int
    {
        $lostIds = [];
        foreach ($matches as $match) {
            $match->retire($reason);
            $lostIds[] = $match->lost_item_id;
        }

        // Their reports may no longer have a live lead to be "matched" on.
        if ($afterwards && $lostIds !== []) {
            // Only reports that were "matched" on a lead — a claimed / closed report has its own status owner.
            LostItem::whereIn('id', array_unique($lostIds))
                ->where('status', LostItem::STATUS_MATCHED)
                ->get()
                ->each(fn (LostItem $l) => $this->lostSync->recompute($l));
        }

        return $matches->count();
    }
}
