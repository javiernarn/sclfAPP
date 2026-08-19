<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A person waiting at a counter — separate from counter_transactions-
     * style history (which doesn't exist yet either) because this models
     * something genuinely new: "someone is waiting right now," with its
     * own short lifecycle (waiting -> called -> serving -> completed, or
     * cancelled/no_show along the way). Once an entry is completed it's
     * just a historical record like anything else — no separate archive
     * table needed.
     *
     * Index names given explicitly and kept short — MySQL's 64-char
     * identifier limit already broke one Phase 1 migration
     * (storage_location_officers) when left to auto-generate.
     */
    public function up(): void
    {
        Schema::create('counter_queue_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('storage_location_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');

            // Per-counter, per-day display number (e.g. "Queue #023"),
            // reset by the fact that it's scoped to created_at::date at
            // assignment time in the service — not a DB-level reset, kept
            // simple as a plain incrementing integer per counter.
            $table->unsignedInteger('ticket_number');

            // What they're waiting for — free-form-ish but constrained to
            // a small set in the service layer, not the DB, so adding a
            // new purpose later doesn't need a migration.
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
