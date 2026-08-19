<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ServiceRequest extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_ACKNOWLEDGED = 'acknowledged';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_SUBMITTED,
        self::STATUS_ACKNOWLEDGED,
        self::STATUS_IN_PROGRESS,
        self::STATUS_COMPLETED,
        self::STATUS_CLOSED,
        self::STATUS_CANCELLED,
    ];

    // Terminal — same idea as SecurityIncident::TERMINAL_STATUSES.
    // Cancelled sits alongside closed here (both are "nothing more
    // happens to this record"), unlike an incident which has no
    // requester-initiated end state.
    public const TERMINAL_STATUSES = [self::STATUS_CLOSED, self::STATUS_CANCELLED];

    // Statuses a requester may still cancel from. Once work is actually
    // in progress the requester can still call it off (unlike, say,
    // being blocked entirely) — but completed/closed/cancelled requests
    // are naturally excluded via isTerminal()/status checks in the
    // service layer, not listed again here.
    public const CANCELLABLE_STATUSES = [
        self::STATUS_SUBMITTED,
        self::STATUS_ACKNOWLEDGED,
        self::STATUS_IN_PROGRESS,
    ];

    public const CATEGORY_MAINTENANCE = 'maintenance';
    public const CATEGORY_IT_SUPPORT = 'it_support';
    public const CATEGORY_FACILITIES = 'facilities';
    public const CATEGORY_CLEANING = 'cleaning';
    public const CATEGORY_OTHER = 'other';

    public const CATEGORIES = [
        self::CATEGORY_MAINTENANCE,
        self::CATEGORY_IT_SUPPORT,
        self::CATEGORY_FACILITIES,
        self::CATEGORY_CLEANING,
        self::CATEGORY_OTHER,
    ];

    public const PRIORITY_LOW = 'low';
    public const PRIORITY_MEDIUM = 'medium';
    public const PRIORITY_HIGH = 'high';
    public const PRIORITY_URGENT = 'urgent';

    public const PRIORITIES = [
        self::PRIORITY_LOW,
        self::PRIORITY_MEDIUM,
        self::PRIORITY_HIGH,
        self::PRIORITY_URGENT,
    ];

    protected $fillable = [
        'campus_id',
        'requested_by',
        'department_id',
        'category',
        'priority',
        'title',
        'description',
        'location_text',
        'status',
        'assigned_to',
        'completion_notes',
        'completed_by',
        'completed_at',
        'closed_at',
        'cancelled_by',
        'cancelled_at',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
        'closed_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function completedBy()
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function cancelledBy()
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, self::TERMINAL_STATUSES, true);
    }

    public function isCancellable(): bool
    {
        return in_array($this->status, self::CANCELLABLE_STATUSES, true);
    }
}
