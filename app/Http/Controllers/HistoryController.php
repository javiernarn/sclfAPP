<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Claim;
use App\Models\FoundItem;
use Illuminate\Http\Request;

/**
 * Read-only release history for the Security office's "History" page.
 * Two separate views on purpose, mirroring the two different release
 * flows already in the codebase:
 *
 *  - counterReleases()  -> CounterIntakeService::checkIn() + ItemReleaseService,
 *                          scoped to intake_channel = counter_intake.
 *  - releases()         -> the full report -> verify -> match -> claim ->
 *                          evidence -> review -> approve -> release pipeline
 *                          (ClaimService + ItemReleaseService), any channel.
 *
 * Nothing here mutates state — it only reads FoundItem/Claim/QrRelease/
 * AuditLog rows that the existing services already wrote.
 */
class HistoryController extends Controller
{
    /**
     * Counter release history: one row per item checked in at the Counter,
     * showing both halves of that flow — who checked it in, and (once
     * picked up) who released it and how.
     */
    public function counterReleases(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $request->validate([
            'q' => 'nullable|string|max:150',
            'status' => 'nullable|in:pending,released',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
        ]);

        $items = FoundItem::query()
            ->where('intake_channel', FoundItem::CHANNEL_COUNTER_INTAKE)
            ->with([
                'securityOfficer:id,name',
                'storageLocation:id,code,label',
                'claims' => fn ($q) => $q->orderByDesc('id')->with([
                    'claimant:id,name,student_id',
                    'qrRelease.generator:id,name',
                    'qrRelease.scanner:id,name',
                ]),
            ])
            ->when($request->q, function ($q) use ($request) {
                $term = $request->q;
                $q->where(function ($qq) use ($term) {
                    $qq->where('item_name', 'like', "%{$term}%")
                        ->orWhereHas('claims', fn ($c) => $c->whereHas(
                            'claimant',
                            fn ($cc) => $cc->where('name', 'like', "%{$term}%")
                                ->orWhere('student_id', 'like', "%{$term}%")
                        ));
                });
            })
            ->when($request->status === 'released', fn ($q) => $q->whereHas(
                'claims',
                fn ($c) => $c->where('status', Claim::STATUS_RELEASED)
            ))
            ->when($request->status === 'pending', fn ($q) => $q->whereDoesntHave(
                'claims',
                fn ($c) => $c->where('status', Claim::STATUS_RELEASED)
            ))
            ->when($request->date_from, fn ($q) => $q->whereDate('created_at', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('created_at', '<=', $request->date_to))
            ->latest('created_at')
            ->paginate(15)
            ->withQueryString();

        $claimIds = $items->getCollection()
            ->map(fn (FoundItem $item) => $item->claims->first()?->id)
            ->filter()
            ->values();

        $manualClaimIds = $this->manualReleaseClaimIds($claimIds);

        $items->getCollection()->transform(function (FoundItem $item) use ($manualClaimIds) {
            $claim = $item->claims->first();
            $qr = $claim?->qrRelease;

            return [
                'found_item_id' => $item->id,
                'item_name' => $item->item_name,
                'category' => $item->category,
                'qr_code' => $item->qr_code,
                'checked_in_at' => $item->created_at,
                'checked_in_by' => $item->securityOfficer?->name,
                'counter' => $item->storageLocation?->label ?: $item->storageLocation?->code,
                'owner' => $claim?->claimant,
                'claim_id' => $claim?->id,
                'claim_status' => $claim?->status,
                'public_code' => $qr?->public_code,
                'released_at' => $qr?->scanned_at,
                'released_by' => $qr?->scanner?->name,
                'release_method' => $this->releaseMethod($claim, $qr, $manualClaimIds),
            ];
        });

        return response()->json($items);
    }

    /**
     * Lost & Found release history: the release step of the full claim
     * pipeline, across every intake channel (pass `channel` to narrow it
     * to counter_intake or online_report). Complements counterReleases()
     * above, which only covers the Counter's own shortcut flow.
     */
    public function releases(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $request->validate([
            'q' => 'nullable|string|max:150',
            'channel' => 'nullable|in:counter_intake,online_report',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
        ]);

        $claims = Claim::query()
            ->where('status', Claim::STATUS_RELEASED)
            ->with([
                'foundItem:id,item_name,category,image_path,intake_channel,storage_location_id',
                'foundItem.storageLocation:id,code,label',
                'claimant:id,name,student_id',
                'reviewer:id,name',
                'qrRelease.generator:id,name',
                'qrRelease.scanner:id,name',
            ])
            ->when($request->channel, fn ($q) => $q->whereHas(
                'foundItem',
                fn ($f) => $f->where('intake_channel', $request->channel)
            ))
            ->when($request->q, function ($q) use ($request) {
                $term = $request->q;
                $q->where(function ($qq) use ($term) {
                    $qq->whereHas('foundItem', fn ($f) => $f->where('item_name', 'like', "%{$term}%"))
                        ->orWhereHas('claimant', fn ($c) => $c->where('name', 'like', "%{$term}%")
                            ->orWhere('student_id', 'like', "%{$term}%"));
                });
            })
            ->when($request->date_from, fn ($q) => $q->whereDate('updated_at', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('updated_at', '<=', $request->date_to))
            ->latest('updated_at')
            ->paginate(15)
            ->withQueryString();

        $manualClaimIds = $this->manualReleaseClaimIds($claims->getCollection()->pluck('id'));

        $claims->getCollection()->transform(function (Claim $claim) use ($manualClaimIds) {
            $qr = $claim->qrRelease;

            return [
                'claim_id' => $claim->id,
                'item' => $claim->foundItem ? [
                    'id' => $claim->foundItem->id,
                    'item_name' => $claim->foundItem->item_name,
                    'category' => $claim->foundItem->category,
                    'image_url' => $claim->foundItem->image_url,
                ] : null,
                'channel' => $claim->foundItem?->intake_channel,
                'storage_location' => $claim->foundItem?->storageLocation,
                'claimant' => $claim->claimant,
                'reviewed_by' => $claim->reviewer?->name,
                'reviewed_at' => $claim->reviewed_at,
                'public_code' => $qr?->public_code,
                'released_at' => $qr?->scanned_at ?? $claim->updated_at,
                'released_by' => $qr?->scanner?->name,
                'release_method' => $this->releaseMethod($claim, $qr, $manualClaimIds),
            ];
        });

        return response()->json($claims);
    }

    /**
     * A claim's qrRelease row alone can't tell a QR-scan release apart
     * from a manual one — ItemReleaseService::manualRelease() also marks
     * an existing qrRelease "used" with scanned_by set, exactly like
     * ::scanAndRelease() does. The audit trail is the only reliable
     * signal: manualRelease() always writes a 'claim.manual_release'
     * entry, scanAndRelease() never does.
     */
    private function manualReleaseClaimIds($claimIds): array
    {
        if ($claimIds->isEmpty()) {
            return [];
        }

        return AuditLog::where('entity_type', Claim::class)
            ->where('action', 'claim.manual_release')
            ->whereIn('entity_id', $claimIds)
            ->pluck('entity_id')
            ->all();
    }

    private function releaseMethod(?Claim $claim, $qr, array $manualClaimIds): ?string
    {
        if (!$claim || $claim->status !== Claim::STATUS_RELEASED) {
            return null;
        }

        if (in_array($claim->id, $manualClaimIds, true)) {
            return 'manual';
        }

        return $qr ? 'qr_scan' : 'unknown';
    }
}
