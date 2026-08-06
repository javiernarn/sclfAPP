<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Storage locations were originally always "shelved" storage — Room /
     * Cabinet / Shelf / Box. This adds a second, lighter-weight kind:
     * `counter` — a front-desk spot (e.g. "Counter 1") where an item sits
     * because the owner is already known and is expected back same-day,
     * rather than being archived into back-room storage. Counter locations
     * only need `label` (+ campus); room/cabinet/shelf/box stay empty for them.
     */
    public function up(): void
    {
        Schema::table('storage_locations', function (Blueprint $table) {
            $table->string('type')->default('storage')->after('campus_id');
            $table->string('label')->nullable()->after('type');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::table('storage_locations', function (Blueprint $table) {
            $table->dropIndex(['type']);
            $table->dropColumn(['type', 'label']);
        });
    }
};
