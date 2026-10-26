<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('counter_queue_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('storage_location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('ticket_number');
            $table->string('purpose')->nullable();
            $table->string('status')->default('waiting');
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('called_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['storage_location_id', 'status'], 'queue_entries_location_status_index');
            $table->index(['user_id', 'status'], 'queue_entries_user_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('counter_queue_entries');
    }
};
