<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Asset extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_IN_STORAGE = 'in_storage';
    public const STATUS_ASSIGNED = 'assigned';
    public const STATUS_IN_REPAIR = 'in_repair';
    public const STATUS_RETIRED = 'retired';
    public const STATUS_LOST = 'lost';

    public const STATUSES = [
        self::STATUS_IN_STORAGE,
        self::STATUS_ASSIGNED,
        self::STATUS_IN_REPAIR,
        self::STATUS_RETIRED,
        self::STATUS_LOST,
    ];

    // Terminal — once retired or reported lost, an asset drops out of the
    // active registry for good. A "retired" asset found again isn't
    // un-retired via this record; it's a fresh registration, same design
    // choice as FoundItem::STATUS_DISPOSED being a one-way door.
    public const TERMINAL_STATUSES = [self::STATUS_RETIRED, self::STATUS_LOST];

    public const CATEGORY_ELECTRONICS = 'electronics';
    public const CATEGORY_FURNITURE = 'furniture';
    public const CATEGORY_EQUIPMENT = 'equipment';
    public const CATEGORY_VEHICLE = 'vehicle';
    public const CATEGORY_OTHER = 'other';

    public const CATEGORIES = [
        self::CATEGORY_ELECTRONICS,
        self::CATEGORY_FURNITURE,
        self::CATEGORY_EQUIPMENT,
        self::CATEGORY_VEHICLE,
        self::CATEGORY_OTHER,
    ];

    // ASSET_TAG_PREFIX mirrors User::STAFF_ID_PREFIXES' approach —
    // {PREFIX}-{YEAR}-{sequence} — see AssetService::generateAssetTag().
    public const ASSET_TAG_PREFIX = 'AST';

    protected $fillable = [
        'campus_id',
        'building_id',
        'asset_tag',
        'category',
        'name',
        'description',
        'brand',
        'model',
        'serial_number',
        'location_text',
        'status',
        'condition_notes',
        'assigned_to',
        'assigned_at',
        'acquired_at',
        'value',
        'created_by',
        'notes',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
        'acquired_at' => 'date',
        'value' => 'decimal:2',
    ];

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function building()
    {
        return $this->belongsTo(Building::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function movements()
    {
        return $this->hasMany(AssetMovement::class);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, self::TERMINAL_STATUSES, true);
    }
}
