<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tracks which security officers are assigned to which storage
     * location (in practice, counters) over time. Deliberately a
     * historical log rather than a single storage_locations.user_id
     * column: an officer's assignment ending shouldn't erase the record
     * that they were assigned there, and multiple officers can be
     * assigned to the same counter at once (unassigned_at IS NULL means
     * "currently assigned").
     */
    public function up(): void
    {
        Schema::create('storage_location_officers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('storage_location_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('unassigned_at')->nullable();
            $table->timestamps();

            // A given officer can only have one *active* assignment to a
            // given location at a time — re-assigning after an unassign is
            // fine (new row), but two simultaneously-open rows for the
            // same pair would just be ambiguous data.
            // Named explicitly — MySQL's auto-generated name for this
            // column combination exceeds its 64-character identifier limit.
            $table->index(
                ['storage_location_id', 'user_id', 'unassigned_at'],
                'storage_location_officers_active_index'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_location_officers');
    }
};
