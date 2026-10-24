<?php

namespace App\Http\Controllers;

use App\Support\PrivateMedia;
use App\Models\LostItem;
use App\Services\Audit\AuditLogService;
use App\Services\Matching\ItemMatchingService;
use App\Notifications\SclfNotification;
use Illuminate\Http\Request;

class LostItemController extends Controller
{
    public function __construct(
        protected ItemMatchingService $matcher,
        protected AuditLogService $audit,
    ) {
    }

    public function index(Request $request)
    {
        $viewer = $request->user();
        // Review-queue filters (?approval=) are for handlers only. Everyone else
        // gets approved reports plus their own, enforced here on the server.
        $isHandler = $viewer->hasAnyRole(\App\Models\User::LOST_FOUND_HANDLER_ROLES);

        $lostItems = LostItem::with('user:id,name')
            ->visibleTo($viewer)
            ->when($request->boolean('mine'), fn ($q) => $q->where('user_id', $viewer->id))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            // Review queue for security / admin / staff: ?approval=pending | approved
            ->when($isHandler && $request->approval === 'pending', fn ($q) => $q->whereNull('approved_at'))
            ->when($isHandler && $request->approval === 'approved', fn ($q) => $q->whereNotNull('approved_at'))
            ->when($request->q, fn ($q) => $q->where('item_name', 'like', \App\Support\Like::contains($request->q)))
            ->latest()
            ->paginate(10)
            ->through(fn ($item) => [
                'id' => $item->id,
                'item_name' => $item->item_name,
                'category' => $item->category,
                'status' => $item->status,
                'date_lost' => $item->date_lost,
                'reporter' => $item->user->name ?? 'Deactivated account',
                'description' => $item->description,
                'brand' => $item->brand,
                'color' => $item->color,
                'location_lost' => $item->location_lost,
                'approved_at' => $item->approved_at,
            ]);

        return response()->json($lostItems);
    }

    public function store(Request $request)
    {
        $this->authorize('create', LostItem::class);

        $validated = $request->validate([
            'item_name' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'nullable|string|max:100',
            'brand' => 'nullable|string|max:100',
            'color' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'unique_characteristics' => 'nullable|string|max:500',
            'details' => 'nullable|array|max:12',
            'details.*' => 'nullable|string|max:80',
            'location_lost' => 'nullable|string|max:255',
            'date_lost' => 'nullable|date',
            'time_lost' => 'nullable',
            'campus_id' => 'nullable|exists:campuses,id',
            'contact_info' => 'nullable|string|max:255',
            'image' => 'nullable|image|max:2048',
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('lost-items', PrivateMedia::DISK);
        }

        $lostItem = LostItem::create([
            'user_id' => auth()->id(),
            'campus_id' => $validated['campus_id'] ?? null,
            'item_name' => $validated['item_name'],
            'description' => $validated['description'],
            'category' => $validated['category'] ?? null,
            'brand' => $validated['brand'] ?? null,
            'color' => $validated['color'] ?? null,
            'model' => $validated['model'] ?? null,
            'unique_characteristics' => $validated['unique_characteristics'] ?? null,
            'details' => array_filter($validated['details'] ?? [], fn ($v) => is_string($v) && trim($v) !== '') ?: null,
            'location_lost' => $validated['location_lost'] ?? null,
            'date_lost' => $validated['date_lost'] ?? null,
            'time_lost' => $validated['time_lost'] ?? null,
            'contact_info' => $validated['contact_info'] ?? null,
            'image_path' => $imagePath,
        ]);

        $this->audit->log('lost_item.created', $lostItem, "Lost item #{$lostItem->id} reported.");

        $matches = $this->matcher->runForLostItem($lostItem);

        // Tell the lost & found handlers (security / admin / staff) there is
        // a new report, and — if the engine found real candidates — that
        // there is a match to review. Failure to notify must never lose
        // the report itself.
        try {
            $handlers = app(\App\Services\Notifications\LostFoundHandlerNotifier::class);
            $handlers->lostReported($lostItem);
            $handlers->matchesFound($matches);
        } catch (\Throwable $e) {
            report($e);
        }

        if (count($matches) > 0) {
            $lostItem->update(['status' => LostItem::STATUS_MATCHED]);

            $lostItem->user?->notify(new SclfNotification(
                SclfNotification::TYPE_POTENTIAL_MATCH,
                'Potential match found',
                'We found ' . count($matches) . ' possible match(es) for your lost item.',
                LostItem::class,
                $lostItem->id,
            ));
        }

        return response()->json([
            'success' => true,
            'message' => 'Lost item report submitted.',
            'data' => $lostItem,
            'matches_found' => count($matches),
        ], 201);
    }

    /**
     * Security / admin / staff approve a lost report. Returns immediately;
     * the email blast to students + instructors runs on the queue.
     */
    public function approve(Request $request, LostItem $lostItem)
    {
        $data = $request->validate(['note' => 'nullable|string|max:500']);

        // Atomic: a double-click or two approvers can never trigger two broadcasts.
        $claimed = LostItem::whereKey($lostItem->id)->whereNull('approved_at')->update([
            'approved_at' => now(),
            'approved_by' => $request->user()->id,
            'approval_note' => $data['note'] ?? null,
        ]);

        if (! $claimed) {
            return response()->json(['success' => true, 'already_approved' => true, 'message' => 'Already approved.']);
        }

        $this->audit->log('lost_item.approved', $lostItem, "Lost item #{$lostItem->id} approved.");

        // Emails to all users are controlled by SCLF_BROADCAST_LOST_ITEM_EMAILS.
        // When off, the report is still approved; nobody is emailed.
        $emailsOn = (bool) config('sclf.broadcast_lost_item_emails');

        if ($emailsOn) {
            // Runs right after this response is sent, in the same process: no queue worker needed.
            \App\Jobs\BroadcastLostItemJob::dispatchAfterResponse($lostItem->id, $request->user()->id);
        }

        return response()->json([
            'success' => true,
            'emails_enabled' => $emailsOn,
            'message' => $emailsOn
                ? 'Approved. Emails are being sent to everyone now.'
                : 'Approved. Email broadcast is turned off.',
        ]);
    }

    public function show(LostItem $lostItem)
    {
        $this->authorize('view', $lostItem);

        $lostItem->load('user:id,name');

        return response()->json([
            'id' => $lostItem->id,
            'item_name' => $lostItem->item_name,
            'description' => $lostItem->description,
            'category' => $lostItem->category,
            'brand' => $lostItem->brand,
            'color' => $lostItem->color,
            'model' => $lostItem->model,
            'location_lost' => $lostItem->location_lost,
            'date_lost' => $lostItem->date_lost,
            'status' => $lostItem->status,
            'image_url' => $lostItem->image_url,
            'reporter' => $lostItem->user->name ?? 'Deactivated account',
            'reporter_id' => $lostItem->user_id,
        ]);
    }

    public function destroy(LostItem $lostItem)
    {
        $this->authorize('delete', $lostItem);

        $lostItem->delete(); // soft delete
        app(\App\Services\Matching\MatchReconciler::class)->retireForLostItem($lostItem);

        $this->audit->log('lost_item.archived', $lostItem, "Lost item #{$lostItem->id} archived.");

        return response()->json(['success' => true, 'message' => 'Report archived.']);
    }
}