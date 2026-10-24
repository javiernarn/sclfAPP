<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\RemembersWhoDeleted;
use Illuminate\Database\Eloquent\SoftDeletes;

class LostItem extends Model
{
    use HasFactory, SoftDeletes, RemembersWhoDeleted;

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

    // Lost reports still looking for their item (not already claimed / closed).
    public const MATCHABLE_STATUSES = [self::STATUS_PENDING, self::STATUS_MATCHED];

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
        'details',
        'location_lost',
        'date_lost',
        'time_lost',
        'image_path',
        'contact_info',
        'status',
        'approved_at',
        'approved_by',
        'approval_note',
        'broadcast_started_at',
        'broadcast_finished_at',
        'broadcast_count',
    ];

    protected $casts = [
        'date_lost' => 'date',
        'approved_at' => 'datetime',
        'details' => 'array',
    ];

    /**
     * Who may see this report.
     *
     * A report stays private to its reporter and the lost-and-found handlers
     * (security / admin / staff) until a handler approves it (approved_at);
     * after that any signed-in user can browse it. This is the ONE place that
     * rule lives: the list, the single-report view, and global search all use
     * it, so they cannot drift apart.
     */
    public function scopeVisibleTo($query, User $viewer)
    {
        if ($viewer->hasAnyRole(User::LOST_FOUND_HANDLER_ROLES)) {
            return $query;
        }

        return $query->where(function ($q) use ($viewer) {
            $q->whereNotNull($q->getModel()->qualifyColumn('approved_at'))
                ->orWhere($q->getModel()->qualifyColumn('user_id'), $viewer->id);
        });
    }

    public function isVisibleTo(User $viewer): bool
    {
        return $this->approved_at !== null
            || (int) $this->user_id === (int) $viewer->id
            || $viewer->hasAnyRole(User::LOST_FOUND_HANDLER_ROLES);
    }

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
        return \App\Support\PrivateMedia::url($this->image_path);
    }
}