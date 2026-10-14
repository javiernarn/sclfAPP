<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * The Assets module (campus asset registry) was removed from the system.
 * This drops its tables on databases that already have them; on a fresh
 * database it does nothing.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Child table first (it references assets).
        Schema::dropIfExists('asset_movements');
        Schema::dropIfExists('assets');
    }

    public function down(): void
    {
        // Intentionally empty: the Assets module no longer exists.
    }
};
