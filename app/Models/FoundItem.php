<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FoundItem extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_PENDING_REVIEW = 'pending_review';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_STORED = 'stored';
    public const STATUS_MATCHED = 'matched';
    public const STATUS_CLAIMED = 'claimed';
    public const STATUS_RELEASE_PENDING = 'release_pending';
    public const STATUS_RELEASED = 'released';
    // Retention expired with no claim. Still physically on the shelf —
    // this is a flag, not a removal — until an officer actually disposes
    // of it (see DispositionService). An officer can also restore it back
    // to STATUS_STORED if the owner shows up late.
    public const STATUS_UNCLAIMED = 'unclaimed';
    // Physically removed from the shelf via disposition (donated,
    // discarded, destroyed, or transferred out). Terminal, like RELEASED —
    // the record and its movement history stay for audit purposes.
    public const STATUS_DISPOSED = 'disposed';

    // Where this record came from — see the intake_channel migration for why.
    public const CHANNEL_ONLINE_REPORT = 'online_report';
    public const CHANNEL_COUNTER_INTAKE = 'counter_intake';

    public const STATUSES = [
        self::STATUS_PENDING_REVIEW,
        self::STATUS_REJECTED,
        self::STATUS_ACCEPTED,
        self::STATUS_STORED,
        self::STATUS_MATCHED,
        self::STATUS_CLAIMED,
        self::STATUS_RELEASE_PENDING,
        self::STATUS_RELEASED,
        self::STATUS_UNCLAIMED,
        self::STATUS_DISPOSED,
    ];

    // Disposition outcomes — kept as service-layer-validated strings, not a
    // DB enum, same reasoning as counter_queue_entries' `purpose` column.
    public const DISPOSITION_DONATED = 'donated';
    public const DISPOSITION_DISCARDED = 'discarded';
    public const DISPOSITION_DESTROYED = 'destroyed';
    public const DISPOSITION_TRANSFERRED = 'transferred';

    public const DISPOSITION_METHODS = [
        self::DISPOSITION_DONATED,
        self::DISPOSITION_DISCARDED,
        self::DISPOSITION_DESTROYED,
        self::DISPOSITION_TRANSFERRED,
    ];

    // Items still physically occupying a shelf slot — used for capacity
    // counts and for the retention sweep's eligibility query. Excludes
    // RELEASED/DISPOSED (gone) and the pre-storage statuses (never had a
    // slot yet).
    public const ON_SHELF_STATUSES = [
        self::STATUS_STORED,
        self::STATUS_MATCHED,
        self::STATUS_CLAIMED,
        self::STATUS_RELEASE_PENDING,
        self::STATUS_UNCLAIMED,
    ];

    protected $fillable = [
        'user_id',
        'campus_id',
        'item_name',
        'description',
        'category',
        'brand',
        'color',
        'model',
        'unique_characteristics',
        'location_found',
        'date_found',
        'time_found',
        'image_path',
        'status',
        'intake_channel',
        'verification_status',
        'verification_notes',
        'security_officer_id',
        'verified_at',
        'storage_location_id',
        'qr_code',
        'retention_expires_at',
        'unclaimed_at',
        'disposition_method',
        'disposition_notes',
        'disposed_by',
        'disposed_at',
    ];

    protected $casts = [
        'date_found' => 'date',
        'verified_at' => 'datetime',
        'retention_expires_at' => 'date',
        'unclaimed_at' => 'datetime',
        'disposed_at' => 'datetime',
    ];

    protected $appends = ['image_url'];

    public function finder()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function securityOfficer()
    {
        return $this->belongsTo(User::class, 'security_officer_id');
    }

    public function storageLocation()
    {
        return $this->belongsTo(StorageLocation::class);
    }

    public function disposedBy()
    {
        return $this->belongsTo(User::class, 'disposed_by');
    }

    public function matches()
    {
        return $this->hasMany(ItemMatch::class);
    }

    public function claims()
    {
        return $this->hasMany(Claim::class);
    }

    public function movements()
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? asset('storage/' . $this->image_path) : null;
    }
}
