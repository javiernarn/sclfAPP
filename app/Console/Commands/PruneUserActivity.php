<?php

namespace App\Console\Commands;

use App\Models\UserActivity;
use Illuminate\Console\Command;

/**
 * user_activities logs one row per authenticated request (see
 * TrackUserActivity) on purpose — that volume is what makes the spam/abuse
 * detection meaningful. Left unchecked it grows forever, so this trims
 * anything older than the configured window. Retention is deliberately
 * longer than a typical audit-log sweep would need, since "how many IPs
 * has this account used in the last N days" is the whole point of the
 * feature and needs enough history to answer.
 */
class PruneUserActivity extends Command
{
    protected $signature = 'activity:prune';

    protected $description = 'Delete user_activities rows older than sclf.activity.retention_days';

    public function handle(): int
    {
        $days = (int) config('sclf.activity.retention_days', 90);

        $deleted = UserActivity::query()
            ->where('created_at', '<', now()->subDays($days))
            ->delete();

        $this->info("Deleted {$deleted} activity record(s) older than {$days} day(s).");

        return self::SUCCESS;
    }
}
