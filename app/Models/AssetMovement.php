<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetMovement extends Model
{
    public const ACTION_REGISTERED = 'registered';
    public const ACTION_ASSIGNED = 'assigned';
    public const ACTION_UNASSIGNED = 'unassigned';
    public const ACTION_SENT_FOR_REPAIR = 'sent_for_repair';
    public const ACTION_RETURNED_FROM_REPAIR = 'returned_from_repair';
    public const ACTION_RETIRED = 'retired';
    public const ACTION_REPORTED_LOST = 'reported_lost';

    protected $fillable = [
        'asset_id', 'from_user_id', 'to_user_id', 'moved_by', 'action', 'notes',
    ];

    public function asset()
    {
        return $this->belongsTo(Asset::class);
    }

    public function fromUser()
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function toUser()
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function mover()
    {
        return $this->belongsTo(User::class, 'moved_by');
    }
}
