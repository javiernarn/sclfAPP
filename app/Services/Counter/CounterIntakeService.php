<?php

namespace App\Services\Counter;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\InventoryMovement;
use App\Models\StorageLocation;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The "mall bag-check counter" flow — a security officer receives an item
 * directly from its owner (a student/instructor who's already right there),
 * so there's no finder to identify and no lost/found matching to run.
 * Unlike the normal found_items flow (report -> verify -> match -> claim ->
 * evidence -> review -> approve -> release), the owner is known the moment
 * the officer looks them up, so this skips straight to an approved claim.
 *
 * Deliberately does NOT also generate the release QR here. If the same
 * check-in action both logged the item and minted its pickup pass, the
 * officer standing at the counter would have everything needed to release
 * an item to themselves without anyone else ever being involved. Instead,
 * the release QR is generated the same way as any other approved claim —
 * from the Claims page, at the moment the owner actually returns to pick
 * it up — which keeps "who logged it in" and "who released it" as two
 * separate, separately-audited actions even when they're the same officer.
 */
class CounterIntakeService
{
    public function __construct(
        protected AuditLogService $audit,
    ) {
    }

    /**
     * Log an item at the counter for a known owner. Returns the item and
     * its pre-approved claim — no QR yet. The officer (or a colleague)
     * generates the actual release QR later, from that claim's page, the
     * same way as any other approved claim.
     */
    public function checkIn(User $officer, User $owner, StorageLocation $counter, array $data): array
    {
        if ($counter->type !== StorageLocation::TYPE_COUNTER) {
            throw ValidationException::withMessages([
                'storage_location_id' => ['That location is not set up as a counter.'],
            ]);
        }

        if (!$counter->is_active) {
            throw ValidationException::withMessages([
                'storage_location_id' => ['That counter is currently inactive.'],
            ]);
        }

        // Alongside is_active (a hard on/off switch), status gives a
        // reason: a counter can be temporarily 'closed' or 'maintenance'
        // without being deactivated outright. Only 'open' accepts new
        // check-ins — is_active alone can't express "still exists, just
        // not accepting walk-ins right now."
        if ($counter->status !== StorageLocation::STATUS_OPEN) {
            $reason = match ($counter->status) {
                StorageLocation::STATUS_CLOSED => 'currently closed',
                StorageLocation::STATUS_MAINTENANCE => 'under maintenance',
                StorageLocation::STATUS_INACTIVE => 'inactive',
                default => 'not accepting check-ins right now',
            };

            throw ValidationException::withMessages([
                'storage_location_id' => ["That counter is {$reason}."],
            ]);
        }

        if ($owner->id === $officer->id) {
            throw ValidationException::withMessages([
                'owner_id' => ['A security officer cannot check an item in under their own account.'],
            ]);
        }

        if (!$officer->canOperateInCampus($counter->campus_id)) {
            throw ValidationException::withMessages([
                'storage_location_id' => ['That counter belongs to a different campus than your account.'],
            ]);
        }

        // Server-side backstop against duplicate check-ins — a double-tap
        // on "Check In", a flaky connection causing the app to auto-retry,
        // or two officers at the same counter submitting the same walk-in
        // twice, all produce two FoundItem rows (each with its own random
        // qr_code, so the DB's unique constraints don't catch it) unless
        // something looks for the near-duplicate first. If the exact same
        // item name was just checked in for the exact same owner in the
        // last 15 seconds, treat it as a resubmit rather than a second item.
        $recentDuplicate = FoundItem::query()
            ->where('intake_channel', FoundItem::CHANNEL_COUNTER_INTAKE)
            ->where('item_name', $data['item_name'])
            ->where('security_officer_id', $officer->id)
            ->where('created_at', '>=', now()->subSeconds(15))
            ->whereHas('claims', fn ($q) => $q->where('claimant_id', $owner->id))
            ->exists();

        if ($recentDuplicate) {
            throw ValidationException::withMessages([
                'item_name' => ["\"{$data['item_name']}\" was already checked in for {$owner->name} a few seconds ago. Check History before checking it in again."],
            ]);
        }

        return DB::transaction(function () use ($officer, $owner, $counter, $data) {
            $item = FoundItem::create([
                // No independent "finder" here — the officer is the one
                // logging the record, mirroring how security-verified
                // items already record security_officer_id.
                'user_id' => $officer->id,
                'campus_id' => $counter->campus_id,
                'item_name' => $data['item_name'],
                'description' => $data['description'] ?? "Checked in at the counter by {$officer->name}.",
                'category' => $data['category'] ?? null,
                'location_found' => $counter->label ?: $counter->code,
                'date_found' => now()->toDateString(),
                'time_found' => now()->toTimeString(),
                'status' => FoundItem::STATUS_STORED,
                'intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE,
                'verification_status' => 'approved',
                'security_officer_id' => $officer->id,
                'verified_at' => now(),
                'storage_location_id' => $counter->id,
                'qr_code' => 'SCLF-CTR-' . str_pad((string) now()->timestamp, 10, '0', STR_PAD_LEFT) . '-' . Str::upper(Str::random(4)),
            ]);

            InventoryMovement::create([
                'found_item_id' => $item->id,
                'storage_location_id' => $counter->id,
                'moved_by' => $officer->id,
                'action' => InventoryMovement::ACTION_STORED,
                'notes' => "Checked in at counter {$counter->label} for {$owner->name} ({$owner->student_id}).",
            ]);

            // Owner already confirmed in person -> the claim starts
            // pre-approved instead of going through submit()'s normal
            // pending -> under_review -> approved path.
            $claim = Claim::create([
                'found_item_id' => $item->id,
                'claimant_id' => $owner->id,
                'status' => Claim::STATUS_APPROVED,
                'reviewed_by' => $officer->id,
                'review_notes' => 'Owner identified in person at counter check-in; no separate review needed.',
                'reviewed_at' => now(),
            ]);

            $this->audit->log(
                'counter.checked_in',
                $item,
                "Item #{$item->id} checked in at counter {$counter->label} for {$owner->name} (#{$owner->id}) by officer #{$officer->id}.",
            );

            $owner->notify(new \App\Notifications\SclfNotification(
                \App\Notifications\SclfNotification::TYPE_CLAIM_APPROVED,
                'Item checked in for you',
                "{$item->item_name} was checked in for you at {$counter->label}. Security will generate your pickup pass when you come to collect it.",
                Claim::class,
                $claim->id,
            ));

            return [
                'found_item' => $item->fresh(),
                'claim' => $claim->fresh(),
            ];
        });
    }
}
