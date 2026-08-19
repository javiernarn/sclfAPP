<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StorageLocation extends Model
{
    // 'storage' = the original Room/Cabinet/Shelf/Box shelving.
    // 'counter' = a front-desk spot for items checked in with a known
    // owner, expected back same-day (see CounterIntakeService).
    public const TYPE_STORAGE = 'storage';
    public const TYPE_COUNTER = 'counter';

    // Richer state alongside `is_active`, for the Counter Dashboard
    // (Phase 2) — not yet enforced anywhere; see the status migration.
    public const STATUS_OPEN = 'open';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_MAINTENANCE = 'maintenance';
    public const STATUS_INACTIVE = 'inactive';

    public const STATUSES = [
        self::STATUS_OPEN,
        self::STATUS_CLOSED,
        self::STATUS_MAINTENANCE,
        self::STATUS_INACTIVE,
    ];

    protected $fillable = [
        'campus_id', 'building_id', 'type', 'status', 'label', 'room', 'cabinet', 'shelf', 'box', 'code', 'is_active', 'created_by', 'capacity',
    ];

    // Mirrors the DB column default. Without this, StorageLocation::create()
    // without an explicit 'status' leaves $model->status null in memory
    // (Eloquent doesn't re-fetch DB column defaults after an insert), even
    // though the actual row is 'open' — a real gap between what's in the
    // database and what code sees on the object returned from create().
    // Every call site that creates a counter/storage location without an
    // explicit status would otherwise silently get a location that reads as
    // "not open" in PHP the moment status enforcement checks it.
    protected $attributes = [
        'status' => self::STATUS_OPEN,
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function building()
    {
        return $this->belongsTo(Building::class);
    }

    // The security officer (or admin) who set up this storage location —
    // surfaced on the Security Inventory page so anyone coming on shift
    // can see who to ask about it.
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function foundItems()
    {
        return $this->hasMany(FoundItem::class);
    }

    public function movements()
    {
        return $this->hasMany(InventoryMovement::class);
    }

    /**
     * Every assignment record (past and present) for this location.
     */
    public function officerAssignments()
    {
        return $this->hasMany(StorageLocationOfficer::class);
    }

    /**
     * Officers currently staffing this location (unassigned_at IS NULL).
     * A belongsToMany "through" the assignment table rather than a direct
     * column, so multiple officers can be assigned at once and the
     * history of who staffed this counter is never lost when someone's
     * assignment ends.
     */
    public function currentOfficers()
    {
        return $this->belongsToMany(User::class, 'storage_location_officers', 'storage_location_id', 'user_id')
            ->wherePivotNull('unassigned_at')
            ->withPivot(['id', 'assigned_by', 'assigned_at'])
            ->withTimestamps();
    }

    public function queueEntries()
    {
        return $this->hasMany(CounterQueueEntry::class);
    }

    /**
     * Items currently occupying a physical slot here — see
     * FoundItem::ON_SHELF_STATUSES. Used for both the capacity check and
     * anywhere the UI needs "how full is this location right now".
     */
    public function currentItemCount(): int
    {
        return $this->foundItems()->whereIn('status', FoundItem::ON_SHELF_STATUSES)->count();
    }

    /**
     * capacity is opt-in (nullable = unlimited), so this is false for any
     * location that hasn't had a limit set, not just ones with room left.
     */
    public function isAtCapacity(): bool
    {
        if ($this->capacity === null) {
            return false;
        }

        return $this->currentItemCount() >= $this->capacity;
    }
}
