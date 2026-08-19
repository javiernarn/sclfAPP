<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `is_active` is a plain on/off switch and stays exactly as-is —
     * CounterIntakeService and every other existing check against it are
     * untouched by this migration. `status` is additive: a richer state
     * (open/closed/maintenance/inactive) for the future Counter Dashboard
     * (Phase 2) to build on, e.g. "closed for lunch" vs. "permanently
     * decommissioned" — a distinction is_active alone can't express.
     *
     * Not wired into any enforcement yet (CounterIntakeService still only
     * checks is_active) — that's deliberately deferred until the Counter
     * Dashboard phase actually needs it, so this migration carries zero
     * behavior-change risk on its own.
     */
    public function up(): void
    {
        Schema::table('storage_locations', function (Blueprint $table) {
            $table->string('status')->default('open')->after('type');
            $table->index('status');
        });

        DB::table('storage_locations')->where('is_active', false)->update(['status' => 'inactive']);
    }

    public function down(): void
    {
        Schema::table('storage_locations', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn('status');
        });
    }
};
