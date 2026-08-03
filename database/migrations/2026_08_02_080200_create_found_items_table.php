<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('found_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->comment('finder')->constrained()->onDelete('cascade');
            $table->string('item_name');
            $table->text('description');
            $table->string('category')->nullable();
            $table->string('brand')->nullable();
            $table->string('color')->nullable();
            $table->string('model')->nullable();
            $table->string('unique_characteristics')->nullable();
            $table->string('location_found')->nullable();
            $table->date('date_found')->nullable();
            $table->time('time_found')->nullable();
            $table->string('image_path')->nullable();
            $table->foreignId('campus_id')->nullable()->constrained()->onDelete('set null');

            // Workflow status: pending_review -> accepted -> stored -> matched -> claimed -> released
            // (or rejected at the security-review step)
            $table->string('status')->default('pending_review');

            // Explicit officer verification decision, separate from the workflow status.
            $table->enum('verification_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('verification_notes')->nullable();
            $table->foreignId('security_officer_id')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('verified_at')->nullable();

            $table->foreignId('storage_location_id')->nullable()->constrained()->onDelete('set null');
            $table->string('qr_code')->nullable()->unique();

            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('found_items');
    }
};
