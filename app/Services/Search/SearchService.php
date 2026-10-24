<?php

namespace App\Services\Search;

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

    // Mirrors ROLE_META in resources/js/Pages/admin/AdminUsers.jsx — kept
    // as plain labels (not a shared source) since this is the only other
    // place in the backend that renders a role as prose.
    private const ROLE_LABELS = [
        'student' => 'Student',
        'instructor' => 'Instructor',
        'security_officer' => 'Security Officer',
        'staff' => 'Staff',
        'admin' => 'Admin',
    ];

    public function search(User $viewer, string $q, int $limit = self::PER_CATEGORY_LIMIT): array
    {
        $isStaff = $viewer->hasAnyRole(['security_officer', 'admin', 'staff']);
        $isAdmin = $viewer->hasAdminAccess();

        $results = [
            'found_items' => $this->searchFoundItems($viewer, $q, $isStaff, $limit),
            'lost_items' => $this->searchLostItems($viewer, $q, $limit),
            'claims' => $this->searchClaims($viewer, $q, $isStaff, $limit),
            'security_incidents' => $this->searchIncidents($viewer, $q, $isStaff, $isAdmin, $limit),
            'service_requests' => $this->searchServiceRequests($viewer, $q, $isStaff, $isAdmin, $limit),
        ];

        // The visitor log and the people directory are staff-only
        // surfaces (see VisitorController, and below) — a
        // student searching shouldn't even see these categories appear,
        // empty or not, the way an empty-but-present section would hint
        // at a page they can't actually open. People search in particular
        // is the security boundary: it's how an officer verifies someone's
        // ID number (student, instructor, security, or admin — whichever
        // prefix they typed), and a non-staff account has no legitimate
        // reason to look up another person's record that way.
        if ($isStaff) {
            $results['visitors'] = $this->searchVisitors($viewer, $q, $isAdmin, $limit);
            $results['users'] = $this->searchUsers($viewer, $q, $isAdmin, $limit);
        }

        return $results;
    }

    /**
     * Suggestive search — what to offer *before* (and while) someone types.
     *
     * No query: a short "suggested for you" list built from what that
     * person is most likely hunting for. A student/instructor sees their
     * own recent lost reports and claims first (the thing they're usually
     * here to check on), then what was recently found. Staff see recent
     * found/lost reports and recent visitors. Every source reuses the same
     * visibility rule as search() above, so a suggestion can never reveal a
     * name the person couldn't already find by searching for it.
     *
     * With a query: type-ahead completions drawn from the same tables
     * (item names + categories, and for staff also visitor/people names
     * and IDs), prefix matches ranked ahead of mid-word matches.
     *
     * Each suggestion is {label, query, hint}: `query` is what gets typed
     * into the box when it's picked, `hint` is the small grey caption.
     */
    public function suggest(User $viewer, string $q = '', int $limit = 6): array
    {
        $isStaff = $viewer->hasAnyRole(['security_officer', 'admin', 'staff']);
        $isAdmin = $viewer->hasAdminAccess();
        $q = trim($q);

        $items = $q === ''
            ? $this->defaultSuggestions($viewer, $isStaff, $isAdmin)
            : $this->completions($viewer, $q, $isStaff, $isAdmin);

        // Same label twice (e.g. a lost report and a found item both called
        // "Black umbrella") is one suggestion, first source wins.
        $seen = [];
        $unique = [];
        foreach ($items as $item) {
            $key = mb_strtolower($item['query']);
            if ($key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $unique[] = $item;
        }

        return array_slice($unique, 0, $limit);
    }

    private function defaultSuggestions(User $viewer, bool $isStaff, bool $isAdmin): array
    {
        $out = [];

        if (!$isStaff) {
            foreach (LostItem::query()->where('user_id', $viewer->id)->latest()->limit(3)->pluck('item_name') as $name) {
                $out[] = ['label' => $name, 'query' => $name, 'hint' => 'Your lost report'];
            }

            $claims = Claim::query()
                ->with('foundItem:id,item_name')
                ->where('claimant_id', $viewer->id)
                ->latest()
                ->limit(2)
                ->get();
            foreach ($claims as $claim) {
                if ($claim->foundItem?->item_name) {
                    $out[] = ['label' => $claim->foundItem->item_name, 'query' => $claim->foundItem->item_name, 'hint' => 'Your claim'];
                }
            }
        }

        foreach ($this->visibleFoundItems($isStaff)->latest()->limit(4)->pluck('item_name') as $name) {
            $out[] = ['label' => $name, 'query' => $name, 'hint' => 'Recently found'];
        }

        if ($isStaff) {
            foreach (LostItem::query()->latest()->limit(3)->pluck('item_name') as $name) {
                $out[] = ['label' => $name, 'query' => $name, 'hint' => 'Recently reported lost'];
            }

            $visitors = Visitor::query()
                ->when($viewer->campus_id && !$isAdmin, fn ($query) => $query->where('campus_id', $viewer->campus_id))
                ->latest('checked_in_at')
                ->limit(2)
                ->pluck('full_name');
            foreach ($visitors as $name) {
                $out[] = ['label' => $name, 'query' => $name, 'hint' => 'Recent visitor'];
            }
        }

        return $out;
    }

    private function completions(User $viewer, string $q, bool $isStaff, bool $isAdmin): array
    {
        $like = \App\Support\Like::contains($q);
        $out = [];

        foreach ($this->visibleFoundItems($isStaff)->where('item_name', 'like', $like)->latest()->limit(12)->pluck('item_name') as $name) {
            $out[] = ['label' => $name, 'query' => $name, 'hint' => 'Found item'];
        }
        foreach (LostItem::query()->visibleTo($viewer)->where('item_name', 'like', $like)->latest()->limit(12)->pluck('item_name') as $name) {
            $out[] = ['label' => $name, 'query' => $name, 'hint' => 'Lost item'];
        }

        $categories = $this->visibleFoundItems($isStaff)->where('category', 'like', $like)->distinct()->limit(4)->pluck('category');
        foreach ($categories as $category) {
            if ($category) {
                $out[] = ['label' => ucfirst($category), 'query' => $category, 'hint' => 'Category'];
            }
        }

        if ($isStaff) {
            $visitors = Visitor::query()
                ->when($viewer->campus_id && !$isAdmin, fn ($query) => $query->where('campus_id', $viewer->campus_id))
                ->where('full_name', 'like', $like)
                ->latest('checked_in_at')
                ->limit(6)
                ->pluck('full_name');
            foreach ($visitors as $name) {
                $out[] = ['label' => $name, 'query' => $name, 'hint' => 'Visitor'];
            }

            $people = User::query()
                ->where('is_active', true)
                ->when($viewer->campus_id && !$isAdmin, fn ($query) => $query->where('campus_id', $viewer->campus_id))
                ->where(function ($sub) use ($like) {
                    $sub->where('name', 'like', $like)
                        ->orWhere('student_id', 'like', $like)
                        ->orWhere('staff_id', 'like', $like);
                })
                ->select('id', 'name', 'student_id', 'staff_id')
                ->limit(6)
                ->get();
            foreach ($people as $person) {
                $out[] = ['label' => $person->name, 'query' => $person->name, 'hint' => $person->display_id ?: 'Person'];
            }
        }

        // Prefix matches first ("bl" -> "Blue bottle" before "Noble pen"),
        // then shorter labels, so the likeliest completion leads.
        $lower = mb_strtolower($q);
        usort($out, function ($a, $b) use ($lower) {
            $pa = mb_stripos($a['label'], $lower);
            $pb = mb_stripos($b['label'], $lower);
            $pa = $pa === false ? PHP_INT_MAX : ($pa === 0 ? 0 : 1);
            $pb = $pb === false ? PHP_INT_MAX : ($pb === 0 ? 0 : 1);

            return [$pa, mb_strlen($a['label'])] <=> [$pb, mb_strlen($b['label'])];
        });

        return $out;
    }

    /** Found items this viewer may see — counter intake rows are staff-only. */
    private function visibleFoundItems(bool $isStaff)
    {
        return FoundItem::query()->when(!$isStaff, fn ($query) => $query->where(function ($sub) {
            $sub->whereNull('intake_channel')
                ->orWhere('intake_channel', '!=', FoundItem::CHANNEL_COUNTER_INTAKE);
        }));
    }

    private function searchFoundItems(User $viewer, string $q, bool $isStaff, int $limit): array
    {
        return FoundItem::query()
            ->when(!$isStaff, fn ($query) => $query->where(function ($sub) {
                $sub->whereNull('intake_channel')
                    ->orWhere('intake_channel', '!=', FoundItem::CHANNEL_COUNTER_INTAKE);
            }))
            ->where(function ($sub) use ($q) {
                $sub->where('item_name', 'like', \App\Support\Like::contains($q))->orWhere('description', 'like', \App\Support\Like::contains($q));
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

    private function searchLostItems(User $viewer, string $q, int $limit): array
    {
        // Same rule as LostItemController::index(): approved reports plus
        // your own; handlers see everything (LostItem::scopeVisibleTo).
        return LostItem::query()
            ->visibleTo($viewer)
            ->where('item_name', 'like', \App\Support\Like::contains($q))
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
            ->whereHas('foundItem', fn ($sub) => $sub->where('item_name', 'like', \App\Support\Like::contains($q)))
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
                $sub->where('title', 'like', \App\Support\Like::contains($q))->orWhere('description', 'like', \App\Support\Like::contains($q));
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
                $sub->where('title', 'like', \App\Support\Like::contains($q))->orWhere('description', 'like', \App\Support\Like::contains($q));
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

    private function searchVisitors(User $viewer, string $q, bool $isAdmin, int $limit): array
    {
        return Visitor::query()
            ->when(
                $viewer->campus_id && !$isAdmin,
                fn ($query) => $query->where('campus_id', $viewer->campus_id)
            )
            ->where(function ($w) use ($q) {
                $w->where('full_name', 'like', \App\Support\Like::contains($q))
                    ->orWhere('badge_number', 'like', \App\Support\Like::contains($q))
                    ->orWhere('student_name', 'like', \App\Support\Like::contains($q))
                    ->orWhere('student_number', 'like', \App\Support\Like::contains($q));
            })
            ->latest('checked_in_at')
            ->limit($limit)
            ->get()
            ->map(fn ($visitor) => [
                'id' => $visitor->id,
                'title' => $visitor->full_name,
                'subtitle' => trim(str_replace('_', ' ', $visitor->purpose) . ' · ' . str_replace('_', ' ', $visitor->status) . ($visitor->badge_number ? " · Badge {$visitor->badge_number}" : '')),
                'url' => '/app/security/visitors',
            ])
            ->all();
    }

    /**
     * People directory — the ID-based lookup (student ID, instructor/
     * security/admin staff ID, or name). Staff-only (see the guard in
     * search() above), and further scoped the same way Visitors
     * already are: a security officer only finds people on their own
     * campus, an admin finds anyone anywhere. This is deliberately the
     * one category that can name-match *and* ID-match in the same query
     * — every other category searches free-text fields, but "search by
     * ID" was the actual feature being asked for here.
     */
    private function searchUsers(User $viewer, string $q, bool $isAdmin, int $limit): array
    {
        return User::query()
            ->where('is_active', true)
            ->when(
                $viewer->campus_id && !$isAdmin,
                fn ($query) => $query->where('campus_id', $viewer->campus_id)
            )
            ->where(function ($sub) use ($q) {
                $sub->where('name', 'like', \App\Support\Like::contains($q))
                    ->orWhere('student_id', 'like', \App\Support\Like::contains($q))
                    ->orWhere('staff_id', 'like', \App\Support\Like::contains($q));
            })
            ->with('campus:id,name')
            ->select('id', 'name', 'student_id', 'staff_id', 'profile_picture', 'campus_id')
            ->limit($limit)
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'title' => $user->name,
                'subtitle' => trim(
                    (self::ROLE_LABELS[$user->getRoleNames()->first()] ?? 'User')
                    . ($user->display_id ? " · {$user->display_id}" : '')
                    . ($user->campus?->name ? " · {$user->campus->name}" : '')
                ),
                // Only admin has a user-detail page to send them to
                // (see routes/api.php — /admin/users/{user} sits behind
                // role:admin). A security officer gets the same result
                // row for identity verification, just without a link
                // into a page their role can't open.
                'url' => $isAdmin ? "/app/admin/users/{$user->id}" : null,
                'avatar' => $user->profile_picture_url,
            ])
            ->all();
    }
}
