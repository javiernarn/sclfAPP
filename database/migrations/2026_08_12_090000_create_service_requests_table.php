<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 5: facilities/IT/maintenance service requests.
 *
 * Shares the same "anyone can report, staff manages" shape as
 * security_incidents (see that migration's comment), but adds two things
 * incidents don't need: an optional department_id to route the request
 * (Facilities vs IT vs whoever — see DepartmentController, Phase 4), and
 * a requester-initiated cancel path (a student who filed a request and
 * no longer needs it done shouldn't have to wait on staff to close it
 * out). category/priority/status are plain strings validated in the
 * service layer, same reasoning as security_incidents.category.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();

            $table->string('category');
            $table->string('priority')->default('medium');
            $table->string('title');
            $table->text('description');
            $table->string('location_text')->nullable();

            $table->string('status')->default('submitted');

            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();

            $table->text('completion_notes')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['campus_id', 'status']);
            $table->index(['assigned_to', 'status']);
            $table->index(['department_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_requests');
    }
};
