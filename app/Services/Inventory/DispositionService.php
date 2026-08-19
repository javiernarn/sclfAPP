<?php

namespace App\Services\Inventory;

use App\Models\FoundItem;
use App\Models\InventoryMovement;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DispositionService
{
    public function __construct(
        protected AuditLogService $audit,
    ) {
    }

    /**
     * Items on the shelf whose retention has expired but haven't been
     * flagged unclaimed yet — what the sweep is about to act on, and also
     * what the "eligible" tab on the Unclaimed Items page shows before an
     * officer runs the sweep.
     */
    public function eligibleForUnclaimedQuery(): Builder
    {
        return FoundItem::query()
            ->whereIn('status', [FoundItem::STATUS_STORED, FoundItem::STATUS_MATCHED])
            ->whereNotNull('retention_expires_at')
            ->whereDate('retention_expires_at', '<=', now()->toDateString());
    }

    /**
     * Flags every eligible item as unclaimed. Run manually from the
     * Unclaimed Items page or via `php artisan disposition:sweep` on a
     * schedule — either way it's the same idempotent operation, so running
     * it twice in a day just finds nothing new the second time.
     *
     * Matched items are included: a match notification went out but
     * nobody followed through with a claim, so it's just as stale as an
     * unmatched one. Claimed/release-pending items are deliberately
     * excluded — someone's actively in the process of picking those up.
     *
     * @return int number of items flagged
     */
    public function sweepUnclaimed(?User $actor = null): int
    {
        return DB::transaction(function () use ($actor) {
            $items = $this->eligibleForUnclaimedQuery()->lockForUpdate()->get();

            foreach ($items as $item) {
                $item->update([
                    'status' => FoundItem::STATUS_UNCLAIMED,
                    'unclaimed_at' => now(),
                ]);

                InventoryMovement::create([
                    'found_item_id' => $item->id,
                    'storage_location_id' => $item->storage_location_id,
                    'moved_by' => $actor?->id ?? $item->security_officer_id,
                    'action' => InventoryMovement::ACTION_UNCLAIMED,
                    'notes' => 'Retention period expired with no claim.',
                ]);

                $this->audit->log(
                    'inventory.unclaimed',
                    $item,
                    "Found item #{$item->id} flagged unclaimed — retention expired {$item->retention_expires_at?->toDateString()}.",
                    actor: $actor,
                );
            }

            return $items->count();
        });
    }

    /**
     * Remove an unclaimed item from the shelf for good. Terminal, like a
     * release — the item and its full movement/audit history stay in the
     * system, just no longer occupying a capacity slot (see
     * FoundItem::ON_SHELF_STATUSES).
     */
    public function dispose(FoundItem $item, User $officer, string $method, ?string $notes = null): FoundItem
    {
        if (!in_array($method, FoundItem::DISPOSITION_METHODS, true)) {
            throw ValidationException::withMessages([
                'method' => 'Invalid disposition method.',
            ]);
        }

        if ($item->status !== FoundItem::STATUS_UNCLAIMED) {
            throw ValidationException::withMessages([
                'status' => 'Only items flagged unclaimed can be disposed of.',
            ]);
        }

        return DB::transaction(function () use ($item, $officer, $method, $notes) {
            $item->update([
                'status' => FoundItem::STATUS_DISPOSED,
                'disposition_method' => $method,
                'disposition_notes' => $notes,
                'disposed_by' => $officer->id,
                'disposed_at' => now(),
            ]);

            InventoryMovement::create([
                'found_item_id' => $item->id,
                'storage_location_id' => $item->storage_location_id,
                'moved_by' => $officer->id,
                'action' => InventoryMovement::ACTION_DISPOSED,
                'notes' => $notes ? "{$method}: {$notes}" : $method,
            ]);

            $this->audit->log(
                'inventory.disposed',
                $item,
                "Found item #{$item->id} disposed of ({$method}) by {$officer->name}.",
            );

            return $item->fresh();
        });
    }

    /**
     * The owner showed up late, or an officer flagged something in error —
     * bring an unclaimed item back onto the active shelf. Not available
     * once an item is actually disposed (that's terminal by design; a
     * disposed item that turns out to be needed is an exception case for a
     * human to handle directly, not a one-click undo).
     */
    public function restore(FoundItem $item, User $officer, ?string $notes = null): FoundItem
    {
        if ($item->status !== FoundItem::STATUS_UNCLAIMED) {
            throw ValidationException::withMessages([
                'status' => 'Only items currently flagged unclaimed can be restored.',
            ]);
        }

        return DB::transaction(function () use ($item, $officer, $notes) {
            $item->update([
                'status' => FoundItem::STATUS_STORED,
                'unclaimed_at' => null,
            ]);

            InventoryMovement::create([
                'found_item_id' => $item->id,
                'storage_location_id' => $item->storage_location_id,
                'moved_by' => $officer->id,
                'action' => InventoryMovement::ACTION_RESTORED,
                'notes' => $notes,
            ]);

            $this->audit->log(
                'inventory.restored',
                $item,
                "Found item #{$item->id} restored from unclaimed by {$officer->name}.",
            );

            return $item->fresh();
        });
    }
}
