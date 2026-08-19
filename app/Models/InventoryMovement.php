<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryMovement extends Model
{
    public const ACTION_STORED = 'stored';
    public const ACTION_MOVED = 'moved';
    public const ACTION_RELEASED = 'released';
    public const ACTION_UNCLAIMED = 'unclaimed';
    public const ACTION_DISPOSED = 'disposed';
    public const ACTION_RESTORED = 'restored';

    protected $fillable = [
        'found_item_id', 'storage_location_id', 'moved_by', 'action', 'notes',
    ];

    public function foundItem()
    {
        return $this->belongsTo(FoundItem::class);
    }

    public function storageLocation()
    {
        return $this->belongsTo(StorageLocation::class);
    }

    public function mover()
    {
        return $this->belongsTo(User::class, 'moved_by');
    }
}
