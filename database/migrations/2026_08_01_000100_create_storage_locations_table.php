<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->constrained()->cascadeOnDelete();
            $table->foreignId('building_id')->nullable()->constrained()->nullOnDelete();
            // 'storage' = Room/Cabinet/Shelf/Box shelving; 'counter' = front-desk spot.
            $table->string('type')->default('storage');
            // open | closed | maintenance | inactive
            $table->string('status')->default('open');
            $table->string('label')->nullable();
            $table->string('room')->nullable();
            $table->string('cabinet')->nullable();
            $table->string('shelf')->nullable();
            $table->string('box')->nullable();
            $table->string('code')->unique();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('capacity')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('deleted_by_role', 40)->nullable();

            $table->index('type');
            $table->index('status');
        });

        Schema::create('storage_location_officers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('storage_location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('unassigned_at')->nullable();
            $table->timestamps();

            $table->index(['storage_location_id', 'user_id', 'unassigned_at'], 'storage_location_officers_active_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_location_officers');
        Schema::dropIfExists('storage_locations');
    }
};
