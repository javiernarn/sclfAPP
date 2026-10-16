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

    /** Statuses a handler can still act on. */
    public const OPEN_STATUSES = [self::STATUS_PENDING, self::STATUS_NOTIFIED];

    protected $fillable = [
        'lost_item_id',
        'found_item_id',
        'score',
        'match_level',
        'score_breakdown',
        'score_details',
        'scored_at',
        'status',
    ];

    protected $casts = [
        'score_breakdown' => 'array',
        'score_details' => 'array',
        'scored_at' => 'datetime',
    ];

    public function lostItem()
    {
        return $this->belongsTo(LostItem::class);
    }

    public function foundItem()
    {
        return $this->belongsTo(FoundItem::class);
    }

    /**
     * Leads that can still go somewhere: the found item is physically on hand and
     * the lost report is still open. Hides every pairing whose item was already
     * claimed, waiting for release, released, disposed, rejected or deleted — and
     * whose lost report already has an approved claim or was closed.
     */
    public function scopeLive($query)
    {
        return $query
            ->whereHas('lostItem', fn ($q) => $q->whereIn('status', LostItem::MATCHABLE_STATUSES))
            ->whereHas('foundItem', fn ($q) => $q->whereIn('status', FoundItem::MATCHABLE_STATUSES));
    }

    /**
     * Retire a lead the system knows is moot (the item left, the report closed…).
     * Marked dismissed with `score_details.retired` so it is never mistaken for a
     * person's own "not a match" decision (the learner only trains on the latter).
     */
    public function retire(string $reason): void
    {
        $details = $this->score_details ?? [];
        $details['retired'] = $reason;
        $details['retired_at'] = now()->toIso8601String();

        $this->forceFill(['status' => self::STATUS_DISMISSED, 'score_details' => $details])->save();
    }

    public function claims()
    {
        return $this->hasMany(Claim::class, 'item_match_id');
    }
}
