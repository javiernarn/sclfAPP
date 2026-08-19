<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Visitor extends Model
{
    use HasFactory, SoftDeletes;

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
    public const PURPOSE_OTHER = 'other';

    public const PURPOSES = [
        self::PURPOSE_MEETING,
        self::PURPOSE_DELIVERY,
        self::PURPOSE_EVENT,
        self::PURPOSE_INTERVIEW,
        self::PURPOSE_MAINTENANCE,
        self::PURPOSE_OTHER,
    ];

    protected $fillable = [
        'campus_id',
        'full_name',
        'id_presented',
        'id_number',
        'purpose',
        'host_name',
        'host_department',
        'badge_number',
        'checked_in_by',
        'checked_in_at',
        'checked_out_by',
        'checked_out_at',
        'status',
        'notes',
    ];

    protected $casts = [
        'checked_in_at' => 'datetime',
        'checked_out_at' => 'datetime',
    ];

    public function campus()
    {
        return $this->belongsTo(Campus::class);
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
