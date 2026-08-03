<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Claim extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_PENDING = 'pending';
    public const STATUS_UNDER_REVIEW = 'under_review';
    public const STATUS_MORE_EVIDENCE_REQUIRED = 'more_evidence_required';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_RELEASE_PENDING = 'release_pending';
    public const STATUS_RELEASED = 'released';

    // Server-side status machine. Keys = current status, values = allowed next statuses.
    public const TRANSITIONS = [
        self::STATUS_PENDING => [self::STATUS_UNDER_REVIEW, self::STATUS_CANCELLED],
        self::STATUS_UNDER_REVIEW => [
            self::STATUS_MORE_EVIDENCE_REQUIRED,
            self::STATUS_APPROVED,
            self::STATUS_REJECTED,
            self::STATUS_CANCELLED,
        ],
        self::STATUS_MORE_EVIDENCE_REQUIRED => [self::STATUS_UNDER_REVIEW, self::STATUS_CANCELLED],
        self::STATUS_APPROVED => [self::STATUS_RELEASE_PENDING, self::STATUS_CANCELLED],
        self::STATUS_RELEASE_PENDING => [self::STATUS_RELEASED],
        self::STATUS_REJECTED => [],
        self::STATUS_CANCELLED => [],
        self::STATUS_RELEASED => [],
    ];

    protected $fillable = [
        'found_item_id',
        'lost_item_id',
        'item_match_id',
        'claimant_id',
        'status',
        'reviewed_by',
        'review_notes',
        'reviewed_at',
        'risk_score',
        'risk_flags',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'risk_flags' => 'array',
    ];

    public static function canTransition(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    public function foundItem()
    {
        return $this->belongsTo(FoundItem::class);
    }

    public function lostItem()
    {
        return $this->belongsTo(LostItem::class);
    }

    public function itemMatch()
    {
        return $this->belongsTo(ItemMatch::class, 'item_match_id');
    }

    public function claimant()
    {
        return $this->belongsTo(User::class, 'claimant_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function evidence()
    {
        return $this->hasMany(ClaimEvidence::class);
    }

    public function qrRelease()
    {
        return $this->hasOne(QrRelease::class);
    }
}
