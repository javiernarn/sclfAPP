<?php

namespace App\Services\Notifications;

use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Matching\ItemMatchingService;
use Illuminate\Support\Collection;

/**
 * Tells the people who handle lost & found (see
 * User::LOST_FOUND_HANDLER_ROLES) that something needs their attention:
 * a new lost report, a found report waiting for review, or possible
 * matches to look at. The reporter is never notified about their own
 * report here (an officer filing a report doesn't need to be pinged).
 *
 * Matches below ItemMatchingService::THRESHOLD_POSSIBLE are still listed
 * in the Matches queue but don't send a notification — the engine records
 * anything scoring 40+, which would be too noisy to push to every handler.
 */
class LostFoundHandlerNotifier
{
    public function lostReported(LostItem $lost): void
    {
        $reporter = $lost->user;

        $this->send(
            User::lostFoundHandlers($lost->campus_id, $lost->user_id)->get(),
            SclfNotification::TYPE_LOST_REPORTED,
            'New lost item report',
            "\"{$lost->item_name}\" was reported lost" . ($reporter ? " by {$reporter->name}" : '')
                . ($lost->location_lost ? " near {$lost->location_lost}" : '') . '.',
            LostItem::class,
            $lost->id,
            '/app/lost-items/' . $lost->id . '/matches',
        );
    }

    public function foundReported(FoundItem $found): void
    {
        $finder = $found->finder;

        $this->send(
            User::lostFoundHandlers($found->campus_id, $found->user_id)->get(),
            SclfNotification::TYPE_FOUND_REPORTED,
            'Found item waiting for review',
            "\"{$found->item_name}\" was reported found" . ($finder ? " by {$finder->name}" : '')
                . ($found->location_found ? " near {$found->location_found}" : '') . '. Verify it before it goes to storage.',
            FoundItem::class,
            $found->id,
            '/app/security/found-items',
        );
    }

    /**
     * @param  iterable<ItemMatch>  $matches  matches the engine just recorded
     */
    public function matchesFound(iterable $matches): void
    {
        $worthReviewing = collect($matches)
            ->filter(fn (ItemMatch $m) => $m->score >= ItemMatchingService::THRESHOLD_POSSIBLE)
            ->values();

        if ($worthReviewing->isEmpty()) {
            return;
        }

        $best = $worthReviewing->sortByDesc('score')->first();
        $best->loadMissing('lostItem', 'foundItem');
        $count = $worthReviewing->count();

        $this->send(
            User::lostFoundHandlers($best->foundItem?->campus_id ?? $best->lostItem?->campus_id)->get(),
            SclfNotification::TYPE_MATCH_FOR_REVIEW,
            $count === 1 ? 'Possible match to review' : "{$count} possible matches to review",
            $count === 1
                ? "\"{$best->lostItem?->item_name}\" (lost) may match \"{$best->foundItem?->item_name}\" (found) — score {$best->score}/100."
                : "Best candidate: \"{$best->lostItem?->item_name}\" (lost) and \"{$best->foundItem?->item_name}\" (found), score {$best->score}/100.",
            ItemMatch::class,
            $best->id,
            '/app/security/matches',
        );
    }

    /**
     * @param  Collection<int, User>  $recipients
     */
    protected function send(Collection $recipients, string $type, string $title, string $message, string $relatedType, int $relatedId, string $link): void
    {
        foreach ($recipients as $recipient) {
            $recipient->notify(new SclfNotification(
                $type, $title, $message, $relatedType, $relatedId, ['link' => $link],
            ));
        }
    }
}
