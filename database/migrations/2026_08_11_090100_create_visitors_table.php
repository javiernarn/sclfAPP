<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 4: visitor check-in/check-out log for the security counter.
 *
 * host_name/host_department are kept as plain strings rather than FKs —
 * a visitor's host is very often "someone in the Registrar's Office" or
 * a person who isn't a system user at all (a contractor meeting a dean,
 * a parent visiting a specific teacher), so forcing a users/departments
 * FK here would block logging a real visit. departments.id is available
 * separately if a future report wants to join on it, but that's not
 * this table's job.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visitors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->nullable()->constrained()->nullOnDelete();

            $table->string('full_name');
            $table->string('id_presented')->nullable();
            $table->string('id_number')->nullable();
            $table->string('purpose');
            $table->string('host_name')->nullable();
            $table->string('host_department')->nullable();
            $table->string('badge_number')->nullable();

            $table->foreignId('checked_in_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('checked_in_at');
            $table->foreignId('checked_out_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('checked_out_at')->nullable();

            $table->string('status')->default('checked_in');
            $table->text('notes')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['campus_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visitors');
    }
};
