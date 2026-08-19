<?php

namespace App\Http\Controllers;

use App\Models\FoundItem;
use App\Services\Audit\AuditLogService;
use App\Services\Inventory\DispositionService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class DispositionController extends Controller
{
    public function __construct(
        protected DispositionService $disposition,
        protected AuditLogService $audit,
    ) {
    }

    /**
     * The Unclaimed Items page: currently-flagged items plus a count of
     * items that are eligible but haven't been swept yet, so an officer
     * knows whether it's worth running the sweep before working the list.
     * Campus-scoped like the Counter Dashboard — admins see everything.
     */
    public function index(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $viewer = $request->user();

        $items = FoundItem::query()
            ->where('status', FoundItem::STATUS_UNCLAIMED)
            ->with(['finder:id,name', 'storageLocation:id,code,campus_id'])
            ->when(
                $viewer->campus_id && !$viewer->hasRole('admin'),
                fn ($q) => $q->where('campus_id', $viewer->campus_id)
            )
            ->orderBy('unclaimed_at')
            ->paginate(20);

        $eligibleCount = $this->disposition->eligibleForUnclaimedQuery()
            ->when(
                $viewer->campus_id && !$viewer->hasRole('admin'),
                fn ($q) => $q->where('campus_id', $viewer->campus_id)
            )
            ->count();

        return response()->json([
            'data' => $items,
            'eligible_count' => $eligibleCount,
        ]);
    }

    /**
     * Manually run the retention sweep on demand, rather than waiting for
     * the nightly schedule (see routes/console.php) — useful right after
     * lowering the retention window, or just to check the page immediately
     * instead of waiting until 2am.
     */
    public function sweep(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $count = $this->disposition->sweepUnclaimed($request->user());

        return response()->json([
            'success' => true,
            'message' => "Flagged {$count} item(s) as unclaimed.",
            'flagged_count' => $count,
        ]);
    }

    public function dispose(Request $request, FoundItem $foundItem)
    {
        $this->authorize('manageStorage', FoundItem::class);

        if (!$request->user()->canOperateInCampus($foundItem->campus_id)) {
            abort(403, 'That item belongs to a different campus than your account.');
        }

        $validated = $request->validate([
            'method' => 'required|string|in:' . implode(',', FoundItem::DISPOSITION_METHODS),
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $item = $this->disposition->dispose(
                $foundItem,
                $request->user(),
                $validated['method'],
                $validated['notes'] ?? null,
            );
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Item disposed of.', 'data' => $item]);
    }

    public function restore(Request $request, FoundItem $foundItem)
    {
        $this->authorize('manageStorage', FoundItem::class);

        if (!$request->user()->canOperateInCampus($foundItem->campus_id)) {
            abort(403, 'That item belongs to a different campus than your account.');
        }

        $validated = $request->validate([
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $item = $this->disposition->restore($foundItem, $request->user(), $validated['notes'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Item restored to storage.', 'data' => $item]);
    }
}
