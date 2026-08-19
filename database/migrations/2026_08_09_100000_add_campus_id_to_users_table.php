<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Campus-scoped authorization (officer assigned to campus X can only
     * operate counters/storage in campus X, campus admin sees only their
     * campus, etc.) needs a home for "which campus is this account tied
     * to" before any of that can be enforced. Nullable + set-null-on-
     * delete, matching every other campus_id column in this schema
     * (storage_locations, found_items) — deleting a campus should never
     * cascade into deleting user accounts.
     *
     * Existing rows are backfilled to the seeded 'MAIN' campus if it
     * exists at migration time, so current single-campus installs don't
     * end up with every user unscoped. Fresh installs where campuses
     * haven't been seeded yet simply leave the column null — nothing
     * downstream should assume it's always populated until validated.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('campus_id')
                ->nullable()
                ->after('gender')
                ->constrained('campuses')
                ->nullOnDelete();
        });

        $mainCampusId = DB::table('campuses')->where('code', 'MAIN')->value('id');

        if ($mainCampusId) {
            DB::table('users')->whereNull('campus_id')->update(['campus_id' => $mainCampusId]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('campus_id');
        });
    }
};
