<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_locations', function (Blueprint $table) {
            // Which security officer (or admin) set up this storage
            // location — shown on the Inventory page so other officers
            // coming on shift know who to ask about it. Nullable + set
            // null on delete: losing the creator's account should never
            // take the storage location (and whatever's shelved in it)
            // down with it.
            $table->foreignId('created_by')
                ->nullable()
                ->after('code')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('storage_locations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });
    }
};
