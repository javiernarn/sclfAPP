<?php

namespace App\Services\Assets;

use App\Models\Asset;
use App\Models\AssetMovement;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Audit\AuditLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Campus asset registry: register -> assign/unassign -> repair cycle ->
 * retire/lost. Same transactional + audit-logged shape as
 * DispositionService, with an AssetMovement side table mirroring
 * InventoryMovement's role for found items — an append-only "what
 * happened to this asset and when" trail.
 */
class AssetService
{
    public function __construct(
        protected AuditLogService $audit,
    ) {
    }

    /**
     * Next sequential asset tag, e.g. "AST-2026-0001". Same
     * lock-and-derive-from-the-highest-existing-number approach as
     * User::generateStaffId(), so two officers registering an asset at
     * the same moment can't collide.
     */
    public function generateAssetTag(): string
    {
        $year = now()->format('Y');
        $prefix = Asset::ASSET_TAG_PREFIX;
        $pattern = "{$prefix}-{$year}-";

        return DB::transaction(function () use ($prefix, $year, $pattern) {
            $last = Asset::withTrashed()
                ->where('asset_tag', 'like', $pattern . '%')
                ->lockForUpdate()
                ->orderByDesc('asset_tag')
                ->value('asset_tag');

            $next = 1;
            if ($last && preg_match('/(\d+)$/', $last, $m)) {
                $next = ((int) $m[1]) + 1;
            }

            return sprintf('%s-%s-%04d', $prefix, $year, $next);
        });
    }

    /**
     * Officer/admin only — see AssetController. campus_id defaults to
     * the registering officer's own campus, same fallback pattern as
     * VisitorService::checkIn().
     */
    public function register(User $officer, array $data): Asset
    {
        if (!in_array($data['category'], Asset::CATEGORIES, true)) {
            throw ValidationException::withMessages(['category' => 'Invalid asset category.']);
        }

        return DB::transaction(function () use ($officer, $data) {
            $asset = Asset::create([
                'campus_id' => $data['campus_id'] ?? $officer->campus_id,
                'building_id' => $data['building_id'] ?? null,
                'asset_tag' => $this->generateAssetTag(),
                'category' => $data['category'],
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'brand' => $data['brand'] ?? null,
                'model' => $data['model'] ?? null,
                'serial_number' => $data['serial_number'] ?? null,
                'location_text' => $data['location_text'] ?? null,
                'status' => Asset::STATUS_IN_STORAGE,
                'acquired_at' => $data['acquired_at'] ?? null,
                'value' => $data['value'] ?? null,
                'created_by' => $officer->id,
                'notes' => $data['notes'] ?? null,
            ]);

            AssetMovement::create([
                'asset_id' => $asset->id,
                'moved_by' => $officer->id,
                'action' => AssetMovement::ACTION_REGISTERED,
                'notes' => "Registered by {$officer->name}.",
            ]);

            $this->audit->log(
                'asset.registered',
                $asset,
                "Asset {$asset->asset_tag} ({$asset->name}) registered by {$officer->name}.",
                actor: $officer,
            );

            return $asset;
        });
    }

    /**
     * Hand an asset to a custodian. Blocked once retired/lost (terminal —
     * see Asset::TERMINAL_STATUSES); allowed from in_storage, in_repair
     * (returning straight to a person rather than the shelf), or
     * re-assigning from one custodian directly to another.
     */
    public function assign(Asset $asset, User $custodian, User $officer, ?string $notes = null): Asset
    {
        if ($asset->isTerminal()) {
            throw ValidationException::withMessages(['status' => 'Retired or lost assets cannot be assigned.']);
        }

        return DB::transaction(function () use ($asset, $custodian, $officer, $notes) {
            $previousCustodianId = $asset->assigned_to;

            $asset->update([
                'status' => Asset::STATUS_ASSIGNED,
                'assigned_to' => $custodian->id,
                'assigned_at' => now(),
            ]);

            AssetMovement::create([
                'asset_id' => $asset->id,
                'from_user_id' => $previousCustodianId,
                'to_user_id' => $custodian->id,
                'moved_by' => $officer->id,
                'action' => AssetMovement::ACTION_ASSIGNED,
                'notes' => $notes,
            ]);

            $this->audit->log(
                'asset.assigned',
                $asset,
                "Asset {$asset->asset_tag} assigned to {$custodian->name} by {$officer->name}.",
                actor: $officer,
            );

            $custodian->notify(new SclfNotification(
                type: SclfNotification::TYPE_ASSET_ASSIGNED,
                title: 'Asset Assigned To You',
                message: "{$asset->name} ({$asset->asset_tag}) was assigned to you by {$officer->name}.",
                relatedType: Asset::class,
                relatedId: $asset->id,
            ));

            return $asset->fresh();
        });
    }

    /**
     * Return an assigned asset to storage — the custodian gave it back,
     * or it's being reclaimed. Not the same as sendForRepair(): this is
     * "back on the shelf, still working fine".
     */
    public function unassign(Asset $asset, User $officer, ?string $notes = null): Asset
    {
        if ($asset->status !== Asset::STATUS_ASSIGNED) {
            throw ValidationException::withMessages(['status' => 'Only currently-assigned assets can be unassigned.']);
        }

        return DB::transaction(function () use ($asset, $officer, $notes) {
            $previousCustodianId = $asset->assigned_to;

            $asset->update([
                'status' => Asset::STATUS_IN_STORAGE,
                'assigned_to' => null,
                'assigned_at' => null,
            ]);

            AssetMovement::create([
                'asset_id' => $asset->id,
                'from_user_id' => $previousCustodianId,
                'moved_by' => $officer->id,
                'action' => AssetMovement::ACTION_UNASSIGNED,
                'notes' => $notes,
            ]);

            $this->audit->log(
                'asset.unassigned',
                $asset,
                "Asset {$asset->asset_tag} returned to storage by {$officer->name}.",
                actor: $officer,
            );

            return $asset->fresh();
        });
    }

    /**
     * Send an asset out for repair — from storage or straight from a
     * custodian (whoever had it hands it over to be fixed). Clears any
     * current assignment; assign() is what puts it back in someone's
     * hands once repaired.
     */
    public function sendForRepair(Asset $asset, User $officer, ?string $notes = null): Asset
    {
        if ($asset->isTerminal()) {
            throw ValidationException::withMessages(['status' => 'Retired or lost assets cannot be sent for repair.']);
        }

        return DB::transaction(function () use ($asset, $officer, $notes) {
            $previousCustodianId = $asset->assigned_to;

            $asset->update([
                'status' => Asset::STATUS_IN_REPAIR,
                'assigned_to' => null,
                'assigned_at' => null,
                'condition_notes' => $notes ?? $asset->condition_notes,
            ]);

            AssetMovement::create([
                'asset_id' => $asset->id,
                'from_user_id' => $previousCustodianId,
                'moved_by' => $officer->id,
                'action' => AssetMovement::ACTION_SENT_FOR_REPAIR,
                'notes' => $notes,
            ]);

            $this->audit->log(
                'asset.sent_for_repair',
                $asset,
                "Asset {$asset->asset_tag} sent for repair by {$officer->name}.",
                actor: $officer,
            );

            return $asset->fresh();
        });
    }

    /**
     * Repair's done — back to storage, ready to be assigned again.
     */
    public function returnFromRepair(Asset $asset, User $officer, ?string $notes = null): Asset
    {
        if ($asset->status !== Asset::STATUS_IN_REPAIR) {
            throw ValidationException::withMessages(['status' => 'Only assets currently in repair can be returned.']);
        }

        return DB::transaction(function () use ($asset, $officer, $notes) {
            $asset->update([
                'status' => Asset::STATUS_IN_STORAGE,
                'condition_notes' => $notes ?? $asset->condition_notes,
            ]);

            AssetMovement::create([
                'asset_id' => $asset->id,
                'moved_by' => $officer->id,
                'action' => AssetMovement::ACTION_RETURNED_FROM_REPAIR,
                'notes' => $notes,
            ]);

            $this->audit->log(
                'asset.returned_from_repair',
                $asset,
                "Asset {$asset->asset_tag} returned from repair by {$officer->name}.",
                actor: $officer,
            );

            return $asset->fresh();
        });
    }

    /**
     * Retire an asset for good — worn out, obsolete, whatever the
     * reason. Terminal, like FoundItem::STATUS_DISPOSED: the record and
     * its movement history stay for audit purposes, it just drops out of
     * the active registry.
     */
    public function retire(Asset $asset, User $officer, ?string $notes = null): Asset
    {
        if ($asset->isTerminal()) {
            throw ValidationException::withMessages(['status' => 'This asset is already retired or reported lost.']);
        }

        return DB::transaction(function () use ($asset, $officer, $notes) {
            $previousCustodianId = $asset->assigned_to;

            $asset->update([
                'status' => Asset::STATUS_RETIRED,
                'assigned_to' => null,
                'assigned_at' => null,
            ]);

            AssetMovement::create([
                'asset_id' => $asset->id,
                'from_user_id' => $previousCustodianId,
                'moved_by' => $officer->id,
                'action' => AssetMovement::ACTION_RETIRED,
                'notes' => $notes,
            ]);

            $this->audit->log(
                'asset.retired',
                $asset,
                "Asset {$asset->asset_tag} retired by {$officer->name}." . ($notes ? " Reason: {$notes}" : ''),
                actor: $officer,
            );

            return $asset->fresh();
        });
    }

    /**
     * Flag an asset as lost — reachable from any non-terminal status
     * (an asset can go missing whether it was on the shelf, assigned to
     * someone, or out for repair). Terminal, same as retire(): a lost
     * asset that turns up again is a fresh registration or a manual
     * fix, not a one-click "found it" undo.
     */
    public function reportLost(Asset $asset, User $officer, ?string $notes = null): Asset
    {
        if ($asset->isTerminal()) {
            throw ValidationException::withMessages(['status' => 'This asset is already retired or reported lost.']);
        }

        return DB::transaction(function () use ($asset, $officer, $notes) {
            $previousCustodianId = $asset->assigned_to;

            $asset->update([
                'status' => Asset::STATUS_LOST,
                'assigned_to' => null,
                'assigned_at' => null,
            ]);

            AssetMovement::create([
                'asset_id' => $asset->id,
                'from_user_id' => $previousCustodianId,
                'moved_by' => $officer->id,
                'action' => AssetMovement::ACTION_REPORTED_LOST,
                'notes' => $notes,
            ]);

            $this->audit->log(
                'asset.reported_lost',
                $asset,
                "Asset {$asset->asset_tag} reported lost by {$officer->name}." . ($notes ? " Details: {$notes}" : ''),
                actor: $officer,
            );

            return $asset->fresh();
        });
    }
}
