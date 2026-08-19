<?php

namespace App\Console\Commands;

use App\Services\Inventory\DispositionService;
use Illuminate\Console\Command;

class SweepUnclaimedItems extends Command
{
    protected $signature = 'disposition:sweep';

    protected $description = 'Flag found items whose retention period has expired as unclaimed';

    public function handle(DispositionService $disposition): int
    {
        $count = $disposition->sweepUnclaimed();

        $this->info("Flagged {$count} item(s) as unclaimed.");

        return self::SUCCESS;
    }
}
