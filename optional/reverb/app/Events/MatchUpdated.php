<?php

namespace App\Events;

use App\Models\ItemMatch;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * "This lost/found pairing just changed" — a nudge, not a data feed.
 *
 * Sent right away (ShouldBroadcastNow) rather than through the queue so the
 * Matches page updates even if no queue worker is running. The payload is
 * deliberately tiny and holds nothing private; listeners re-fetch the real
 * data over the authenticated REST API.
 */
class MatchUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /** Don't announce a change that was rolled back. */
    public bool $afterCommit = true;

    /**
     * @param  'created'|'rescored'|'status'  $reason
     */
    public function __construct(
        public int $matchId,
        public int $lostItemId,
        public int $foundItemId,
        public int $score,
        public string $level,
        public string $status,
        public string $reason,
    ) {
    }

    public static function for(ItemMatch $match, string $reason): self
    {
        return new self(
            $match->id, $match->lost_item_id, $match->found_item_id,
            (int) $match->score, (string) $match->match_level, (string) $match->status, $reason,
        );
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('lost-found.handlers'),
            new PrivateChannel('lost-items.' . $this->lostItemId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'match.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'match_id' => $this->matchId,
            'lost_item_id' => $this->lostItemId,
            'found_item_id' => $this->foundItemId,
            'score' => $this->score,
            'level' => $this->level,
            'status' => $this->status,
            'reason' => $this->reason,
        ];
    }
}
