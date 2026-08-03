<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('found_item_id')->constrained()->onDelete('cascade');
            $table->foreignId('lost_item_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('item_match_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('claimant_id')->constrained('users')->onDelete('cascade');

            // pending -> under_review -> (more_evidence_required -> under_review)* -> approved|rejected -> release_pending -> released
            // or cancelled at any point before release
            $table->string('status')->default('pending');

            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->text('review_notes')->nullable();
            $table->timestamp('reviewed_at')->nullable();

            $table->unsignedTinyInteger('risk_score')->default(0);
            $table->json('risk_flags')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
        });

        Schema::create('claim_evidence', function (Blueprint $table) {
            $table->id();
            $table->foreignId('claim_id')->constrained()->onDelete('cascade');
            $table->foreignId('submitted_by')->constrained('users')->onDelete('cascade');
            $table->enum('type', ['description', 'serial_number', 'purchase_info', 'photo', 'document', 'other']);
            $table->text('content')->nullable();
            $table->string('file_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('claim_evidence');
        Schema::dropIfExists('claims');
    }
};
