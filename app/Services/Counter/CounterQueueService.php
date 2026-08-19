<?php

namespace App\Services\Counter;

use App\Models\CounterQueueEntry;
use App\Models\StorageLocation;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Audit\AuditLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A lightweight walk-in queue for a counter — "who's waiting right now,"
 * distinct from the check-in flow (CounterIntakeService) which is about
 * an item, not a person waiting in line. A student joins the queue for a
 * reason (claim an item, report something, ask a question); an officer
 * calls them forward, starts serving them, then completes or no-shows
 * the entry. Not a general-purpose ticketing system — scoped tightly to
 * what a counter actually needs.
 */
class CounterQueueService
{
    public function __construct(
        protected AuditLogService $audit,
    ) {
    }

    /**
     * Add the requester to a counter's queue. One active (waiting/called/
     * serving) entry per person per counter at a time — joining again
     * while already in line just returns the existing entry rather than
     * creating a second ticket.
     */
    public function join(StorageLocation $counter, User $requester, ?string $purpose, ?string $notes = null): CounterQueueEntry
    {
        $this->assertIsUsableCounter($counter);

        $existing = CounterQueueEntry::query()
            ->where('storage_location_id', $counter->id)
            ->where('user_id', $requester->id)
            ->active()
            ->first();

        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($counter, $requester, $purpose, $notes) {
            $ticketNumber = CounterQueueEntry::query()
                ->where('storage_location_id', $counter->id)
                ->whereDate('created_at', now()->toDateString())
                ->max('ticket_number') + 1;

            $entry = CounterQueueEntry::create([
                'storage_location_id' => $counter->id,
                'user_id' => $requester->id,
                'ticket_number' => $ticketNumber,
                'purpose' => in_array($purpose, CounterQueueEntry::PURPOSES, true) ? $purpose : CounterQueueEntry::PURPOSE_OTHER,
                'status' => CounterQueueEntry::STATUS_WAITING,
                'notes' => $notes,
            ]);

            $this->audit->log(
                'counter.queue_joined',
                $entry,
                "{$requester->name} joined the queue at {$counter->label} (ticket #{$ticketNumber})."
            );

            return $entry;
        });
    }

    /**
     * Call the oldest waiting entry forward. Returns null if nobody's
     * waiting — that's a normal, expected outcome, not an error.
     */
    public function callNext(StorageLocation $counter, User $officer): ?CounterQueueEntry
    {
        $this->assertOfficerCanOperate($counter, $officer);

        $entry = CounterQueueEntry::query()
            ->where('storage_location_id', $counter->id)
            ->waiting()
            ->oldest('created_at')
            ->first();

        if (!$entry) {
            return null;
        }

        return $this->call($entry, $officer);
    }

    /**
     * Call a specific entry forward (used when an officer picks someone
     * out of order, e.g. handling a walk-in they already spoke to).
     */
    public function call(CounterQueueEntry $entry, User $officer): CounterQueueEntry
    {
        $this->assertOfficerCanOperate($entry->storageLocation, $officer);
        $this->assertStatus($entry, [CounterQueueEntry::STATUS_WAITING], 'called forward');

        $entry->update([
            'status' => CounterQueueEntry::STATUS_CALLED,
            'called_at' => now(),
            'handled_by' => $officer->id,
        ]);

        $this->audit->log(
            'counter.queue_called',
            $entry,
            "Queue ticket #{$entry->ticket_number} at {$entry->storageLocation->label} called by officer #{$officer->id}."
        );

        $entry->requester->notify(new SclfNotification(
            SclfNotification::TYPE_QUEUE_CALLED,
            "It's your turn",
            "You're being called at {$entry->storageLocation->label} — ticket #{$entry->ticket_number}. Please head over now.",
        ));

        return $entry->fresh();
    }

    public function startServing(CounterQueueEntry $entry, User $officer): CounterQueueEntry
    {
        $this->assertOfficerCanOperate($entry->storageLocation, $officer);
        $this->assertStatus($entry, [CounterQueueEntry::STATUS_CALLED], 'marked as being served');

        $entry->update([
            'status' => CounterQueueEntry::STATUS_SERVING,
            'started_at' => now(),
            'handled_by' => $officer->id,
        ]);

        return $entry->fresh();
    }

    public function complete(CounterQueueEntry $entry, User $officer): CounterQueueEntry
    {
        $this->assertOfficerCanOperate($entry->storageLocation, $officer);
        $this->assertStatus(
            $entry,
            [CounterQueueEntry::STATUS_CALLED, CounterQueueEntry::STATUS_SERVING],
            'completed'
        );

        $entry->update([
            'status' => CounterQueueEntry::STATUS_COMPLETED,
            'completed_at' => now(),
            'handled_by' => $officer->id,
        ]);

        $this->audit->log(
            'counter.queue_completed',
            $entry,
            "Queue ticket #{$entry->ticket_number} at {$entry->storageLocation->label} completed by officer #{$officer->id}."
        );

        return $entry->fresh();
    }

    /**
     * Called forward but never showed up. Distinct from cancel() — this
     * is the officer's record that the person didn't respond, not the
     * requester's own choice to drop out of line.
     */
    public function markNoShow(CounterQueueEntry $entry, User $officer): CounterQueueEntry
    {
        $this->assertOfficerCanOperate($entry->storageLocation, $officer);
        $this->assertStatus($entry, [CounterQueueEntry::STATUS_CALLED], 'marked as a no-show');

        $entry->update([
            'status' => CounterQueueEntry::STATUS_NO_SHOW,
            'completed_at' => now(),
            'handled_by' => $officer->id,
        ]);

        $this->audit->log(
            'counter.queue_no_show',
            $entry,
            "Queue ticket #{$entry->ticket_number} at {$entry->storageLocation->label} marked no-show by officer #{$officer->id}."
        );

        return $entry->fresh();
    }

    /**
     * The requester dropping out of line themselves, or an officer/admin
     * cancelling on their behalf. Only while still waiting or called —
     * once serving has actually started, use complete() instead.
     */
    public function cancel(CounterQueueEntry $entry, User $actor): CounterQueueEntry
    {
        $isSelf = $entry->user_id === $actor->id;
        $isStaff = $actor->hasAnyRole(['security_officer', 'admin']);

        if (!$isSelf && !$isStaff) {
            throw ValidationException::withMessages([
                'queue_entry' => ['You can only cancel your own queue ticket.'],
            ]);
        }

        if ($isStaff && !$isSelf) {
            $this->assertOfficerCanOperate($entry->storageLocation, $actor);
        }

        $this->assertStatus(
            $entry,
            [CounterQueueEntry::STATUS_WAITING, CounterQueueEntry::STATUS_CALLED],
            'cancelled'
        );

        $entry->update([
            'status' => CounterQueueEntry::STATUS_CANCELLED,
            'completed_at' => now(),
        ]);

        $this->audit->log(
            'counter.queue_cancelled',
            $entry,
            "Queue ticket #{$entry->ticket_number} at {$entry->storageLocation->label} cancelled by #{$actor->id}."
        );

        return $entry->fresh();
    }

    protected function assertIsUsableCounter(StorageLocation $counter): void
    {
        if ($counter->type !== StorageLocation::TYPE_COUNTER) {
            throw ValidationException::withMessages([
                'storage_location_id' => ['That location is not set up as a counter.'],
            ]);
        }

        if ($counter->status !== StorageLocation::STATUS_OPEN || !$counter->is_active) {
            throw ValidationException::withMessages([
                'storage_location_id' => ['That counter is not currently accepting queue entries.'],
            ]);
        }
    }

    protected function assertOfficerCanOperate(StorageLocation $counter, User $officer): void
    {
        if (!$officer->canOperateInCampus($counter->campus_id)) {
            throw ValidationException::withMessages([
                'storage_location_id' => ['That counter belongs to a different campus than your account.'],
            ]);
        }
    }

    protected function assertStatus(CounterQueueEntry $entry, array $allowed, string $action): void
    {
        if (!in_array($entry->status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Ticket #{$entry->ticket_number} can't be {$action} from its current status ({$entry->status})."],
            ]);
        }
    }
}
