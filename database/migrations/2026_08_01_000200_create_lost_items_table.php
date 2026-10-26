<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lost_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campus_id')->nullable()->constrained()->nullOnDelete();
            $table->string('item_name');
            $table->text('description');
            $table->string('category')->nullable();
            $table->string('brand')->nullable();
            $table->string('color')->nullable();
            $table->string('model')->nullable();
            $table->string('unique_characteristics')->nullable();
            $table->json('details')->nullable();
            $table->string('location_lost')->nullable();
            $table->date('date_lost')->nullable();
            $table->time('time_lost')->nullable();
            $table->string('image_path')->nullable();
            $table->string('contact_info')->nullable();
            $table->enum('status', ['pending', 'matched', 'claimed', 'closed'])->default('pending');

            // Approval + broadcast to matching owners
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('approval_note', 500)->nullable();
            $table->timestamp('broadcast_started_at')->nullable();
            $table->timestamp('broadcast_finished_at')->nullable();
            $table->unsignedInteger('broadcast_count')->default(0);

            $table->timestamps();
            $table->softDeletes();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('deleted_by_role', 40)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lost_items');
    }
};
