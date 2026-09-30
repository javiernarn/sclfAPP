<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Phase 3: daily retention sweep — see DispositionService::sweepUnclaimed()
// and SweepUnclaimedItems. Needs `php artisan schedule:work` (or a real
// cron entry running `schedule:run` every minute) to actually fire; it
// won't run on its own just because it's registered here.
Schedule::command('disposition:sweep')->dailyAt('02:00');

// See App\Console\Commands\PruneUserActivity / config/sclf.php's
// activity.retention_days. Runs after the disposition sweep, same daily
// cadence — this table gets one row per request, so unlike most nightly
// jobs here it's actually sized to matter if it's skipped for a while.
Schedule::command('activity:prune')->dailyAt('02:30');
