<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 4: security incident reports.
 *
 * Anyone authenticated can report one (a student flags an altercation,
 * an officer logs something they witnessed directly) — this is
 * deliberately not restricted to the found-item pipeline, since not
 * every incident involves an item at all. category/severity/status are
 * kept as plain strings validated in the service layer, same reasoning
 * as found_items.disposition_method and counter_queue_entries.purpose:
 * the list of categories will grow before this table needs a migration
 * for it.
 *
 * related_found_item_id is optional and nullable-on-delete — an incident
 * can reference a specific item (e.g. "this found phone was reported
 * stolen from the shelf") without the incident itself disappearing if
 * that item record is later removed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('reported_by')->constrained('users')->cascadeOnDelete();

            $table->string('category');
            $table->string('severity')->default('low');
            $table->string('title');
            $table->text('description');
            $table->string('location_text')->nullable();
            $table->dateTime('occurred_at');

            $table->string('status')->default('reported');

            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();

            $table->text('resolution_notes')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->foreignId('related_found_item_id')->nullable()
                ->constrained('found_items')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['campus_id', 'status']);
            $table->index(['assigned_to', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_incidents');
    }
};
