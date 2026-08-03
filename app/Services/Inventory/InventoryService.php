<?php

namespace App\Services\Inventory;

use App\Models\FoundItem;
use App\Models\InventoryMovement;
use App\Models\StorageLocation;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Audit\AuditLogService;
use App\Services\Matching\ItemMatchingService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InventoryService
{
    public function __construct(
        protected AuditLogService $audit,
        protected ItemMatchingService $matcher,
    ) {
    }

    /**
     * Security officer review of a found-item report: approve or reject it.
     */
    public function verify(FoundItem $item, User $officer, bool $approved, ?string $notes = null): FoundItem
    {
        return DB::transaction(function () use ($item, $officer, $approved, $notes) {
            $item->update([
                'verification_status' => $approved ? 'approved' : 'rejected',
                'verification_notes' => $notes,
                'security_officer_id' => $officer->id,
                'verified_at' => now(),
                'status' => $approved ? FoundItem::STATUS_ACCEPTED : FoundItem::STATUS_REJECTED,
            ]);

            $this->audit->log(
                'item.verified',
                $item,
                "Found item #{$item->id} " . ($approved ? 'approved' : 'rejected') . " by security officer #{$officer->id}."
            );

            $item->finder?->notify(new SclfNotification(
                $approved ? SclfNotification::TYPE_FOUND_REPORT_APPROVED : SclfNotification::TYPE_FOUND_REPORT_REJECTED,
                $approved ? 'Found report approved' : 'Found report rejected',
                $approved
                    ? 'Thank you — your found item report has been verified and is being stored.'
                    : 'Your found item report was rejected.' . ($notes ? " Reason: {$notes}" : ''),
                FoundItem::class,
                $item->id,
            ));

            if ($approved) {
                $this->matcher->runForFoundItem($item->fresh());
            }

            return $item->fresh();
        });
    }

    /**
     * Assign a found item to a storage location, generating its inventory
     * QR code if it doesn't have one yet.
     */
    public function assignStorage(FoundItem $item, StorageLocation $location, User $officer, ?string $notes = null): FoundItem
    {
        return DB::transaction(function () use ($item, $location, $officer, $notes) {
            $item->update([
                'storage_location_id' => $location->id,
                'status' => FoundItem::STATUS_STORED,
                'qr_code' => $item->qr_code ?? ('SCLF-ITEM-' . str_pad((string) $item->id, 6, '0', STR_PAD_LEFT) . '-' . Str::upper(Str::random(4))),
            ]);

            InventoryMovement::create([
                'found_item_id' => $item->id,
                'storage_location_id' => $location->id,
                'moved_by' => $officer->id,
                'action' => InventoryMovement::ACTION_STORED,
                'notes' => $notes,
            ]);

            $this->audit->log('inventory.stored', $item, "Found item #{$item->id} stored at {$location->code}.");

            return $item->fresh();
        });
    }

    public function move(FoundItem $item, StorageLocation $location, User $officer, ?string $notes = null): FoundItem
    {
        return DB::transaction(function () use ($item, $location, $officer, $notes) {
            $item->update(['storage_location_id' => $location->id]);

            InventoryMovement::create([
                'found_item_id' => $item->id,
                'storage_location_id' => $location->id,
                'moved_by' => $officer->id,
                'action' => InventoryMovement::ACTION_MOVED,
                'notes' => $notes,
            ]);

            $this->audit->log('inventory.moved', $item, "Found item #{$item->id} moved to {$location->code}.");

            return $item->fresh();
        });
    }
}
