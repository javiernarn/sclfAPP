<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A staff member's request to perform one write action (create / update /
 * delete) that only the admin can authorise. See StaffApprovalService.
 */
class ActionRequest extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_EXECUTED = 'executed';

    /** Statuses the admin may set by hand (executed is set by the system only). */
    public const REVIEW_STATUSES = [self::STATUS_PENDING, self::STATUS_APPROVED, self::STATUS_REJECTED];

    protected $fillable = [
        'requester_id', 'reviewer_id', 'method', 'route_uri', 'subject_key',
        'summary', 'reason', 'payload', 'status', 'review_note',
        'reviewed_at', 'expires_at', 'executed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'reviewed_at' => 'datetime',
            'expires_at' => 'datetime',
            'executed_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    /** Approved and still inside its validity window. */
    public function isUsable(): bool
    {
        return $this->status === self::STATUS_APPROVED
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }
}
