<?php

namespace App\Services\Search;

use App\Models\Asset;
use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\LostItem;
use App\Models\SecurityIncident;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\Visitor;

/**
 * One box, everything you're allowed to see. Each category below re-runs
 * the exact same visibility rule its own controller's index() already
 * enforces (staff-vs-own scoping, campus scoping, the counter-intake
 * exclusion on found items, etc.) — this file doesn't invent new access
 * rules, it just asks the same question ("would this row show up on
 * that person's own list page?") across every searchable table at once.
 *
 * Deliberately capped at a handful of rows per category rather than
 * paginated — this is a "jump to the thing I'm thinking of" box, not a
 * replacement for each section's own filtered list page. Someone who
 * needs to page through results already has Found Items / Claims /
 * Incidents etc. for that.
 */
class SearchService
{
    private const PER_CATEGORY_LIMIT = 5;

    public function search(User $viewer, string $q, int $limit = self::PER_CATEGORY_LIMIT): array
    {
        $isStaff = $viewer->hasAnyRole(['security_officer', 'admin']);
        $isAdmin = $viewer->hasRole('admin');

        $results = [
            'found_items' => $this->searchFoundItems($viewer, $q, $isStaff, $limit),
            'lost_items' => $this->searchLostItems($q, $limit),
            'claims' => $this->searchClaims($viewer, $q, $isStaff, $limit),
            'security_incidents' => $this->searchIncidents($viewer, $q, $isStaff, $isAdmin, $limit),
            'service_requests' => $this->searchServiceRequests($viewer, $q, $isStaff, $isAdmin, $limit),
        ];

        // Assets and the visitor log are staff-only surfaces (see
        // AssetController/VisitorController) — a student searching
        // shouldn't even see these categories appear, empty or not,
        // the way an empty-but-present "Assets" section would hint at
        // a page they can't actually open.
        if ($isStaff) {
            $results['assets'] = $this->searchAssets($viewer, $q, $isAdmin, $limit);
            $results['visitors'] = $this->searchVisitors($viewer, $q, $isAdmin, $limit);
        }

        return $results;
    }

    private function searchFoundItems(User $viewer, string $q, bool $isStaff, int $limit): array
    {
        return FoundItem::query()
            ->when(!$isStaff, fn ($query) => $query->where(function ($sub) {
                $sub->whereNull('intake_channel')
                    ->orWhere('intake_channel', '!=', FoundItem::CHANNEL_COUNTER_INTAKE);
            }))
            ->where(function ($sub) use ($q) {
                $sub->where('item_name', 'like', "%{$q}%")->orWhere('description', 'like', "%{$q}%");
            })
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'title' => $item->item_name,
                'subtitle' => trim(($item->category ? ucfirst($item->category) . ' · ' : '') . $item->status),
                'url' => "/app/found-items/{$item->id}",
            ])
            ->all();
    }

    private function searchLostItems(string $q, int $limit): array
    {
        // LostItemController::index() doesn't restrict visibility to the
        // owner by default (only ?mine=1 does), so search mirrors that —
        // any authenticated user can already browse the full lost-items
        // list.
        return LostItem::query()
            ->where('item_name', 'like', "%{$q}%")
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'title' => $item->item_name,
                'subtitle' => trim(($item->category ? ucfirst($item->category) . ' · ' : '') . $item->status),
                'url' => "/app/lost-items/{$item->id}/matches",
            ])
            ->all();
    }

    private function searchClaims(User $viewer, string $q, bool $isStaff, int $limit): array
    {
        // Claims don't carry their own free-text field — search matches
        // against the related found item's name instead, same join a
        // person would mentally make ("that claim on the blue backpack").
        return Claim::query()
            ->with('foundItem:id,item_name')
            ->when(!$isStaff, fn ($query) => $query->where('claimant_id', $viewer->id))
            ->whereHas('foundItem', fn ($sub) => $sub->where('item_name', 'like', "%{$q}%"))
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($claim) => [
                'id' => $claim->id,
                'title' => $claim->foundItem->item_name ?? "Claim #{$claim->id}",
                'subtitle' => 'Claim · ' . str_replace('_', ' ', $claim->status),
                'url' => "/app/claims/{$claim->id}",
            ])
            ->all();
    }

    private function searchIncidents(User $viewer, string $q, bool $isStaff, bool $isAdmin, int $limit): array
    {
        return SecurityIncident::query()
            ->when(!$isStaff, fn ($query) => $query->where('reported_by', $viewer->id))
            ->when(
                $isStaff && $viewer->campus_id && !$isAdmin,
                fn ($query) => $query->where('campus_id', $viewer->campus_id)
            )
            ->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")->orWhere('description', 'like', "%{$q}%");
            })
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($incident) => [
                'id' => $incident->id,
                'title' => $incident->title,
                'subtitle' => trim(str_replace('_', ' ', $incident->category) . ' · ' . str_replace('_', ' ', $incident->status)),
                'url' => "/app/incidents/{$incident->id}",
            ])
            ->all();
    }

    private function searchServiceRequests(User $viewer, string $q, bool $isStaff, bool $isAdmin, int $limit): array
    {
        return ServiceRequest::query()
            ->when(!$isStaff, fn ($query) => $query->where('requested_by', $viewer->id))
            ->when(
                $isStaff && $viewer->campus_id && !$isAdmin,
                fn ($query) => $query->where('campus_id', $viewer->campus_id)
            )
            ->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")->orWhere('description', 'like', "%{$q}%");
            })
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($request) => [
                'id' => $request->id,
                'title' => $request->title,
                'subtitle' => trim(str_replace('_', ' ', $request->category) . ' · ' . str_replace('_', ' ', $request->status)),
                'url' => "/app/service-requests/{$request->id}",
            ])
            ->all();
    }

    private function searchAssets(User $viewer, string $q, bool $isAdmin, int $limit): array
    {
        return Asset::query()
            ->when(
                $viewer->campus_id && !$isAdmin,
                fn ($query) => $query->where('campus_id', $viewer->campus_id)
            )
            ->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('asset_tag', 'like', "%{$q}%")
                    ->orWhere('serial_number', 'like', "%{$q}%");
            })
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($asset) => [
                'id' => $asset->id,
                'title' => "{$asset->name} ({$asset->asset_tag})",
                'subtitle' => trim(ucfirst($asset->category) . ' · ' . str_replace('_', ' ', $asset->status)),
                'url' => "/app/security/assets/{$asset->id}",
            ])
            ->all();
    }

    private function searchVisitors(User $viewer, string $q, bool $isAdmin, int $limit): array
    {
        return Visitor::query()
            ->when(
                $viewer->campus_id && !$isAdmin,
                fn ($query) => $query->where('campus_id', $viewer->campus_id)
            )
            ->where('full_name', 'like', "%{$q}%")
            ->latest('checked_in_at')
            ->limit($limit)
            ->get()
            ->map(fn ($visitor) => [
                'id' => $visitor->id,
                'title' => $visitor->full_name,
                'subtitle' => trim(str_replace('_', ' ', $visitor->purpose) . ' · ' . str_replace('_', ' ', $visitor->status)),
                'url' => '/app/security/visitors',
            ])
            ->all();
    }
}
