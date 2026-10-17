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
