<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 5: campus asset registry (laptops, projectors, furniture, etc).
 *
 * asset_tag is generated the same way User::generateStaffId() builds
 * staff IDs — a prefix + sequence, unique — so officers scanning a
 * physical asset tag sticker have a stable code to search on. building_id
 * is a real FK (assets live in known buildings) but location_text stays
 * a free string alongside it, same reasoning as security_incidents'
 * location_text: "Room 204, IT storage cabinet" is often more useful
 * than forcing a pick from the Location reference table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('building_id')->nullable()->constrained()->nullOnDelete();

            $table->string('asset_tag')->unique();
            $table->string('category');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->string('serial_number')->nullable();
            $table->string('location_text')->nullable();

            $table->string('status')->default('in_storage');
            $table->text('condition_notes')->nullable();

            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();

            $table->date('acquired_at')->nullable();
            $table->decimal('value', 10, 2)->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['campus_id', 'status']);
            $table->index(['assigned_to']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
