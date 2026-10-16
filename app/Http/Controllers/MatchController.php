<?php

namespace App\Http\Controllers;

use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Notifications\SclfNotification;
use App\Services\Audit\AuditLogService;
use App\Services\Matching\ItemMatchingService;
use App\Services\Matching\MatchLearner;
use App\Services\Matching\MatchReconciler;
use Illuminate\Http\Request;

class MatchController extends Controller
{
    public function __construct(
        protected AuditLogService $audit,
        protected ItemMatchingService $matcher,
        protected MatchReconciler $reconciler,
    ) {
    }

    /** Fields a person may type into a report that the live preview understands. */
    private const DRAFT_FIELDS = [
        'item_name', 'description', 'category', 'brand', 'color', 'model', 'unique_characteristics', 'details',
    ];

    /**
     * The handlers' match queue (Security Officer, Admin, Staff — see
     * User::LOST_FOUND_HANDLER_ROLES): every candidate pairing the engine
     * recorded, best score first, so someone is actually working them
     * instead of only the report owner ever seeing a match.
     *
     * ?status=pending|notified|claimed|dismissed|open (open = pending + notified,
     * the default) and ?q= to search either item's name.
     *
     * Counter check-ins are left out: those items already have a known,
     * confirmed owner (see CounterIntakeService) and are not up for matching.
     */
    public function index(Request $request)
    {
        $status = $request->query('status', 'open');
        $level = $request->query('level');
        $minScore = $request->query('min_score');

        $matches = ItemMatch::query()
            ->with([
                'lostItem:id,user_id,item_name,category,color,brand,model,description,unique_characteristics,details,location_lost,date_lost,time_lost,contact_info,status,image_path,updated_at',
                'lostItem.user:id,name',
                'foundItem:id,item_name,category,color,brand,model,description,unique_characteristics,details,location_found,date_found,time_found,status,image_path,intake_channel,storage_location_id,updated_at',
                'foundItem.storageLocation:id,code,label,room,cabinet,shelf,box',
            ])
            ->whereHas('lostItem')
            ->whereHas('foundItem', fn ($q) => $q->where(function ($w) {
                $w->whereNull('intake_channel')->orWhere('intake_channel', '!=', FoundItem::CHANNEL_COUNTER_INTAKE);
            }))
            ->when(
                $status === 'open',
                fn ($q) => $q->whereIn('status', [ItemMatch::STATUS_PENDING, ItemMatch::STATUS_NOTIFIED]),
                fn ($q) => $status === 'all' ? $q : $q->where('status', $status)
            )
            // The "needs review" / "owner notified" tabs only list leads that can still go somewhere:
            // not when the found item was already claimed / released / disposed, or the owner's
            // lost report already has an approved claim or was closed.
            ->when(in_array($status, ['open', ItemMatch::STATUS_PENDING, ItemMatch::STATUS_NOTIFIED], true), fn ($q) => $q->live())
            ->when(in_array($level, ['very_high', 'high', 'possible', 'low'], true), fn ($q) => $q->where('match_level', $level))
            ->when(is_numeric($minScore), fn ($q) => $q->where('score', '>=', (int) $minScore))
            ->when($request->query('q'), function ($q, $term) {
                $q->where(function ($w) use ($term) {
                    $w->whereHas('lostItem', fn ($l) => $l->where('item_name', 'like', "%{$term}%")->orWhere('brand', 'like', "%{$term}%")->orWhere('model', 'like', "%{$term}%"))
                        ->orWhereHas('foundItem', fn ($f) => $f->where('item_name', 'like', "%{$term}%")->orWhere('brand', 'like', "%{$term}%")->orWhere('model', 'like', "%{$term}%"));
                });
            })
            ->orderByDesc('score')
            ->orderByDesc('id')
            ->paginate(12);

        // Live scoring: if either report was edited since this match was scored,
        // re-score it now so the queue never shows stale numbers.
        $matches->getCollection()->each(function (ItemMatch $m) {
            $this->matcher->refreshIfStale($m);
            $m->lostItem?->append('image_url');
        });

        return response()->json($matches);
    }

    /**
     * A tiny "has anything changed?" stamp for the Matches page to poll.
     *
     * Three aggregate queries, no rows, no scoring — cheap enough to hit every few
     * seconds from every open page, even on shared hosting. The stamp moves when a
     * match is created / re-scored / actioned OR when either report is edited, which
     * is exactly when the list (and its live re-score) is worth re-fetching.
     */
    public function pulse()
    {
        $m = ItemMatch::query()->selectRaw('count(*) as c, max(id) as i, max(updated_at) as u')->first();
        $l = LostItem::withTrashed()->selectRaw('count(*) as c, max(updated_at) as u')->first();
        $f = FoundItem::withTrashed()->selectRaw('count(*) as c, max(updated_at) as u')->first();

        return response()->json([
            'v' => md5(implode('|', [$m->c, $m->i, $m->u, $l->c, $l->u, $f->c, $f->u])),
        ])->header('Cache-Control', 'no-store');
    }

    /**
     * One match, scored LIVE against the current state of both reports, with the
     * full side-by-side comparison. This is what Security / Admin / Staff open to
     * decide whether the two reports are really the same item.
     */
    public function show(ItemMatch $match)
    {
        $match->load([
            'lostItem.user:id,name',
            'foundItem.storageLocation:id,code,label,room,cabinet,shelf,box',
            'foundItem.finder:id,name',
        ]);
        abort_unless($match->lostItem && $match->foundItem, 404, 'One of the reports in this match no longer exists.');

        $previous = $match->score;
        $analysis = $this->matcher->refresh($match);
        $match->lostItem->append('image_url');

        return response()->json([
            'match' => $match,
            'analysis' => $analysis,
            'rescored' => $previous !== $match->score,
            'previous_score' => $previous,
            'scored_at' => $match->scored_at,
            // Why this lead can't be acted on right now (already claimed / released / closed…), or null.
            'unavailable' => $match->status === ItemMatch::STATUS_CLAIMED ? null : $this->reconciler->unavailableReason($match),
        ]);
    }

    /**
     * The machine-learning model's status for the handlers' Matches page: is it on, is it
     * trained, how many outcomes it learned from, how it did on a held-out check, and
     * which inputs it weighs most. Read-only; training is `php artisan matches:train`.
     */
    public function model()
    {
        $enabled = MatchLearner::enabled();
        $model = $enabled ? MatchLearner::model() : null;

        if ($model === null) {
            return response()->json(['enabled' => $enabled, 'trained' => false])->header('Cache-Control', 'no-store');
        }

        $weights = $model['weights'];
        arsort($weights);

        return response()->json([
            'enabled' => true,
            'trained' => true,
            'trained_at' => $model['trained_at'] ?? null,
            'weight' => MatchLearner::weightFor($model),
            'samples' => $model['samples'] ?? [],
            'metrics' => $model['metrics'] ?? [],
            'top_inputs' => collect($weights)->take(6)->map(fn ($w, $k) => [
                'key' => $k, 'label' => MatchLearner::FEATURE_LABELS[$k] ?? $k, 'weight' => round((float) $w, 2),
            ])->values(),
        ])->header('Cache-Control', 'no-store');
    }

    /**
     * Real-time score for a report that has NOT been submitted yet. The report
     * forms call this (debounced) as the person types, so they see which stored
     * reports their description would match — and how strongly — before filing.
     */
    public function preview(Request $request)
    {
        $data = $request->validate([
            'kind' => 'required|in:lost,found',
            'item_name' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:5000',
            'category' => 'nullable|string|max:100',
            'brand' => 'nullable|string|max:100',
            'color' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'unique_characteristics' => 'nullable|string|max:500',
            'location_lost' => 'nullable|string|max:255',
            'location_found' => 'nullable|string|max:255',
            'date_lost' => 'nullable|date',
            'date_found' => 'nullable|date',
            'details' => 'nullable|array|max:12',
            'details.*' => 'nullable|string|max:80',
        ]);

        $kind = $data['kind'];
        $user = $request->user();
        abort_unless(
            $user->can('create', $kind === 'lost' ? LostItem::class : FoundItem::class),
            403,
            'You cannot file this kind of report.'
        );

        $attrs = array_filter(
            collect($data)->except('kind')->all(),
            fn ($v) => is_array($v) ? $v !== [] : ($v !== null && trim((string) $v) !== '')
        );

        // Nothing meaningful typed yet — don't scan the whole table for a blank draft.
        if (empty($attrs['item_name']) && empty($attrs['category'])) {
            return response()->json(['best' => 0, 'level' => 'low', 'count' => 0, 'candidates' => [], 'ready' => false]);
        }

        return response()->json($this->matcher->previewForDraft($kind, $attrs) + ['ready' => true]);
    }

    /**
     * Handler confirms the pairing looks real and tells the person who
     * reported the lost item. They then open the found item and file the
     * claim, which goes through the normal verification flow — a match is
     * never ownership on its own.
     */
    public function notifyOwner(ItemMatch $match)
    {
        if ($match->status === ItemMatch::STATUS_DISMISSED) {
            abort(422, 'This match was dismissed. It cannot be sent to the owner.');
        }
        if ($match->status === ItemMatch::STATUS_CLAIMED) {
            abort(422, 'A claim was already filed for this match.');
        }

        $match->loadMissing('lostItem.user', 'foundItem');

        if ($reason = $this->reconciler->unavailableReason($match)) {
            abort(422, $reason . ' It cannot be sent to the owner.');
        }

        $owner = $match->lostItem?->user;
        if (!$owner) {
            abort(422, 'The person who reported this lost item no longer has an account.');
        }

        $owner->notify(new SclfNotification(
            SclfNotification::TYPE_POTENTIAL_MATCH,
            'Security found a possible match',
            "A staff member reviewed \"{$match->lostItem->item_name}\" and thinks it may match \"{$match->foundItem->item_name}\". Open it to check and file a claim.",
            LostItem::class,
            $match->lostItem->id,
        ));

        $match->update(['status' => ItemMatch::STATUS_NOTIFIED]);

        $this->audit->log(
            'match.owner_notified',
            $match,
            "Match #{$match->id} (lost #{$match->lost_item_id} / found #{$match->found_item_id}) sent to the owner by user #" . auth()->id() . '.'
        );

        return response()->json([
            'success' => true,
            'message' => 'The owner has been notified.',
            'data' => $match->fresh(),
        ]);
    }

    /**
     * Potential found-item matches for a lost item, most relevant first.
     * Only the reporting owner or staff may view them.
     *
     * Deliberately NOT the 'view' ability here — LostItemPolicy::view()
     * returns true for any authenticated user, since it also backs the
     * public lost-items browse/detail pages. Match candidates are a
     * narrower thing: they tie this specific report to specific found
     * items, so only the person who filed it (or staff) should see them.
     */
    public function forLostItem(LostItem $lostItem)
    {
        $this->authorizeMatchAccess($lostItem->user_id);

        $matches = $lostItem->matches()
            ->with('foundItem:id,item_name,category,image_path,status,location_found,date_found,updated_at')
            ->orderByDesc('score')
            ->get();
        $matches = $this->onlyReachable($matches);

        return response()->json($this->presentForViewer($matches));
    }

    /**
     * Potential lost-item matches for a found item. Same reasoning as
     * forLostItem() above — only the finder or staff, not the general
     * 'view' ability, since this links a found item to specific lost
     * reports (and whoever filed them).
     */
    public function forFoundItem(FoundItem $foundItem)
    {
        $this->authorizeMatchAccess($foundItem->user_id);

        $matches = $foundItem->matches()
            ->with('lostItem:id,item_name,category,image_path,status,location_lost,date_lost,user_id,updated_at')
            ->orderByDesc('score')
            ->get();
        $matches = $this->onlyReachable($matches);

        return response()->json($this->presentForViewer($matches));
    }

    /**
     * Drop leads that can no longer lead anywhere: the other report is gone, the item was
     * released / disposed, the lead was retired by the system, or the item is tied up in
     * another person's approved claim. A match that itself turned into a claim stays visible.
     */
    private function onlyReachable($matches)
    {
        return $matches->filter(function (ItemMatch $m) {
            if ($m->status === ItemMatch::STATUS_CLAIMED) {
                return true;
            }
            if (!empty($m->score_details['retired'])) {
                return false;
            }
            if ($m->status === ItemMatch::STATUS_DISMISSED) {
                return $this->reconciler->goneReason($m) === null;
            }

            return $this->reconciler->unavailableReason($m) === null;
        })->values();
    }

    /**
     * Re-score anything stale, then shape the explanation for whoever is asking.
     *
     * Handlers (security / admin / staff) get the full comparison. The person who
     * filed one side of the match only gets WHICH fields lined up and how many
     * points each earned — never the other report's actual values or notes, since
     * a found item's unique marks are exactly what a fake claimant would want to
     * read off the screen.
     */
    private function presentForViewer($matches)
    {
        $isHandler = auth()->user()->hasAnyRole(\App\Models\User::LOST_FOUND_HANDLER_ROLES);

        return $matches->map(function (ItemMatch $m) use ($isHandler) {
            $this->matcher->refreshIfStale($m);

            if (!$isHandler) {
                $details = $m->score_details ?? [];
                $m->makeHidden(['score_details', 'score_breakdown']);
                $m->setAttribute('public_details', [
                    'confidence' => $details['confidence'] ?? null,
                    'summary' => $details['summary'] ?? null,
                    'fields' => collect($details['fields'] ?? [])->map(fn ($f) => [
                        'key' => $f['key'], 'label' => $f['label'], 'status' => $f['status'],
                        'points' => $f['points'], 'weight' => $f['weight'],
                    ])->values(),
                ]);
            }

            return $m;
        })->values();
    }

    private function authorizeMatchAccess(?int $reportOwnerId): void
    {
        $user = auth()->user();

        if ($user->id !== $reportOwnerId && !$user->hasAnyRole(['security_officer', 'admin', 'staff'])) {
            abort(403, 'You can only view match candidates for a report you filed yourself.');
        }
    }

    /**
     * Owner dismisses a suggested match that isn't theirs — or a handler
     * (security / admin / staff) rules the pairing out from the Matches queue.
     */
    public function dismiss(ItemMatch $match)
    {
        $this->authorize('view', $match->lostItem);

        $isHandler = auth()->user()->hasAnyRole(\App\Models\User::LOST_FOUND_HANDLER_ROLES);

        if (!$isHandler && (int) auth()->id() !== (int) $match->lostItem->user_id) {
            abort(403, 'You can only dismiss matches on a lost item report you filed yourself.');
        }

        $match->update(['status' => ItemMatch::STATUS_DISMISSED]);

        return response()->json(['success' => true, 'message' => 'Match dismissed.']);
    }
}
