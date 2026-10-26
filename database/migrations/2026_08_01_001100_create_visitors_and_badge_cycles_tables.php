<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Rolling badge numbering per campus + day letter (see BadgePoolService).
        Schema::create('badge_cycles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->nullable()->constrained()->nullOnDelete();
            $table->string('prefix', 5);
            $table->unsignedInteger('cycle')->default(1);
            $table->timestamps();

            $table->unique(['campus_id', 'prefix']);
        });

        Schema::create('visitors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->nullable()->constrained()->nullOnDelete();
            // Must stay the first TIMESTAMP column: MySQL (XAMPP/MariaDB, explicit_defaults_for_timestamp off)
            // rejects a NOT NULL timestamp that comes after a nullable one.
            $table->timestamp('checked_in_at');

            // Who
            $table->string('full_name');
            $table->string('first_name', 100)->nullable();
            $table->string('last_name', 100)->nullable();
            $table->string('id_presented')->nullable();
            $table->string('id_number')->nullable();
            $table->string('contact_number', 50)->nullable();

            // Why / who they are visiting
            $table->string('purpose');
            $table->json('purpose_details')->nullable();
            $table->string('host_name')->nullable();
            $table->string('host_department')->nullable();
            $table->foreignId('student_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('student_name')->nullable();
            $table->string('student_number', 50)->nullable();
            $table->string('relationship', 50)->nullable();

            // Badge
            $table->string('badge_number')->nullable();
            $table->string('badge_prefix', 5)->nullable();
            $table->unsignedSmallInteger('badge_seq')->nullable();
            $table->unsignedInteger('badge_cycle')->nullable();
            $table->unsignedInteger('badge_scan_count')->default(0);
            $table->timestamp('badge_found_reported_at')->nullable();

            // Visit
            $table->foreignId('checked_in_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('checked_out_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('checked_out_at')->nullable();
            $table->string('status')->default('checked_in');
            $table->timestamp('welcomed_at')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();
            $table->softDeletes();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('deleted_by_role', 40)->nullable();

            $table->index(['campus_id', 'status']);
            $table->index(['campus_id', 'badge_number', 'status']);
            $table->index(['campus_id', 'badge_prefix', 'badge_cycle']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visitors');
        Schema::dropIfExists('badge_cycles');
    }
};
