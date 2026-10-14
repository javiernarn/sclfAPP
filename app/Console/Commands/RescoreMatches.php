<?php

namespace App\Console\Commands;

use App\Models\ItemMatch;
use App\Services\Matching\ItemMatchingService;
use Illuminate\Console\Command;

/**
 * Re-scores stored matches with the current matching rules.
 *
 * Run it once after deploying the v2 engine so older matches get their full
 * comparison, and any time the rules/vocabulary change. Matches a human has
 * already notified / claimed / dismissed keep their status — only the numbers
 * and explanation are refreshed.
 */
class RescoreMatches extends Command
{
    protected $signature = 'matches:rescore {--all : Re-score every match, not just open ones}';

    protected $description = 'Re-score stored lost/found matches with the current matching engine';

    public function handle(ItemMatchingService $matcher): int
    {
        $query = ItemMatch::query()
            ->with('lostItem', 'foundItem')
            ->when(!$this->option('all'), fn ($q) => $q->whereIn('status', [ItemMatch::STATUS_PENDING, ItemMatch::STATUS_NOTIFIED]));

        $done = 0;
        $skipped = 0;
        $query->chunkById(100, function ($chunk) use ($matcher, &$done, &$skipped) {
            foreach ($chunk as $match) {
                if (!$match->lostItem || !$match->foundItem) {
                    $skipped++;
                    continue;
                }
                $matcher->refresh($match);
                $done++;
            }
        });

        $this->info("Re-scored {$done} match(es)" . ($skipped ? ", skipped {$skipped} whose report was removed" : '') . '.');

        return self::SUCCESS;
    }
}
