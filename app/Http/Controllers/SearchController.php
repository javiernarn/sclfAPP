<?php

namespace App\Http\Controllers;

use App\Models\RecentSearch;
use App\Services\Search\SearchService;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __construct(
        protected SearchService $search,
    ) {
    }

    /**
     * GET /api/search?q=... — any authenticated user. Under 2 characters
     * isn't worth running six queries for (mostly noise, and a single
     * character against `like '%a%'` is a real cost on the bigger
     * tables), so this just returns empty categories instead of erroring
     * — the frontend treats that the same as "nothing typed yet".
     */
    public function index(Request $request)
    {
        $q = trim((string) $request->string('q'));

        if (mb_strlen($q) < 2) {
            return response()->json(['data' => [], 'query' => $q]);
        }

        return response()->json([
            'data' => $this->search->search($request->user(), $q),
            'query' => $q,
        ]);
    }

    /**
     * GET /api/search/suggestions[?q=...] — any authenticated user.
     * Without q: the role-aware "suggested for you" list shown when the
     * search box opens. With q: type-ahead completions. Cheap on purpose
     * (a handful of capped pluck() queries), so unlike /search there's no
     * two-character floor — one letter is a legitimate prefix to complete.
     */
    public function suggestions(Request $request)
    {
        $q = mb_substr(trim((string) $request->string('q')), 0, 60);

        return response()->json([
            'data' => $this->search->suggest($request->user(), $q),
            'query' => $q,
        ]);
    }

    /** Most searches kept per account; the oldest are dropped past this. */
    private const RECENT_LIMIT = 20;

    private function recentPayload(Request $request): array
    {
        return RecentSearch::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('last_searched_at')
            ->orderByDesc('id')
            ->limit(self::RECENT_LIMIT)
            ->get(['id', 'term'])
            ->map(fn ($row) => ['id' => $row->id, 'term' => $row->term])
            ->all();
    }

    /** GET /api/search/recent — the signed-in person's own recent searches. */
    public function recent(Request $request)
    {
        return response()->json(['data' => $this->recentPayload($request)]);
    }

    /**
     * POST /api/search/recent {term} — remember a successful search. The
     * frontend only calls this for a term that led somewhere openable.
     * Same term again = move it to the top, not a duplicate row.
     */
    public function storeRecent(Request $request)
    {
        $term = trim((string) $request->input('term'));

        if (mb_strlen($term) < 2 || mb_strlen($term) > 60) {
            return response()->json(['message' => 'Search term must be 2 to 60 characters.'], 422);
        }

        $userId = $request->user()->id;

        RecentSearch::updateOrCreate(
            ['user_id' => $userId, 'term' => $term],
            ['last_searched_at' => now()]
        );

        // Keep only the newest RECENT_LIMIT rows for this account.
        $stale = RecentSearch::query()
            ->where('user_id', $userId)
            ->orderByDesc('last_searched_at')
            ->orderByDesc('id')
            ->skip(self::RECENT_LIMIT)
            ->take(PHP_INT_MAX)
            ->pluck('id');
        if ($stale->isNotEmpty()) {
            RecentSearch::whereIn('id', $stale)->delete();
        }

        return response()->json(['data' => $this->recentPayload($request)]);
    }

    /** DELETE /api/search/recent/{id} — the "x" on one entry. Own rows only. */
    public function destroyRecent(Request $request, int $id)
    {
        RecentSearch::query()
            ->where('user_id', $request->user()->id)
            ->where('id', $id)
            ->delete();

        return response()->json(['data' => $this->recentPayload($request)]);
    }

    /** DELETE /api/search/recent — "Clear all". Own rows only. */
    public function clearRecent(Request $request)
    {
        RecentSearch::query()->where('user_id', $request->user()->id)->delete();

        return response()->json(['data' => []]);
    }
}
