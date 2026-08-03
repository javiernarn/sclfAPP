<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LostItem extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_PENDING = 'pending';
    public const STATUS_MATCHED = 'matched';
    public const STATUS_CLAIMED = 'claimed';
    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_MATCHED,
        self::STATUS_CLAIMED,
        self::STATUS_CLOSED,
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
        'location_lost',
        'date_lost',
        'time_lost',
        'image_path',
        'contact_info',
        'status',
    ];

    protected $casts = [
        'date_lost' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function matches()
    {
        return $this->hasMany(ItemMatch::class);
    }

    public function claims()
    {
        return $this->hasMany(Claim::class);
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? asset('storage/' . $this->image_path) : null;
    }
}