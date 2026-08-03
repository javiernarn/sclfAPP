<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('found_item_id')->constrained()->onDelete('cascade');
            $table->foreignId('storage_location_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('moved_by')->constrained('users')->onDelete('cascade');
            $table->enum('action', ['stored', 'moved', 'released']);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
    }
};
