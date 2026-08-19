<?php

namespace App\Http\Controllers;

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
}
