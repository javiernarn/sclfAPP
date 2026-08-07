<?php

namespace App\Services\Matching;

use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use Illuminate\Support\Str;

/**
 * Deterministic, rule-based matching engine.
 *
 * This is NOT machine learning. Every score is derived from explicit,
 * inspectable rules below. It only ever surfaces "potential matches" —
 * it never assigns ownership. A human (Security Officer) always makes
 * the final call via the claim/verification workflow.
 */
class ItemMatchingService
{
    // Configurable point weights. Keep them summing to 100.
    public const WEIGHTS = [
        'category' => 20,
        'item_name' => 20,
        'brand' => 15,
        'color' => 10,
        'location' => 10,
        'date' => 10,
        'description' => 10,
        'unique_characteristics' => 5,
    ];

    public const THRESHOLD_VERY_HIGH = 90;
    public const THRESHOLD_HIGH = 75;
    public const THRESHOLD_POSSIBLE = 60;

    // Below this we don't even persist a match record — too noisy to be useful.
    public const MINIMUM_SCORE_TO_RECORD = 40;

    /**
     * Score a single lost/found pair. Returns [score, breakdown].
     */
    public function score(LostItem $lost, FoundItem $found): array
    {
        $breakdown = [];

        $breakdown['category'] = $this->matchString($lost->category, $found->category)
            ? self::WEIGHTS['category'] : 0;

        $breakdown['item_name'] = $this->similarity($lost->item_name, $found->item_name) >= 0.5
            ? (int) round(self::WEIGHTS['item_name'] * $this->similarity($lost->item_name, $found->item_name))
            : 0;

        $breakdown['brand'] = $this->matchString($lost->brand, $found->brand)
            ? self::WEIGHTS['brand'] : 0;

        $breakdown['color'] = $this->matchString($lost->color, $found->color)
            ? self::WEIGHTS['color'] : 0;

        $breakdown['location'] = $this->matchString($lost->location_lost, $found->location_found)
            ? self::WEIGHTS['location'] : 0;

        $breakdown['date'] = $this->dateProximityScore($lost->date_lost, $found->date_found);

        $breakdown['description'] = (int) round(
            self::WEIGHTS['description'] * $this->similarity($lost->description, $found->description)
        );

        $breakdown['unique_characteristics'] = $this->matchString(
            $lost->unique_characteristics,
            $found->unique_characteristics
        ) ? self::WEIGHTS['unique_characteristics'] : 0;

        $score = min(100, array_sum($breakdown));

        return [$score, $breakdown];
    }

    public function matchLevel(int $score): string
    {
        return match (true) {
            $score >= self::THRESHOLD_VERY_HIGH => 'very_high',
            $score >= self::THRESHOLD_HIGH => 'high',
            $score >= self::THRESHOLD_POSSIBLE => 'possible',
            default => 'low',
        };
    }

    /**
     * Run the engine for one newly-created lost item against all
     * candidate found items (and vice versa). Persists/updates
     * ItemMatch rows and returns the ones worth notifying about.
     */
    public function runForLostItem(LostItem $lost): array
    {
        $candidates = FoundItem::query()
            ->whereIn('status', [FoundItem::STATUS_STORED, FoundItem::STATUS_ACCEPTED, FoundItem::STATUS_MATCHED])
            ->get();

        return $this->persistMatches($lost, $candidates);
    }

    public function runForFoundItem(FoundItem $found): array
    {
        $candidates = LostItem::query()
            ->whereIn('status', [LostItem::STATUS_PENDING, LostItem::STATUS_MATCHED])
            ->get();

        $results = [];
        foreach ($candidates as $lost) {
            $results = array_merge($results, $this->persistMatches($lost, collect([$found])));
        }

        return $results;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, FoundItem>  $candidates
     */
    protected function persistMatches(LostItem $lost, $candidates): array
    {
        $created = [];

        foreach ($candidates as $found) {
            [$score, $breakdown] = $this->score($lost, $found);

            if ($score < self::MINIMUM_SCORE_TO_RECORD) {
                continue;
            }

            $match = ItemMatch::firstOrNew(
                ['lost_item_id' => $lost->id, 'found_item_id' => $found->id]
            );

            $match->fill([
                'score' => $score,
                'match_level' => $this->matchLevel($score),
                'score_breakdown' => $breakdown,
            ]);

            // Only a brand-new record gets the default status. Re-scoring an
            // existing match must never clobber a status a human already set
            // (notified/claimed/dismissed).
            if (!$match->exists) {
                $match->status = ItemMatch::STATUS_PENDING;
            }

            $match->save();

            $created[] = $match;
        }

        return $created;
    }

    protected function matchString(?string $a, ?string $b): bool
    {
        if (!$a || !$b) {
            return false;
        }

        return Str::lower(trim($a)) === Str::lower(trim($b));
    }

    /**
     * Simple token-overlap similarity, 0..1. Deliberately simple and
     * explainable — no external NLP/embedding dependency.
     */
    protected function similarity(?string $a, ?string $b): float
    {
        if (!$a || !$b) {
            return 0.0;
        }

        $tokensA = collect(preg_split('/\W+/', Str::lower($a), -1, PREG_SPLIT_NO_EMPTY))->unique();
        $tokensB = collect(preg_split('/\W+/', Str::lower($b), -1, PREG_SPLIT_NO_EMPTY))->unique();

        if ($tokensA->isEmpty() || $tokensB->isEmpty()) {
            return 0.0;
        }

        $intersection = $tokensA->intersect($tokensB)->count();
        $union = $tokensA->union($tokensB)->count();

        return $union > 0 ? $intersection / $union : 0.0;
    }

    protected function dateProximityScore($lostDate, $foundDate): int
    {
        if (!$lostDate || !$foundDate) {
            return 0;
        }

        $diffDays = abs($lostDate->diffInDays($foundDate));

        return match (true) {
            $diffDays <= 1 => self::WEIGHTS['date'],
            $diffDays <= 3 => (int) round(self::WEIGHTS['date'] * 0.7),
            $diffDays <= 7 => (int) round(self::WEIGHTS['date'] * 0.4),
            $diffDays <= 14 => (int) round(self::WEIGHTS['date'] * 0.2),
            default => 0,
        };
    }
}
