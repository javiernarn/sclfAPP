<?php

namespace App\Services\Claims;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Services\Audit\AuditLogService;
use App\Services\Matching\ItemMatchingService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Keeps the LOST side of a case in step with the FOUND side.
 *
 * The found item and its claim already move through a status machine
 * (ClaimService::syncFoundItemStatus). The lost report that started the case
 * used to be updated only in one place — when the release was recorded — and
 * only if the claimant had remembered to pick that lost report while filing
 * the claim. Anyone who filed the claim without picking one left their lost
 * report on "Pending" forever, even after the item was handed back to them.
 *
 * This service is the single place that decides a lost report's status from
 * its claims, so every path (claim submitted, approved, rejected, cancelled,
 * released, deleted, counter check-in) stays consistent:
 *
 *   claim pending / under review / more evidence → lost report: matched
 *   claim approved / release pending             → lost report: claimed
 *   claim released                               → lost report: closed (case closed)
 *   claim rejected / cancelled / deleted         → lost report: recomputed
 *                                                  (matched if it still has a live
 *                                                  lead, otherwise pending)
 *
 * A claim with no lost report attached is linked to the claimant's best
 * matching open lost report of their own, so the two sides are never orphaned.
 */
class LostItemSyncService
{
    /** Lost-report statuses that are still "in play" (not closed). */
    public const OPEN_STATUSES = [
        LostItem::STATUS_PENDING,
        LostItem::STATUS_MATCHED,
        LostItem::STATUS_CLAIMED,
    ];

    /** Claim statuses that mean someone is actively pursuing the item. */
    protected const LIVE_CLAIM_STATUSES = [
        Claim::STATUS_PENDING,
        Claim::STATUS_UNDER_REVIEW,
        Claim::STATUS_MORE_EVIDENCE_REQUIRED,
        Claim::STATUS_APPROVED,
        Claim::STATUS_RELEASE_PENDING,
    ];

    /** Found-item statuses where the item is still physically available to its owner. */
    protected const AVAILABLE_FOUND_STATUSES = [
        FoundItem::STATUS_ACCEPTED,
        FoundItem::STATUS_STORED,
        FoundItem::STATUS_MATCHED,
    ];

    public function __construct(
        protected ItemMatchingService $matcher,
        protected AuditLogService $audit,
    ) {
    }

    // -----------------------------------------------------------------
    // Entry points
    // -----------------------------------------------------------------

    /**
     * Bring the lost report behind $claim in line with the claim's current status.
     */
    public function syncForClaim(Claim $claim): ?LostItem
    {
        $claim->loadMissing('foundItem');

        $declined = in_array($claim->status, [Claim::STATUS_REJECTED, Claim::STATUS_CANCELLED], true);

        // A declined claim never goes looking for a lost report to attach to;
        // it only lets go of the one it already had.
        if (!$claim->lost_item_id && !$declined) {
            $this->linkLostItem($claim);
        }

        $lost = $claim->lost_item_id ? LostItem::find($claim->lost_item_id) : null;
        if (!$lost) {
            return null;
        }

        // submit() marks the match "claimed" while the claim is in flight; a claim that
        // fell through hands the lead back so the owner can try again.
        if ($declined && $claim->item_match_id) {
            ItemMatch::where('id', $claim->item_match_id)
                ->where('status', ItemMatch::STATUS_CLAIMED)
                ->update(['status' => ItemMatch::STATUS_PENDING]);
        }

        match ($claim->status) {
            Claim::STATUS_RELEASED => $this->closeCase($claim, $lost),
            Claim::STATUS_APPROVED, Claim::STATUS_RELEASE_PENDING => $this->setStatus($lost, LostItem::STATUS_CLAIMED, $claim),
            Claim::STATUS_PENDING, Claim::STATUS_UNDER_REVIEW, Claim::STATUS_MORE_EVIDENCE_REQUIRED => $this->recompute($lost, $claim),
            default => $this->recompute($lost, $claim), // rejected / cancelled
        };

        return $lost->fresh();
    }

    /**
     * Re-derive a lost report's status from what is currently true about it.
     * Never re-opens a closed report.
     */
    public function recompute(LostItem $lost, ?Claim $cause = null): LostItem
    {
        if ($lost->status === LostItem::STATUS_CLOSED) {
            return $lost;
        }

        $claims = Claim::where('lost_item_id', $lost->id)->whereIn('status', self::LIVE_CLAIM_STATUSES)->pluck('status');

        if ($claims->contains(fn ($s) => in_array($s, [Claim::STATUS_APPROVED, Claim::STATUS_RELEASE_PENDING], true))) {
            $target = LostItem::STATUS_CLAIMED;
        } elseif ($claims->isNotEmpty() || $this->hasLiveLead($lost)) {
            $target = LostItem::STATUS_MATCHED;
        } else {
            $target = LostItem::STATUS_PENDING;
        }

        return $this->setStatus($lost, $target, $cause);
    }

    /**
     * Link a claim that was filed without a lost report to the claimant's own
     * best-matching open one. Returns the linked report, or null if none fits.
     */
    public function linkLostItem(Claim $claim): ?LostItem
    {
        if ($claim->lost_item_id) {
            return $claim->lostItem;
        }

        $found = $claim->foundItem;
        if (!$found || !$claim->claimant_id) {
            return null;
        }

        // Lost reports already tied to a different live/finished claim are spoken for.
        $takenElsewhere = Claim::whereNotNull('lost_item_id')
            ->where('id', '!=', $claim->id)
            ->whereIn('status', [...self::LIVE_CLAIM_STATUSES, Claim::STATUS_RELEASED])
            ->pluck('lost_item_id');

        $candidates = LostItem::where('user_id', $claim->claimant_id)
            ->whereIn('status', self::OPEN_STATUSES)
            ->whereNotIn('id', $takenElsewhere)
            ->get();

        if ($candidates->isEmpty()) {
            return null;
        }

        $best = null;
        $bestScore = -1;
        foreach ($candidates as $lost) {
            [$score] = $this->matcher->score($lost, $found);
            $sameName = Str::lower(trim((string) $lost->item_name)) === Str::lower(trim((string) $found->item_name));

            if ($score < ItemMatchingService::MINIMUM_SCORE_TO_RECORD && !$sameName) {
                continue;
            }

            // An identical item name outranks a merely similar score.
            $rank = $score + ($sameName ? 100 : 0);
            if ($rank > $bestScore) {
                $best = $lost;
                $bestScore = $rank;
            }
        }

        if (!$best) {
            return null;
        }

        $match = ItemMatch::where('lost_item_id', $best->id)->where('found_item_id', $found->id)->first();

        $claim->forceFill([
            'lost_item_id' => $best->id,
            'item_match_id' => $claim->item_match_id ?: $match?->id,
        ])->save();

        $this->audit->log(
            'claim.lost_item_linked',
            $claim,
            "Claim #{$claim->id} linked to the claimant's lost report #{$best->id}.",
            ['lost_item_id' => null],
            ['lost_item_id' => $best->id],
        );

        return $best;
    }

    /**
     * The owner's lost reports that are still open AND not already tied to
     * another live/finished claim. Used by the Counter so an officer can see
     * (and explicitly pick) which report an in-person hand-over belongs to,
     * instead of relying only on the silent best-guess in linkLostItem().
     */
    public function openReportsFor(int $ownerId): \Illuminate\Support\Collection
    {
        $takenElsewhere = Claim::whereNotNull('lost_item_id')
            ->whereIn('status', [...self::LIVE_CLAIM_STATUSES, Claim::STATUS_RELEASED])
            ->pluck('lost_item_id');

        return LostItem::where('user_id', $ownerId)
            ->whereIn('status', self::OPEN_STATUSES)
            ->whereNotIn('id', $takenElsewhere)
            ->latest()
            ->get();
    }

    /**
     * After a claim is deleted, its lost report may no longer have a reason to
     * say "matched"/"claimed". Call with the lost item id the claim carried.
     */
    public function afterClaimRemoved(?int $lostItemId): void
    {
        if (!$lostItemId) {
            return;
        }

        if ($lost = LostItem::find($lostItemId)) {
            $this->recompute($lost);
        }
    }

    // -----------------------------------------------------------------
    // Repair for records created before this service existed
    // -----------------------------------------------------------------

    /**
     * Re-sync every lost report from the claims that exist today.
     *
     * @return array<int, array{lost_item_id:int, from:string, to:string, claim_id:?int}>
     */
    public function resyncAll(bool $dryRun = false): array
    {
        $changes = [];

        $run = function () use (&$changes) {
            // Finished cases first, so a lost report is claimed by the claim that
            // actually completed rather than by a later stray one.
            $order = [
                Claim::STATUS_RELEASED => 0,
                Claim::STATUS_RELEASE_PENDING => 1,
                Claim::STATUS_APPROVED => 2,
                Claim::STATUS_UNDER_REVIEW => 3,
                Claim::STATUS_MORE_EVIDENCE_REQUIRED => 3,
                Claim::STATUS_PENDING => 4,
            ];

            $claims = Claim::with('foundItem')
                ->whereIn('status', array_keys($order))
                ->get()
                ->sortBy(fn (Claim $c) => [$order[$c->status] ?? 9, $c->id])
                ->values();

            foreach ($claims as $claim) {
                $before = $claim->lost_item_id ? LostItem::find($claim->lost_item_id)?->status : null;
                $lost = $this->syncForClaim($claim);
                if ($lost && $before !== null && $before !== $lost->status) {
                    $changes[] = ['lost_item_id' => $lost->id, 'from' => $before, 'to' => $lost->status, 'claim_id' => $claim->id];
                } elseif ($lost && $before === null) {
                    // Newly linked: report what it became.
                    $changes[] = ['lost_item_id' => $lost->id, 'from' => '(was unlinked)', 'to' => $lost->status, 'claim_id' => $claim->id];
                }
            }
        };

        if ($dryRun) {
            DB::beginTransaction();
            try {
                $run();
            } finally {
                DB::rollBack();
            }
        } else {
            DB::transaction($run);
        }

        return $changes;
    }

    // -----------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------

    /** The claim was released: the owner has the item back — case closed on both sides. */
    protected function closeCase(Claim $claim, LostItem $lost): void
    {
        $this->setStatus($lost, LostItem::STATUS_CLOSED, $claim);

        // The winning match is "claimed"; every other lead for this item is
        // moot now that it has left the building.
        if ($claim->item_match_id) {
            ItemMatch::where('id', $claim->item_match_id)->update(['status' => ItemMatch::STATUS_CLAIMED]);
        }

        $otherMatches = ItemMatch::where('found_item_id', $claim->found_item_id)
            ->where('lost_item_id', '!=', $lost->id)
            ->whereIn('status', [ItemMatch::STATUS_PENDING, ItemMatch::STATUS_NOTIFIED])
            ->get();

        foreach ($otherMatches as $match) {
            $match->update(['status' => ItemMatch::STATUS_DISMISSED]);
            if ($other = LostItem::find($match->lost_item_id)) {
                $this->recompute($other);
            }
        }
    }

    /** Does this lost report still have a possible match to a found item that is still on hand? */
    protected function hasLiveLead(LostItem $lost): bool
    {
        return ItemMatch::where('lost_item_id', $lost->id)
            ->whereIn('status', [ItemMatch::STATUS_PENDING, ItemMatch::STATUS_NOTIFIED])
            ->whereHas('foundItem', fn ($q) => $q->whereIn('status', self::AVAILABLE_FOUND_STATUSES))
            ->exists();
    }

    protected function setStatus(LostItem $lost, string $to, ?Claim $cause = null): LostItem
    {
        if ($lost->status === $to) {
            return $lost;
        }

        // A closed case stays closed unless this very change is the closing one.
        if ($lost->status === LostItem::STATUS_CLOSED) {
            return $lost;
        }

        $from = $lost->status;
        $lost->update(['status' => $to]);

        $this->audit->log(
            'lost_item.status_changed',
            $lost,
            "Lost report #{$lost->id} moved from '{$from}' to '{$to}'" . ($cause ? " (claim #{$cause->id})." : '.'),
            ['status' => $from],
            ['status' => $to],
        );

        return $lost;
    }
}
