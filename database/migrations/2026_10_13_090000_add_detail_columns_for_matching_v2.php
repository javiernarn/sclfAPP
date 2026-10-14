<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Matching v2:
 *  - lost_items / found_items.details   structured extras picked from the catalog
 *                                       (storage, size, case, capacity…) — compared field by field.
 *  - item_matches.score_details         the full explanation of a score (per-field rows, conflicts, summary).
 *  - item_matches.scored_at             when the score was last computed, so list screens can
 *                                       re-score a match as soon as either report is edited.
 *
 * score_breakdown (points per field) stays exactly as it was for older rows and callers.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lost_items', function (Blueprint $table) {
            $table->json('details')->nullable()->after('unique_characteristics');
        });

        Schema::table('found_items', function (Blueprint $table) {
            $table->json('details')->nullable()->after('unique_characteristics');
        });

        Schema::table('item_matches', function (Blueprint $table) {
            $table->json('score_details')->nullable()->after('score_breakdown');
            $table->timestamp('scored_at')->nullable()->after('score_details');
        });
    }

    public function down(): void
    {
        Schema::table('item_matches', function (Blueprint $table) {
            $table->dropColumn(['score_details', 'scored_at']);
        });
        Schema::table('found_items', function (Blueprint $table) {
            $table->dropColumn('details');
        });
        Schema::table('lost_items', function (Blueprint $table) {
            $table->dropColumn('details');
        });
    }
};
