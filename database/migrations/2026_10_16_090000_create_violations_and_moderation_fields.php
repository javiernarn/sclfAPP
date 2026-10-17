<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Violations: sensitive uploads (nudity etc.) found in report photos/videos.
 *
 * - report_attachments gets scan fields, filled by the optional scanner job.
 * - violations is the record of "this user broke the rules with this file".
 *   One row per attachment (unique), so a file can't be flagged twice.
 *
 * status flow:  pending_review -> confirmed | dismissed
 *   - the scanner (or a reviewer pressing "Flag") opens a pending_review row;
 *   - a reviewer's "Confirm violation" makes it count on the printed dashboard;
 *   - "Not a violation" (e.g. blood / an accident photo) dismisses it and the
 *     file becomes visible again.
 * Reviewers who press "Mark as violation" directly skip pending_review.
 *
 * user_id (the uploader) is kept even if the attachment is later deleted,
 * so the offence history survives; attachment_id is nullable-on-delete.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_attachments', function (Blueprint $table) {
            // null = never scanned (scanner off). pending|clean|flagged|skipped|error
            $table->string('scan_status')->nullable()->after('path');
            $table->json('scan_labels')->nullable()->after('scan_status');
            $table->timestamp('scanned_at')->nullable()->after('scan_labels');
        });

        Schema::create('violations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('report_attachment_id')->nullable()->unique()
                ->constrained('report_attachments')->nullOnDelete();
            $table->string('attachable_type')->nullable();
            $table->unsignedBigInteger('attachable_id')->nullable();

            $table->string('type')->default('sensitive_content');
            $table->string('source');                       // scanner | manual
            $table->string('status')->default('pending_review');
            $table->string('reason', 500)->nullable();
            $table->json('scan_labels')->nullable();

            $table->foreignId('flagged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_note', 500)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('violations');

        Schema::table('report_attachments', function (Blueprint $table) {
            $table->dropColumn(['scan_status', 'scan_labels', 'scanned_at']);
        });
    }
};
