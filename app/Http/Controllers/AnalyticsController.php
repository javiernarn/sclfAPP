<?php

namespace App\Http\Controllers;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\CounterQueueEntry;
use App\Models\LostItem;
use App\Models\SecurityIncident;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\Visitor;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function overview(Request $request)
    {
        if (!$request->user()->hasAnyRole(['admin', 'staff', 'security_officer'])) {
            abort(403);
        }

        return response()->json($this->summary());
    }

    public function categories(Request $request)
    {
        if (!$request->user()->hasAnyRole(['admin', 'staff', 'security_officer'])) {
            abort(403);
        }

        return response()->json(
            LostItem::select('category', DB::raw('count(*) as total'))
                ->whereNotNull('category')
                ->groupBy('category')
                ->orderByDesc('total')
                ->limit(10)
                ->get()
        );
    }

    public function highRiskLocations(Request $request)
    {
        if (!$request->user()->hasAnyRole(['admin', 'staff', 'security_officer'])) {
            abort(403);
        }

        return response()->json(
            LostItem::select('location_lost', DB::raw('count(*) as total'))
                ->whereNotNull('location_lost')
                ->groupBy('location_lost')
                ->orderByDesc('total')
                ->limit(10)
                ->get()
        );
    }

    public function monthly(Request $request)
    {
        if (!$request->user()->hasAnyRole(['admin', 'staff', 'security_officer'])) {
            abort(403);
        }

        $months = collect(range(0, 5))->map(fn ($i) => now()->subMonths($i)->format('Y-m'))->reverse()->values();

        $data = $months->map(function ($month) {
            [$year, $mon] = explode('-', $month);

            return [
                'month' => $month,
                'lost' => LostItem::whereYear('created_at', $year)->whereMonth('created_at', $mon)->count(),
                'found' => FoundItem::whereYear('created_at', $year)->whereMonth('created_at', $mon)->count(),
                'claims' => Claim::whereYear('created_at', $year)->whereMonth('created_at', $mon)->count(),
                'recovered' => LostItem::where('status', LostItem::STATUS_CLOSED)
                    ->whereYear('updated_at', $year)->whereMonth('updated_at', $mon)->count(),
                'rejected' => Claim::where('status', Claim::STATUS_REJECTED)
                    ->whereYear('updated_at', $year)->whereMonth('updated_at', $mon)->count(),
            ];
        });

        return response()->json($data);
    }

    public function peakHours(Request $request)
    {
        if (!$request->user()->hasAnyRole(['admin', 'staff', 'security_officer'])) {
            abort(403);
        }

        $rows = LostItem::select(DB::raw($this->hourExpression() . ' as hour'), DB::raw('count(*) as total'))
            ->groupBy('hour')
            ->orderBy('hour')
            ->get();

        return response()->json($rows);
    }

    protected function summary(): array
    {
        $totalLost = LostItem::count();
        $recovered = LostItem::where('status', LostItem::STATUS_CLOSED)->count();

        // Found items arrive through two distinct channels (see
        // FoundItem::CHANNEL_*) and the two dashboards conflated them into
        // one "Found Today" / "Items Released" number, which is what made
        // Security/Admin's dashboard confusing: a spike could mean a rush of
        // strangers turning items in for review, OR a rush of counter
        // check-ins for known owners — two very different workflows. Every
        // stat below is scoped to one channel or the other so the dashboard
        // can show them as two separate sections instead of one blended one.
        $reportItems = FoundItem::where('intake_channel', FoundItem::CHANNEL_ONLINE_REPORT);
        $counterItems = FoundItem::where('intake_channel', FoundItem::CHANNEL_COUNTER_INTAKE);

        return [
            'lost_today' => LostItem::whereDate('created_at', today())->count(),
            'claims_waiting' => Claim::whereIn('status', [Claim::STATUS_PENDING, Claim::STATUS_UNDER_REVIEW])->count(),
            'suspicious_claims' => Claim::where('risk_score', '>=', 40)->whereIn('status', [Claim::STATUS_PENDING, Claim::STATUS_UNDER_REVIEW])->count(),
            'recovery_rate' => $totalLost > 0 ? round(($recovered / $totalLost) * 100, 1) : 0,
            'average_recovery_days' => $this->averageRecoveryDays(),
            'total_lost' => $totalLost,
            'total_found' => FoundItem::count(),
            'total_recovered' => $recovered,

            // --- Found Item Reports (strangers turning items in online,
            // channel = online_report) — needs review/verification before
            // it's accepted into inventory. ---
            'found_reports' => [
                'today' => (clone $reportItems)->whereDate('created_at', today())->count(),
                'pending_verification' => (clone $reportItems)->where('verification_status', 'pending')->count(),
                'released' => (clone $reportItems)->where('status', FoundItem::STATUS_RELEASED)->count(),
                'total' => (clone $reportItems)->count(),
            ],

            // --- Counter (channel = counter_intake) — items handed over in
            // person by a known owner via the Counter check-in flow, and
            // released back to them later via Claims/QR scan. ---
            'counter' => [
                'checked_in_today' => (clone $counterItems)->whereDate('created_at', today())->count(),
                'awaiting_release' => (clone $counterItems)->where('status', '!=', FoundItem::STATUS_RELEASED)->count(),
                'released' => (clone $counterItems)->where('status', FoundItem::STATUS_RELEASED)->count(),
                'total' => (clone $counterItems)->count(),
            ],

            // Deprecated combined fields — kept around in case anything
            // else still reads them, but the dashboards now read the
            // channel-scoped `found_reports` / `counter` blocks above.
            'found_today' => FoundItem::whereDate('created_at', today())->count(),
            'items_pending_verification' => FoundItem::where('verification_status', 'pending')->count(),
            'items_released' => FoundItem::where('status', FoundItem::STATUS_RELEASED)->count(),
        ];
    }


    // ---------------------------------------------------------------------
    // Live dashboard payloads (polled by the React dashboards every ~15s).
    // ---------------------------------------------------------------------

    /**
     * One payload for the Admin + Security dashboards. Cached for a few
     * seconds so many open dashboards polling at once cost one set of
     * queries, not one per browser tab.
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();

        if (!$user->hasAnyRole(['admin', 'staff', 'security_officer'])) {
            abort(403);
        }

        $days = (int) $request->query('days', 14);
        $days = in_array($days, [7, 14, 30], true) ? $days : 14;
        $isAdmin = $user->hasAdminAccess();

        $payload = Cache::remember("analytics.dashboard.{$days}." . ($isAdmin ? 'a' : 's'), 10, function () use ($days, $isAdmin) {
            return $this->buildDashboard($days, $isAdmin);
        });

        return response()->json($payload);
    }

    /**
     * Personal analytics for Student / Instructor dashboards — only ever
     * the signed-in user's own records (plus two campus-wide headline
     * numbers that expose nothing about anyone else).
     */
    public function me(Request $request)
    {
        $user = $request->user();
        $uid = $user->id;
        $from = now()->subDays(29)->startOfDay();

        $lostStatus = LostItem::where('user_id', $uid)->select('status', DB::raw('count(*) as c'))->groupBy('status')->pluck('c', 'status');
        $claimStatus = Claim::where('claimant_id', $uid)->select('status', DB::raw('count(*) as c'))->groupBy('status')->pluck('c', 'status');

        $monthly = collect(range(5, 0))->map(function ($i) use ($uid) {
            $m = now()->subMonths($i);
            return [
                'label' => $m->format('M'),
                'reports' => LostItem::where('user_id', $uid)->whereYear('created_at', $m->year)->whereMonth('created_at', $m->month)->count(),
                'claims' => Claim::where('claimant_id', $uid)->whereYear('created_at', $m->year)->whereMonth('created_at', $m->month)->count(),
            ];
        })->values();

        $daily = $this->dailySeries(LostItem::where('user_id', $uid), 'created_at', $from, 30);

        $recent = LostItem::where('user_id', $uid)->latest('updated_at')->limit(6)
            ->get(['id', 'item_name', 'status', 'updated_at'])
            ->map(fn ($i) => [
                'id' => $i->id,
                'title' => $i->item_name,
                'status' => $i->status,
                'at' => optional($i->updated_at)->toIso8601String(),
            ]);

        $totalLost = LostItem::count();
        $recoveredAll = LostItem::where('status', LostItem::STATUS_CLOSED)->count();

        $payload = [
            'generated_at' => now()->toIso8601String(),
            'kpis' => [
                'reports' => (int) $lostStatus->sum(),
                'pending' => (int) ($lostStatus[LostItem::STATUS_PENDING] ?? 0),
                'matched' => (int) ($lostStatus[LostItem::STATUS_MATCHED] ?? 0),
                'recovered' => (int) (($lostStatus[LostItem::STATUS_CLAIMED] ?? 0) + ($lostStatus[LostItem::STATUS_CLOSED] ?? 0)),
                'active_claims' => (int) collect([Claim::STATUS_PENDING, Claim::STATUS_UNDER_REVIEW, Claim::STATUS_MORE_EVIDENCE_REQUIRED, Claim::STATUS_APPROVED, Claim::STATUS_RELEASE_PENDING])
                    ->sum(fn ($s) => $claimStatus[$s] ?? 0),
            ],
            'daily' => $daily,
            'monthly' => $monthly,
            'lost_by_status' => $lostStatus,
            'claims_by_status' => $claimStatus,
            'recent' => $recent,
            'campus' => [
                'recovery_rate' => $totalLost > 0 ? round(($recoveredAll / $totalLost) * 100, 1) : 0,
                'items_on_shelf' => FoundItem::whereIn('status', FoundItem::ON_SHELF_STATUSES)->count(),
            ],
        ];

        // Instructors also file facilities requests / incident reports.
        if ($user->hasRole('instructor')) {
            $payload['service_requests_by_status'] = ServiceRequest::where('requested_by', $uid)
                ->select('status', DB::raw('count(*) as c'))->groupBy('status')->pluck('c', 'status');
            $payload['incidents_by_status'] = SecurityIncident::where('reported_by', $uid)
                ->select('status', DB::raw('count(*) as c'))->groupBy('status')->pluck('c', 'status');
        }

        return response()->json($payload);
    }

    protected function buildDashboard(int $days, bool $isAdmin): array
    {
        $from = now()->subDays($days * 2 - 1)->startOfDay();

        $series = [
            'lost' => $this->dailySeries(LostItem::query(), 'created_at', $from, $days * 2),
            'found' => $this->dailySeries(FoundItem::query(), 'created_at', $from, $days * 2),
            'claims' => $this->dailySeries(Claim::query(), 'created_at', $from, $days * 2),
            'recovered' => $this->dailySeries(LostItem::where('status', LostItem::STATUS_CLOSED), 'updated_at', $from, $days * 2),
        ];

        $kpis = [];
        foreach ($series as $key => $rows) {
            $values = array_column($rows, 'count');
            $prev = array_slice($values, 0, $days);
            $curr = array_slice($values, $days);
            $kpis[$key] = [
                'value' => array_sum($curr),
                'prev' => array_sum($prev),
                'series' => $curr,
            ];
        }

        $trend = [];
        foreach (array_slice($series['lost'], $days) as $i => $row) {
            $trend[] = [
                'date' => $row['date'],
                'label' => Carbon::parse($row['date'])->format('M j'),
                'lost' => $row['count'],
                'found' => $series['found'][$days + $i]['count'],
                'claims' => $series['claims'][$days + $i]['count'],
            ];
        }

        $hours = array_fill(0, 24, 0);
        LostItem::select(DB::raw($this->hourExpression() . ' as hour'), DB::raw('count(*) as total'))
            ->groupBy('hour')->get()
            ->each(function ($r) use (&$hours) {
                $hours[(int) $r->hour] = (int) $r->total;
            });

        $todayQueue = CounterQueueEntry::whereDate('created_at', today());
        $waits = (clone $todayQueue)->whereNotNull('called_at')->get(['created_at', 'called_at'])
            ->map(fn ($e) => $e->created_at->diffInMinutes($e->called_at));

        $data = [
            'generated_at' => now()->toIso8601String(),
            'days' => $days,
            'kpis' => $kpis,
            'trend' => $trend,
            'summary' => $this->summary(),
            'claims_by_status' => Claim::select('status', DB::raw('count(*) as c'))->groupBy('status')->pluck('c', 'status'),
            'categories' => LostItem::select('category', DB::raw('count(*) as total'))
                ->whereNotNull('category')->groupBy('category')->orderByDesc('total')->limit(6)->get(),
            'locations' => LostItem::select('location_lost', DB::raw('count(*) as total'))
                ->whereNotNull('location_lost')->groupBy('location_lost')->orderByDesc('total')->limit(6)->get(),
            'monthly' => collect(range(5, 0))->map(function ($i) {
                $m = now()->subMonths($i);
                return [
                    'label' => $m->format('M'),
                    'lost' => LostItem::whereYear('created_at', $m->year)->whereMonth('created_at', $m->month)->count(),
                    'found' => FoundItem::whereYear('created_at', $m->year)->whereMonth('created_at', $m->month)->count(),
                    'recovered' => LostItem::where('status', LostItem::STATUS_CLOSED)
                        ->whereYear('updated_at', $m->year)->whereMonth('updated_at', $m->month)->count(),
                ];
            })->values(),
            'peak_hours' => $hours,
            'incidents_by_severity' => SecurityIncident::where('status', '!=', SecurityIncident::STATUS_CLOSED)
                ->select('severity', DB::raw('count(*) as c'))->groupBy('severity')->pluck('c', 'severity'),
            'service_requests_by_status' => ServiceRequest::select('status', DB::raw('count(*) as c'))->groupBy('status')->pluck('c', 'status'),
            'queue' => [
                'waiting' => CounterQueueEntry::where('status', CounterQueueEntry::STATUS_WAITING)->count(),
                'called' => CounterQueueEntry::where('status', CounterQueueEntry::STATUS_CALLED)->count(),
                'serving' => CounterQueueEntry::where('status', CounterQueueEntry::STATUS_SERVING)->count(),
                'completed_today' => (clone $todayQueue)->where('status', CounterQueueEntry::STATUS_COMPLETED)->count(),
                'no_show_today' => (clone $todayQueue)->where('status', CounterQueueEntry::STATUS_NO_SHOW)->count(),
                'avg_wait_minutes' => $waits->isEmpty() ? null : round($waits->avg(), 1),
            ],
            'visitors_on_site' => Visitor::where('status', Visitor::STATUS_CHECKED_IN)->count(),
            'recent_activity' => $this->recentActivity(),
        ];

        if ($isAdmin) {
            $data['users_by_role'] = collect(['student', 'instructor', 'security_officer', 'staff', 'admin'])
                ->mapWithKeys(fn ($r) => [$r => User::role($r)->count()]);
        }

        return $data;
    }

    /** Latest lost reports, found items and claims merged into one feed. */
    protected function recentActivity(): array
    {
        $lost = LostItem::latest()->limit(6)->get(['id', 'item_name', 'created_at'])
            ->map(fn ($i) => ['type' => 'lost', 'title' => $i->item_name, 'at' => $i->created_at]);
        $found = FoundItem::latest()->limit(6)->get(['id', 'item_name', 'intake_channel', 'created_at'])
            ->map(fn ($i) => ['type' => $i->intake_channel === FoundItem::CHANNEL_COUNTER_INTAKE ? 'counter' : 'found', 'title' => $i->item_name, 'at' => $i->created_at]);
        $claims = Claim::with('foundItem:id,item_name')->latest()->limit(6)->get()
            ->map(fn ($c) => ['type' => 'claim', 'title' => optional($c->foundItem)->item_name ?? 'Item', 'status' => $c->status, 'at' => $c->created_at]);

        return $lost->concat($found)->concat($claims)
            ->sortByDesc('at')->take(8)->values()
            ->map(fn ($e) => array_merge($e, ['at' => $e['at']->toIso8601String()]))
            ->all();
    }

    /**
     * Zero-filled per-day counts: [['date' => 'Y-m-d', 'count' => n], ...]
     * covering exactly $days days ending today, so charts never have gaps.
     */
    protected function dailySeries($query, string $column, Carbon $from, int $days): array
    {
        $rows = $query->where($column, '>=', $from)
            ->select(DB::raw("DATE({$column}) as d"), DB::raw('count(*) as c'))
            ->groupBy('d')->pluck('c', 'd');

        $out = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $from->copy()->addDays($i)->toDateString();
            $out[] = ['date' => $date, 'count' => (int) ($rows[$date] ?? 0)];
        }

        return $out;
    }

    /** Hour-of-day SQL expression that works on MySQL, Postgres and SQLite. */
    protected function hourExpression(): string
    {
        return match (DB::connection()->getDriverName()) {
            'sqlite' => "CAST(strftime('%H', created_at) AS INTEGER)",
            'pgsql' => 'EXTRACT(HOUR FROM created_at)',
            default => 'HOUR(created_at)',
        };
    }

    protected function averageRecoveryDays(): ?float
    {
        $closed = LostItem::where('status', LostItem::STATUS_CLOSED)->get(['created_at', 'updated_at']);

        if ($closed->isEmpty()) {
            return null;
        }

        $totalDays = $closed->sum(fn ($item) => $item->created_at->diffInDays($item->updated_at));

        return round($totalDays / $closed->count(), 1);
    }
}
