<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemMatch extends Model
{
    protected $table = 'item_matches';

    public const STATUS_PENDING = 'pending';
    public const STATUS_NOTIFIED = 'notified';
    public const STATUS_CLAIMED = 'claimed';
    public const STATUS_DISMISSED = 'dismissed';

    protected $fillable = [
        'lost_item_id',
        'found_item_id',
        'score',
        'match_level',
        'score_breakdown',
        'status',
    ];

    protected $casts = [
        'score_breakdown' => 'array',
    ];

    public function lostItem()
    {
        return $this->belongsTo(LostItem::class);
    }

    public function foundItem()
    {
        return $this->belongsTo(FoundItem::class);
    }

    public function claims()
    {
        return $this->hasMany(Claim::class, 'item_match_id');
    }
}
