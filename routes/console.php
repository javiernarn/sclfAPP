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
