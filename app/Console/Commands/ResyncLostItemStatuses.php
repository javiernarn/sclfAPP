<?php

namespace App\Console\Commands;

use App\Services\Claims\LostItemSyncService;
use Illuminate\Console\Command;

class ResyncLostItemStatuses extends Command
{
    protected $signature = 'lostfound:resync-statuses {--dry-run : Show what would change without saving anything}';

    protected $description = 'Re-sync every lost report\'s status with its claims (e.g. close lost reports whose item was already released).';

    public function handle(LostItemSyncService $sync): int
    {
        $dry = (bool) $this->option('dry-run');
        $changes = $sync->resyncAll($dry);

        if (!$changes) {
            $this->info('Everything is already in sync.');
            return self::SUCCESS;
        }

        $this->table(
            ['Lost report', 'From', 'To', 'Claim'],
            array_map(fn ($c) => ['#' . $c['lost_item_id'], $c['from'], $c['to'], '#' . $c['claim_id']], $changes)
        );
        $this->info(($dry ? 'Would update ' : 'Updated ') . count($changes) . ' lost report(s).');

        return self::SUCCESS;
    }
}
