<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A rule violation tied to a photo/video someone uploaded with a report
 * (nudity or other sensitive content). See the create_violations migration
 * for the status flow.
 *
 * While a violation is pending_review or confirmed, the file is hidden from
 * everyone except the reviewer roles (see ReportAttachmentController::show()).
 * Only confirmed ones count against the user on the printed dashboard.
 */
class Violation extends Model
{
    public const STATUS_PENDING = 'pending_review';
    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_DISMISSED = 'dismissed';

    public const SOURCE_SCANNER = 'scanner';
    public const SOURCE_MANUAL = 'manual';

    public const TYPE_SENSITIVE = 'sensitive_content';

    /** Roles that may review, confirm or dismiss violations. */
    public const REVIEWER_ROLES = ['admin', 'staff', 'security_officer'];

    /**
     * Fixed reasons a reviewer picks from (code => label printed on the
     * dashboard). Keep in sync with resources/js/config/violationReasons.js.
     */
    public const REASONS = [
        'nudity' => 'Nudity',
        'sexual_content' => 'Sexual or sexually suggestive content',
        'offensive_content' => 'Offensive or obscene text, symbols or gestures',
        'harassment' => 'Harassment or shaming of another person',
        'unrelated_upload' => 'Unrelated or prank upload',
        'other_sensitive' => 'Other sensitive content',
    ];

    /** Reasons for "Not a violation". */
    public const DISMISS_REASONS = [
        'accident_or_injury' => 'Accident or injury (e.g. blood) — allowed in an incident report',
        'harmless' => 'Harmless content — nothing sensitive',
        'scanner_mistake' => 'The automatic scan made a mistake',
        'other' => 'Other',
    ];

    protected $fillable = [
        'user_id', 'report_attachment_id', 'attachable_type', 'attachable_id',
        'type', 'source', 'status', 'reason', 'scan_labels',
        'flagged_by', 'reviewed_by', 'reviewed_at', 'review_note',
    ];

    protected $casts = [
        'scan_labels' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function attachment()
    {
        return $this->belongsTo(ReportAttachment::class, 'report_attachment_id');
    }

    public function flagger()
    {
        return $this->belongsTo(User::class, 'flagged_by');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * The confirmed violation (if any) on a report's files. While one exists
     * the report is locked: it can't be deleted or cancelled, so the record
     * against the person can never quietly disappear with it. A reviewer has
     * to undo the violation first (see ViolationService::dismiss()).
     */
    public static function confirmedOn(Model $report): ?self
    {
        return static::query()
            ->confirmed()
            ->whereIn('attachable_type', array_unique([$report->getMorphClass(), get_class($report)]))
            ->where('attachable_id', $report->getKey())
            ->first();
    }

    /** What the person is told when a locked report is deleted/cancelled. */
    public static function lockMessage(string $action, bool $canUndo): string
    {
        $next = $canUndo
            ? 'Open the file and choose “Undo — not a violation” first, then try again.'
            : 'Ask the Administrator to undo the violation first, then try again.';

        return "This report has a file marked as a violation, so it can’t be {$action} yet. {$next}";
    }

    /**
     * Who confirmed it, shown by ROLE (never by name) on the printed
     * dashboard the student/instructor sees.
     */
    public function reviewerRoleLabel(): ?string
    {
        $reviewer = $this->reviewer;
        if (! $reviewer) {
            return null;
        }

        return match (true) {
            $reviewer->hasAnyRole(['admin']) => 'Administrator',
            $reviewer->hasAnyRole(['security_officer']) => 'Security Officer',
            $reviewer->hasAnyRole(['staff']) => 'Staff',
            default => null,
        };
    }

    /** Hides the file from non-reviewers. */
    public function scopeHidingFile($query)
    {
        return $query->whereIn('status', [self::STATUS_PENDING, self::STATUS_CONFIRMED]);
    }

    public function scopeConfirmed($query)
    {
        return $query->where('status', self::STATUS_CONFIRMED);
    }

    public function hidesFile(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_CONFIRMED], true);
    }
}
