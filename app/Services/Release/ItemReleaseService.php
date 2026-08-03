<?php

namespace App\Services\Release;

use App\Models\Claim;
use App\Models\InventoryMovement;
use App\Models\QrRelease;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Audit\AuditLogService;
use App\Services\Claims\ClaimService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ItemReleaseService
{
    public function __construct(
        protected AuditLogService $audit,
        protected ClaimService $claims,
    ) {
    }

    /**
     * Generate a release QR for an approved claim. The raw token is
     * returned once (to encode into the QR image on the frontend) and
     * only its hash is persisted.
     */
    public function generate(Claim $claim, User $officer): array
    {
        if ($claim->status !== Claim::STATUS_APPROVED) {
            throw ValidationException::withMessages([
                'status' => ['A release QR can only be generated for an approved claim.'],
            ]);
        }

        return DB::transaction(function () use ($claim, $officer) {
            $rawToken = QrRelease::generateRawToken();
            $publicCode = 'SCLF-ITEM-' . str_pad((string) $claim->found_item_id, 6, '0', STR_PAD_LEFT);

            $qr = QrRelease::create([
                'claim_id' => $claim->id,
                'found_item_id' => $claim->found_item_id,
                'public_code' => $publicCode,
                'token_hash' => QrRelease::hashToken($rawToken),
                'status' => QrRelease::STATUS_PENDING,
                'expires_at' => now()->addHours(72),
                'generated_by' => $officer->id,
            ]);

            $this->claims->transition($claim, Claim::STATUS_RELEASE_PENDING, $officer, 'Release QR generated.');

            $this->audit->log('qr.generated', $qr, "Release QR generated for claim #{$claim->id}.");

            $claim->claimant?->notify(new SclfNotification(
                SclfNotification::TYPE_ITEM_READY_FOR_RELEASE,
                'Item ready for release',
                "Your item is ready for pickup. Present code {$publicCode} to Security.",
                Claim::class,
                $claim->id,
            ));

            return ['qr_release' => $qr, 'raw_token' => $rawToken, 'public_code' => $publicCode];
        });
    }

    /**
     * Issue a fresh token for a claim already in release_pending, e.g. when
     * the previously-generated token was lost before the officer could use
     * it (browser closed, page refreshed, etc). Reuses the same public_code
     * — only the secret token changes — and invalidates the old token by
     * overwriting its hash, so the lost one can never be used even if it
     * resurfaces.
     */
    public function regenerateToken(Claim $claim, User $officer): array
    {
        if ($claim->status !== Claim::STATUS_RELEASE_PENDING) {
            throw ValidationException::withMessages([
                'status' => ['A release token can only be regenerated for a claim awaiting release.'],
            ]);
        }

        $qr = $claim->qrRelease;

        if (!$qr) {
            throw ValidationException::withMessages([
                'status' => ['No release code exists for this claim yet.'],
            ]);
        }

        return DB::transaction(function () use ($claim, $officer, $qr) {
            $rawToken = QrRelease::generateRawToken();

            $qr->update([
                'token_hash' => QrRelease::hashToken($rawToken),
                'status' => QrRelease::STATUS_PENDING,
                'expires_at' => now()->addHours(72),
                'generated_by' => $officer->id,
                'scanned_by' => null,
                'scanned_at' => null,
            ]);

            $this->audit->log('qr.regenerated', $qr, "Release token regenerated for claim #{$claim->id} (previous token lost/unused).");

            return ['qr_release' => $qr->fresh(), 'raw_token' => $rawToken, 'public_code' => $qr->public_code];
        });
    }

    /**
     * Server-side authoritative release. The QR/token alone is never
     * sufficient — this checks token validity, expiry, prior use,
     * claim status, item status, and requires an authenticated officer.
     */
    public function scanAndRelease(string $publicCode, string $rawToken, User $officer): QrRelease
    {
        $qr = QrRelease::where('public_code', $publicCode)->first();

        if (!$qr) {
            throw ValidationException::withMessages(['qr' => ['Unrecognized release code.']]);
        }

        if (!$qr->verifyToken($rawToken)) {
            throw ValidationException::withMessages(['qr' => ['Invalid release token.']]);
        }

        if ($qr->status === QrRelease::STATUS_USED) {
            throw ValidationException::withMessages(['qr' => ['This release code has already been used.']]);
        }

        if ($qr->status === QrRelease::STATUS_REVOKED) {
            throw ValidationException::withMessages(['qr' => ['This release code has been revoked.']]);
        }

        if ($qr->expires_at->isPast()) {
            $qr->update(['status' => QrRelease::STATUS_EXPIRED]);
            throw ValidationException::withMessages(['qr' => ['This release code has expired.']]);
        }

        $claim = $qr->claim;

        if ($claim->status !== Claim::STATUS_RELEASE_PENDING) {
            throw ValidationException::withMessages(['qr' => ['Claim is not in a releasable state.']]);
        }

        return DB::transaction(function () use ($qr, $claim, $officer) {
            $qr->update([
                'status' => QrRelease::STATUS_USED,
                'scanned_by' => $officer->id,
                'scanned_at' => now(),
            ]);

            InventoryMovement::create([
                'found_item_id' => $claim->found_item_id,
                'storage_location_id' => $claim->foundItem->storage_location_id,
                'moved_by' => $officer->id,
                'action' => InventoryMovement::ACTION_RELEASED,
                'notes' => "Released to claimant #{$claim->claimant_id} via QR {$qr->public_code}.",
            ]);

            $this->claims->transition($claim, Claim::STATUS_RELEASED, $officer, 'Item physically released to claimant.');

            if ($claim->lostItem) {
                $claim->lostItem->update(['status' => \App\Models\LostItem::STATUS_CLOSED]);
            }

            $this->audit->log('qr.scanned', $qr, "Release QR {$qr->public_code} scanned and item released by officer #{$officer->id}.");
            $this->audit->log('item.released', $claim->foundItem, "Found item #{$claim->found_item_id} released. Case closed.");

            return $qr->fresh();
        });
    }

    public function revoke(QrRelease $qr, User $officer, ?string $reason = null): QrRelease
    {
        $qr->update(['status' => QrRelease::STATUS_REVOKED]);
        $this->audit->log('qr.revoked', $qr, "Release QR {$qr->public_code} revoked." . ($reason ? " Reason: {$reason}" : ''), null, null, $officer);

        return $qr->fresh();
    }
}