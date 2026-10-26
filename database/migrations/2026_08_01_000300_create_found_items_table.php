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
            $table->foreignId('user_id')->comment('finder')->constrained()->cascadeOnDelete();
            $table->foreignId('campus_id')->nullable()->constrained()->nullOnDelete();
            $table->string('item_name');
            $table->text('description');
            $table->string('category')->nullable();
            $table->string('brand')->nullable();
            $table->string('color')->nullable();
            $table->string('model')->nullable();
            $table->string('unique_characteristics')->nullable();
            $table->json('details')->nullable();
            $table->string('location_found')->nullable();
            $table->date('date_found')->nullable();
            $table->time('time_found')->nullable();
            $table->string('image_path')->nullable();
            $table->string('status')->default('pending_review');
            $table->string('intake_channel')->default('online_report');

            // Security verification
            $table->enum('verification_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('verification_notes')->nullable();
            $table->foreignId('security_officer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();

            // Storage + QR
            $table->foreignId('storage_location_id')->nullable()->constrained()->nullOnDelete();
            $table->string('qr_code')->nullable()->unique();

            // Retention / disposition of unclaimed items
            $table->date('retention_expires_at')->nullable();
            $table->timestamp('unclaimed_at')->nullable();
            $table->string('disposition_method')->nullable();
            $table->text('disposition_notes')->nullable();
            $table->foreignId('disposed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('disposed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('deleted_by_role', 40)->nullable();

            $table->index('status');
            $table->index('category');
            $table->index('intake_channel');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('found_items');
    }
};
