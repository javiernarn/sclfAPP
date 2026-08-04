<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StorageLocation extends Model
{
    protected $fillable = [
        'campus_id', 'building_id', 'room', 'cabinet', 'shelf', 'box', 'code', 'is_active', 'created_by',
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
}
