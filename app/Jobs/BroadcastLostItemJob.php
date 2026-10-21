<?php

namespace App\Jobs;

use App\Mail\LostItemAlertMail;
use App\Models\LostItem;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Runs in the background AFTER the approver's click has already returned.
 * Fans out one small queued email per recipient, so one bad address or a
 * slow SMTP response never blocks (or fails) everybody else.
 */
class BroadcastLostItemJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 300;

    /** Everyone: students, instructors, staff, security officers and admins. */
    private const AUDIENCE = ['student', 'instructor', 'staff', 'security_officer', 'admin'];

    public function __construct(public int $lostItemId, public int $approverId)
    {
    }

    public function handle(): void
    {
        // Switched off after this job was queued -> send nothing.
        if (! config('sclf.broadcast_lost_item_emails')) {
            return;
        }

        $item = LostItem::with(['user', 'campus'])->find($this->lostItemId);

        // Archived, claimed or closed between approval and now -> nothing to announce.
        if (! $item || ! in_array($item->status, LostItem::MATCHABLE_STATUSES, true)) {
            return;
        }

        $payload = $this->payload($item, User::find($this->approverId));

        // Send-once guard: whatever runs this job (a retry, an old job still
        // sitting in the queue, a double dispatch), only the first run for
        // this report may email anyone. Atomic, so two runs can't both pass.
        $claimed = LostItem::whereKey($item->id)
            ->whereNull('broadcast_started_at')
            ->update(['broadcast_started_at' => now()]);

        if (! $claimed) {
            return;
        }

        @set_time_limit(0);

        // One personal email PER ACCOUNT: addressed To that person (so their
        // inbox shows their own address) and greeted by THEIR name, never the
        // name of whoever reported the item. Accounts that share one mailbox
        // address get a single email, not duplicates.
        $sent = 0;
        $seen = [];

        User::query()
            ->where('is_active', true)
            ->whereNotNull('email')
            ->whereNotNull('email_verified_at')
            ->where('id', '!=', $item->user_id) // skip the reporter
            ->role(self::AUDIENCE)
            ->when($item->campus_id, fn ($q) => $q->where(
                fn ($w) => $w->whereNull('campus_id')->orWhere('campus_id', $item->campus_id)
            ))
            ->select(['id', 'name', 'first_name', 'last_name', 'email'])
            ->chunkById(100, function ($users) use (&$sent, &$seen, $payload) {
                foreach ($users as $user) {
                    $address = mb_strtolower(trim($user->email));

                    if ($address === '' || isset($seen[$address])) {
                        continue;
                    }
                    $seen[$address] = true;

                    try {
                        Mail::to($address)->send(
                            new LostItemAlertMail($user->id, $this->fullName($user), $address, $payload)
                        );
                        $sent++;
                    } catch (\Throwable $e) {
                        // One bad address must not stop the rest.
                        report($e);
                    }
                }
            });

        $item->forceFill([
            'broadcast_finished_at' => now(),
            'broadcast_count' => $sent,
        ])->save();
    }

    private function payload(LostItem $item, ?User $approver): array
    {
        $owner = $item->user;

        // Privacy: first name + last initial only. No student ID, phone or
        // email goes out to the whole school.
        $ownerLabel = $owner
            ? trim(($owner->first_name ?: $owner->name) . ' ' . ($owner->last_name ? mb_substr($owner->last_name, 0, 1) . '.' : ''))
            : 'A member of our community';

        $roleLabels = ['admin' => 'Administrator', 'staff' => 'Staff', 'security_officer' => 'Security Officer'];
        $role = $approver?->getRoleNames()->first();

        return [
            'item_id' => $item->id,
            'item_name' => $item->item_name,
            'category' => $item->category,
            'brand' => $item->brand,
            'color' => $item->color,
            'model' => $item->model,
            'unique_characteristics' => $item->unique_characteristics,
            'description' => Str::limit((string) $item->description, 300),
            'location_lost' => $item->location_lost,
            'date_lost' => optional($item->date_lost)->format('F j, Y'),
            'time_lost' => $item->time_lost,
            'campus' => $item->campus?->name,
            'image_url' => $item->image_url,
            'owner_label' => $ownerLabel,
            'approved_at' => optional($item->approved_at)->format('F j, Y g:i A'),
            'approver_name' => $approver?->name ?? 'SCLF Desk',
            'approver_role' => $roleLabels[$role] ?? 'Lost & Found Desk',
            'approval_note' => $item->approval_note,
        ];
    }

    private function fullName(User $u): string
    {
        return trim(($u->first_name ?? '') . ' ' . ($u->last_name ?? '')) ?: $u->name;
    }
}
