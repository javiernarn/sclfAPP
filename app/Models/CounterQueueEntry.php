<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CounterQueueEntry extends Model
{
    public const STATUS_WAITING = 'waiting';
    public const STATUS_CALLED = 'called';
    public const STATUS_SERVING = 'serving';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_NO_SHOW = 'no_show';

    // "Still in the queue, hasn't been dealt with yet" — the set a
    // dashboard/queue panel cares about showing live.
    public const ACTIVE_STATUSES = [
        self::STATUS_WAITING,
        self::STATUS_CALLED,
        self::STATUS_SERVING,
    ];

    public const PURPOSE_CLAIM_ITEM = 'claim_item';
    public const PURPOSE_REPORT_LOST = 'report_lost';
    public const PURPOSE_REPORT_FOUND = 'report_found';
    public const PURPOSE_INQUIRY = 'inquiry';
    public const PURPOSE_OTHER = 'other';

    public const PURPOSES = [
        self::PURPOSE_CLAIM_ITEM,
        self::PURPOSE_REPORT_LOST,
        self::PURPOSE_REPORT_FOUND,
        self::PURPOSE_INQUIRY,
        self::PURPOSE_OTHER,
    ];

    protected $fillable = [
        'storage_location_id',
        'user_id',
        'ticket_number',
        'purpose',
        'status',
        'handled_by',
        'notes',
        'called_at',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'called_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function storageLocation()
    {
        return $this->belongsTo(StorageLocation::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function handledBy()
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    public function scopeWaiting($query)
    {
        return $query->where('status', self::STATUS_WAITING);
    }
}
