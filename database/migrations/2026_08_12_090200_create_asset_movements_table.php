<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 5: append-only history of what's happened to an asset — mirrors
 * inventory_movements' shape exactly (see that migration), just keyed on
 * asset_id instead of found_item_id, and with from/to custodian columns
 * since an asset's "movement" is usually a change of who's holding it
 * rather than a change of shelf location.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('moved_by')->constrained('users')->cascadeOnDelete();
            $table->string('action');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_movements');
    }
};
