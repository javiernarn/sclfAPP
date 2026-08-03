<?php

namespace App\Services\Claims;

use App\Models\Claim;
use App\Models\ClaimEvidence;
use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Audit\AuditLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ClaimService
{
    public function __construct(
        protected AuditLogService $audit,
        protected FraudDetectionService $fraud,
    ) {
    }

    public function submit(User $claimant, FoundItem $foundItem, array $data): Claim
    {
        return DB::transaction(function () use ($claimant, $foundItem, $data) {
            $itemMatch = null;
            $lostItemId = $data['lost_item_id'] ?? null;

            if ($lostItemId) {
                $lostItem = LostItem::where('id', $lostItemId)->where('user_id', $claimant->id)->firstOrFail();
                $itemMatch = ItemMatch::where('lost_item_id', $lostItem->id)
                    ->where('found_item_id', $foundItem->id)
                    ->first();
            }

            $claim = Claim::create([
                'found_item_id' => $foundItem->id,
                'lost_item_id' => $lostItemId,
                'item_match_id' => $itemMatch?->id,
                'claimant_id' => $claimant->id,
                'status' => Claim::STATUS_PENDING,
            ]);

            [$riskScore, $riskFlags] = $this->fraud->assess($claimant, $claim->id);
            $claim->update(['risk_score' => $riskScore, 'risk_flags' => $riskFlags]);

            if ($itemMatch) {
                $itemMatch->update(['status' => ItemMatch::STATUS_CLAIMED]);
            }

            $this->audit->log('claim.submitted', $claim, "Claim #{$claim->id} submitted for found item #{$foundItem->id}.");

            $this->notifySecurityOfficers($claim);

            return $claim->fresh();
        });
    }

    public function addEvidence(Claim $claim, User $submitter, array $data): ClaimEvidence
    {
        $evidence = ClaimEvidence::create([
            'claim_id' => $claim->id,
            'submitted_by' => $submitter->id,
            'type' => $data['type'],
            'content' => $data['content'] ?? null,
            'file_path' => $data['file_path'] ?? null,
        ]);

        $this->audit->log('claim.evidence_uploaded', $claim, "Evidence ({$data['type']}) added to claim #{$claim->id}.");

        // Evidence submitted while under review re-opens it for another look
        // if it had been sent back for more evidence.
        if ($claim->status === Claim::STATUS_MORE_EVIDENCE_REQUIRED) {
            $this->transition($claim, Claim::STATUS_UNDER_REVIEW, $submitter, 'Additional evidence submitted by claimant.');
        }

        return $evidence;
    }

    /**
     * Server-side status machine enforcement. Only valid transitions are allowed;
     * everything else throws a validation error rather than silently no-op'ing.
     */
    public function transition(Claim $claim, string $to, User $actor, ?string $notes = null): Claim
    {
        if (!Claim::canTransition($claim->status, $to)) {
            throw ValidationException::withMessages([
                'status' => ["Cannot transition claim from '{$claim->status}' to '{$to}'."],
            ]);
        }

        return DB::transaction(function () use ($claim, $to, $actor, $notes) {
            $before = ['status' => $claim->status];

            $claim->update([
                'status' => $to,
                'reviewed_by' => in_array($to, [
                    Claim::STATUS_UNDER_REVIEW,
                    Claim::STATUS_MORE_EVIDENCE_REQUIRED,
                    Claim::STATUS_APPROVED,
                    Claim::STATUS_REJECTED,
                ], true) ? $actor->id : $claim->reviewed_by,
                'review_notes' => $notes ?? $claim->review_notes,
                'reviewed_at' => in_array($to, [Claim::STATUS_APPROVED, Claim::STATUS_REJECTED], true) ? now() : $claim->reviewed_at,
            ]);

            $this->audit->log('claim.status_changed', $claim, "Claim #{$claim->id} moved to '{$to}'.", $before, ['status' => $to]);

            $this->syncFoundItemStatus($claim, $to);
            $this->notifyClaimant($claim, $to, $notes);

            return $claim->fresh();
        });
    }

    protected function syncFoundItemStatus(Claim $claim, string $newClaimStatus): void
    {
        $foundItem = $claim->foundItem;

        match ($newClaimStatus) {
            Claim::STATUS_APPROVED => $foundItem->update(['status' => FoundItem::STATUS_CLAIMED]),
            Claim::STATUS_RELEASE_PENDING => $foundItem->update(['status' => FoundItem::STATUS_RELEASE_PENDING]),
            Claim::STATUS_RELEASED => $foundItem->update(['status' => FoundItem::STATUS_RELEASED]),
            Claim::STATUS_REJECTED, Claim::STATUS_CANCELLED => $foundItem->status === FoundItem::STATUS_CLAIMED
                ? $foundItem->update(['status' => FoundItem::STATUS_STORED])
                : null,
            default => null,
        };
    }

    protected function notifySecurityOfficers(Claim $claim): void
    {
        $officers = User::role(['security_officer', 'admin'])->get();

        foreach ($officers as $officer) {
            $officer->notify(new SclfNotification(
                SclfNotification::TYPE_CLAIM_SUBMITTED,
                'New claim submitted',
                "A new claim was submitted for found item #{$claim->found_item_id}.",
                Claim::class,
                $claim->id,
            ));
        }
    }

    protected function notifyClaimant(Claim $claim, string $status, ?string $notes): void
    {
        $map = [
            Claim::STATUS_APPROVED => [SclfNotification::TYPE_CLAIM_APPROVED, 'Claim approved', 'Your claim has been approved. A release QR will be generated shortly.'],
            Claim::STATUS_REJECTED => [SclfNotification::TYPE_CLAIM_REJECTED, 'Claim rejected', 'Your claim was rejected.' . ($notes ? " Reason: {$notes}" : '')],
            Claim::STATUS_MORE_EVIDENCE_REQUIRED => [SclfNotification::TYPE_MORE_EVIDENCE_REQUIRED, 'More evidence required', 'Please submit additional evidence for your claim.' . ($notes ? " Note: {$notes}" : '')],
            Claim::STATUS_RELEASED => [SclfNotification::TYPE_ITEM_RELEASED, 'Item released', 'Your item has been released. Case closed.'],
        ];

        if (!isset($map[$status])) {
            return;
        }

        [$type, $title, $message] = $map[$status];

        $claim->claimant?->notify(new SclfNotification($type, $title, $message, Claim::class, $claim->id));
    }
}
