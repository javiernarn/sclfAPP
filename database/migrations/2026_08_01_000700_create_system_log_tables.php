<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action');
            $table->string('entity_type')->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->text('description')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['entity_type', 'entity_id']);
            $table->index('action');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['notifiable_type', 'notifiable_id', 'read_at'], 'notifications_notifiable_read_at_index');
        });

        Schema::create('user_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('method', 10);
            $table->string('path', 255);
            $table->string('route_name', 150)->nullable();
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('device_type', 20)->nullable(); // mobile | tablet | desktop | bot | unknown
            $table->string('platform', 40)->nullable();    // Windows, macOS, Android, iOS, Linux, ...
            $table->string('browser', 40)->nullable();     // Chrome, Safari, Firefox, Edge, ...
            $table->boolean('is_suspicious')->default(false);
            $table->string('flag_reason', 120)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at']);
            $table->index(['ip_address', 'created_at']);
            $table->index('is_suspicious');
        });

        Schema::create('action_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('method', 10);
            $table->string('route_uri');
            $table->string('subject_key')->nullable();
            $table->string('summary');
            $table->text('reason')->nullable();
            $table->json('payload')->nullable();
            $table->string('status', 20)->default('pending');
            $table->text('review_note')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();

            $table->index(['requester_id', 'status']);
            $table->index('status');
            $table->index(['requester_id', 'method', 'route_uri', 'subject_key'], 'action_requests_signature_index');
        });

        Schema::create('recent_searches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('term', 60);
            $table->timestamp('last_searched_at')->useCurrent();
            $table->timestamps();

            $table->unique(['user_id', 'term']);
            $table->index(['user_id', 'last_searched_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recent_searches');
        Schema::dropIfExists('action_requests');
        Schema::dropIfExists('user_activities');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('audit_logs');
    }
};
