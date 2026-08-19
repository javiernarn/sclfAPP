<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A single assignment of one officer to one storage location (counter),
 * with a start and (once ended) an end. See the storage_location_officers
 * migration for why this is a history table rather than a single column.
 */
class StorageLocationOfficer extends Model
{
    protected $fillable = [
        'storage_location_id',
        'user_id',
        'assigned_by',
        'assigned_at',
        'unassigned_at',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
        'unassigned_at' => 'datetime',
    ];

    public function storageLocation()
    {
        return $this->belongsTo(StorageLocation::class);
    }

    public function officer()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function scopeCurrent($query)
    {
        return $query->whereNull('unassigned_at');
    }
}
