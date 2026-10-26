<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Visitor portal (the page opened by scanning the badge QR):
 *  - first_name / last_name: the portal greets "Last, First", so the name is
 *    stored in parts too (full_name stays, for the log and search).
 *  - welcomed_at: when the visitor confirmed "this is me" on the portal.
 *  - badge_scan_count: how many times the badge QR was opened during the visit.
 *  - badge_found_reported_at: someone pressed "this is not my badge" — the
 *    badge may be lost and security should look for it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visitors', function (Blueprint $table) {
            $table->string('first_name', 100)->nullable()->after('full_name');
            $table->string('last_name', 100)->nullable()->after('first_name');
            $table->timestamp('welcomed_at')->nullable();
            $table->unsignedInteger('badge_scan_count')->default(0);
            $table->timestamp('badge_found_reported_at')->nullable();
        });

        // Older entries: last word of the name = last name, the rest = first name.
        DB::table('visitors')->whereNull('last_name')->orderBy('id')->chunkById(200, function ($rows) {
            foreach ($rows as $row) {
                $parts = preg_split('/\s+/', trim((string) $row->full_name)) ?: [];
                $last = count($parts) > 1 ? array_pop($parts) : null;
                DB::table('visitors')->where('id', $row->id)->update([
                    'first_name' => implode(' ', $parts) ?: null,
                    'last_name' => $last,
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('visitors', function (Blueprint $table) {
            $table->dropColumn(['first_name', 'last_name', 'welcomed_at', 'badge_scan_count', 'badge_found_reported_at']);
        });
    }
};
