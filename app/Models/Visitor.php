<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\RemembersWhoDeleted;
use Illuminate\Database\Eloquent\SoftDeletes;

class Visitor extends Model
{
    use HasFactory, SoftDeletes, RemembersWhoDeleted;

    public const STATUS_CHECKED_IN = 'checked_in';
    public const STATUS_CHECKED_OUT = 'checked_out';

    public const STATUSES = [
        self::STATUS_CHECKED_IN,
        self::STATUS_CHECKED_OUT,
    ];

    // Free-text purpose, validated in the service layer rather than a DB
    // enum — same reasoning as SecurityIncident::CATEGORIES.
    public const PURPOSE_MEETING = 'meeting';
    public const PURPOSE_DELIVERY = 'delivery';
    public const PURPOSE_EVENT = 'event';
    public const PURPOSE_INTERVIEW = 'interview';
    public const PURPOSE_MAINTENANCE = 'maintenance';
    public const PURPOSE_PARENT_VISIT = 'parent_guardian';
    public const PURPOSE_OTHER = 'other';

    public const PURPOSES = [
        self::PURPOSE_MEETING,
        self::PURPOSE_DELIVERY,
        self::PURPOSE_EVENT,
        self::PURPOSE_INTERVIEW,
        self::PURPOSE_MAINTENANCE,
        self::PURPOSE_PARENT_VISIT,
        self::PURPOSE_OTHER,
    ];

    public const RELATIONSHIPS = ['parent', 'guardian', 'sibling', 'relative', 'other'];

    protected $fillable = [
        'campus_id',
        'full_name',
        'first_name',
        'last_name',
        'id_presented',
        'id_number',
        'contact_number',
        'purpose',
        'purpose_details',
        'host_name',
        'host_department',
        'student_user_id',
        'student_name',
        'student_number',
        'relationship',
        'badge_number',
        'badge_prefix',
        'badge_seq',
        'badge_cycle',
        'checked_in_by',
        'checked_in_at',
        'checked_out_by',
        'checked_out_at',
        'status',
        'notes',
        'welcomed_at',
        'badge_scan_count',
        'badge_found_reported_at',
    ];

    // The link in the QR code on the physical badge (see App\Support\VisitorBadgeLink).
    protected $appends = ['badge_url'];

    protected $casts = [
        'purpose_details' => 'array',
        'welcomed_at' => 'datetime',
        'badge_found_reported_at' => 'datetime',
        'checked_in_at' => 'datetime',
        'checked_out_at' => 'datetime',
    ];

    public function getBadgeUrlAttribute(): ?string
    {
        return \App\Support\VisitorBadgeLink::url($this->campus_id, $this->badge_number);
    }

    /** [first, last] — stored parts, or the full name split for older entries. */
    public function nameParts(): array
    {
        if ($this->first_name || $this->last_name) {
            return [$this->first_name, $this->last_name];
        }

        return \App\Services\Visitors\VisitorService::splitName((string) $this->full_name);
    }

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function checkedInBy()
    {
        return $this->belongsTo(User::class, 'checked_in_by');
    }

    public function checkedOutBy()
    {
        return $this->belongsTo(User::class, 'checked_out_by');
    }
}
