<?php

use App\Services\Claims\LostItemSyncService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

/**
 * One-time repair: lost reports whose item was already released (or whose claim
 * is approved) but which still said "pending" because the claim had been filed
 * without picking that lost report. Runs the same logic the app now applies on
 * every claim change. Safe to re-run: it only moves reports to the status their
 * claims already imply.
 */
return new class extends Migration
{
    public function up(): void
    {
        try {
            $changes = app(LostItemSyncService::class)->resyncAll();
            Log::info('resync_lost_item_statuses: updated ' . count($changes) . ' lost report(s).');
        } catch (\Throwable $e) {
            // Never block a deploy over a data repair; run `php artisan lostfound:resync-statuses` manually.
            Log::warning('resync_lost_item_statuses failed: ' . $e->getMessage());
        }
    }

    public function down(): void
    {
        // Data repair only — nothing to undo.
    }
};
