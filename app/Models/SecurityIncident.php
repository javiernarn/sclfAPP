<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SecurityIncident extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_REPORTED = 'reported';
    public const STATUS_UNDER_REVIEW = 'under_review';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [
        self::STATUS_REPORTED,
        self::STATUS_UNDER_REVIEW,
        self::STATUS_RESOLVED,
        self::STATUS_CLOSED,
    ];

    // Terminal statuses — closed incidents can't be reopened via the
    // normal flow, matching how FoundItem::STATUS_DISPOSED and
    // Claim's cancelled state are treated elsewhere in this app.
    public const TERMINAL_STATUSES = [self::STATUS_CLOSED];

    public const SEVERITY_LOW = 'low';
    public const SEVERITY_MEDIUM = 'medium';
    public const SEVERITY_HIGH = 'high';
    public const SEVERITY_CRITICAL = 'critical';

    public const SEVERITIES = [
        self::SEVERITY_LOW,
        self::SEVERITY_MEDIUM,
        self::SEVERITY_HIGH,
        self::SEVERITY_CRITICAL,
    ];

    // Kept as service-layer-validated strings rather than a DB enum —
    // same reasoning as FoundItem::DISPOSITION_METHODS — so adding a new
    // category later doesn't need a migration.
    public const CATEGORY_THEFT = 'theft';
    public const CATEGORY_VANDALISM = 'vandalism';
    public const CATEGORY_TRESPASSING = 'trespassing';
    public const CATEGORY_ALTERCATION = 'altercation';
    public const CATEGORY_SUSPICIOUS_ACTIVITY = 'suspicious_activity';
    public const CATEGORY_SAFETY_HAZARD = 'safety_hazard';
    public const CATEGORY_LOST_ITEM_DISPUTE = 'lost_item_dispute';
    public const CATEGORY_OTHER = 'other';

    public const CATEGORIES = [
        self::CATEGORY_THEFT,
        self::CATEGORY_VANDALISM,
        self::CATEGORY_TRESPASSING,
        self::CATEGORY_ALTERCATION,
        self::CATEGORY_SUSPICIOUS_ACTIVITY,
        self::CATEGORY_SAFETY_HAZARD,
        self::CATEGORY_LOST_ITEM_DISPUTE,
        self::CATEGORY_OTHER,
    ];

    protected $fillable = [
        'campus_id',
        'reported_by',
        'category',
        'severity',
        'title',
        'description',
        'location_text',
        'occurred_at',
        'status',
        'assigned_to',
        'resolution_notes',
        'resolved_by',
        'resolved_at',
        'closed_at',
        'related_found_item_id',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function reporter()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function resolver()
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function relatedFoundItem()
    {
        return $this->belongsTo(FoundItem::class, 'related_found_item_id');
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, self::TERMINAL_STATUSES, true);
    }
}
