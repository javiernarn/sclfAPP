<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Distinguishes a normal self-reported found item (someone files a
     * report online, owner unknown until a match happens) from a Counter
     * check-in (a security officer logs it in person with the owner
     * already identified — see CounterIntakeService). Kept as its own
     * column rather than overloading `status`/`verification_status` so
     * reporting/analytics can tell the two apart even though both end up
     * going through the same found_items table.
     */
    public function up(): void
    {
        Schema::table('found_items', function (Blueprint $table) {
            $table->string('intake_channel')->default('online_report')->after('status');
            $table->index('intake_channel');
        });
    }

    public function down(): void
    {
        Schema::table('found_items', function (Blueprint $table) {
            $table->dropIndex(['intake_channel']);
            $table->dropColumn('intake_channel');
        });
    }
};
