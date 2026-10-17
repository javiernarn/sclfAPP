<?php

namespace App\Services\Violations;

use App\Models\ReportAttachment;
use App\Models\User;
use App\Models\Violation;
use App\Services\Audit\AuditLogService;
use Illuminate\Validation\ValidationException;

/**
 * Opens, confirms and dismisses violations on report attachments.
 * Every change is written to the audit log.
 */
class ViolationService
{
    public function __construct(protected AuditLogService $audit)
    {
    }

    /**
     * A reviewer presses "Mark as violation": confirmed straight away.
     * If the scanner already opened a pending row for the file, that row is
     * confirmed instead of creating a second one.
     */
    public function markManually(ReportAttachment $attachment, User $reviewer, ?string $reason): Violation
    {
        $existing = $attachment->violation;

        if ($existing) {
            if ($existing->status === Violation::STATUS_CONFIRMED) {
                throw ValidationException::withMessages(['attachment' => 'This file is already marked as a violation.']);
            }

            return $this->confirm($existing, $reviewer, $reason);
        }

        $violation = Violation::create([
            'user_id' => $attachment->uploaded_by,
            'report_attachment_id' => $attachment->id,
            'attachable_type' => $attachment->attachable_type,
            'attachable_id' => $attachment->attachable_id,
            'type' => Violation::TYPE_SENSITIVE,
            'source' => Violation::SOURCE_MANUAL,
            'status' => Violation::STATUS_CONFIRMED,
            'reason' => $reason,
            'flagged_by' => $reviewer->id,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        $this->audit->log(
            'violation.marked',
            $violation,
            "{$reviewer->name} marked attachment #{$attachment->id} as a violation by user #{$violation->user_id}.",
            actor: $reviewer,
        );

        return $violation;
    }

    /** The scanner found something: hold the file for review. Idempotent. */
    public function openFromScan(ReportAttachment $attachment, array $labels, ?string $reason = null): Violation
    {
        $violation = Violation::firstOrCreate(
            ['report_attachment_id' => $attachment->id],
            [
                'user_id' => $attachment->uploaded_by,
                'attachable_type' => $attachment->attachable_type,
                'attachable_id' => $attachment->attachable_id,
                'type' => Violation::TYPE_SENSITIVE,
                'source' => Violation::SOURCE_SCANNER,
                'status' => Violation::STATUS_PENDING,
                'reason' => $reason,
                'scan_labels' => $labels,
            ],
        );

        if ($violation->wasRecentlyCreated) {
            $this->audit->log(
                'violation.flagged_by_scan',
                $violation,
                "Scanner flagged attachment #{$attachment->id} (user #{$violation->user_id}) for review.",
                actor: null,
            );
        }

        return $violation;
    }

    public function confirm(Violation $violation, User $reviewer, ?string $note = null): Violation
    {
        $this->assertOpen($violation);

        if ($violation->status === Violation::STATUS_CONFIRMED) {
            throw ValidationException::withMessages(['violation' => 'This violation is already confirmed.']);
        }

        $violation->update([
            'status' => Violation::STATUS_CONFIRMED,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'review_note' => $note ? mb_substr($note, 0, 500) : $violation->review_note,
            // A reason picked by the reviewer wins over the scanner's automatic text.
            'reason' => $note ? mb_substr($note, 0, 500) : $violation->reason,
        ]);

        $this->audit->log(
            'violation.confirmed',
            $violation,
            "{$reviewer->name} confirmed violation #{$violation->id} against user #{$violation->user_id}.",
            actor: $reviewer,
        );

        return $violation;
    }

    /** "Not a violation" — e.g. blood or an accident photo. The file becomes visible again. */
    public function dismiss(Violation $violation, User $reviewer, ?string $note = null): Violation
    {
        $this->assertOpen($violation);

        if ($violation->status === Violation::STATUS_CONFIRMED && ! $reviewer->isAdmin()) {
            throw ValidationException::withMessages(['violation' => 'Only the Administrator can undo a confirmed violation.']);
        }

        $violation->update([
            'status' => Violation::STATUS_DISMISSED,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'review_note' => $note ? mb_substr($note, 0, 500) : null,
        ]);

        $this->audit->log(
            'violation.dismissed',
            $violation,
            "{$reviewer->name} dismissed violation #{$violation->id} (not a violation).",
            actor: $reviewer,
        );

        return $violation;
    }

    /** A dismissed violation is final; confirmed ones can only be undone by the Administrator (see dismiss()). */
    protected function assertOpen(Violation $violation): void
    {
        if ($violation->status === Violation::STATUS_DISMISSED) {
            throw ValidationException::withMessages(['violation' => 'This violation was already dismissed.']);
        }
    }
}
