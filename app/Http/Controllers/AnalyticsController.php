<?php

namespace App\Http\Controllers;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\LostItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function overview(Request $request)
    {
        if (!$request->user()->hasAnyRole(['admin', 'security_officer'])) {
            abort(403);
        }

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

        return response()->json([
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
        ]);
    }

    public function categories(Request $request)
    {
        if (!$request->user()->hasAnyRole(['admin', 'security_officer'])) {
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
        if (!$request->user()->hasAnyRole(['admin', 'security_officer'])) {
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
        if (!$request->user()->hasAnyRole(['admin', 'security_officer'])) {
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
        if (!$request->user()->hasAnyRole(['admin', 'security_officer'])) {
            abort(403);
        }

        // SQLite-compatible hour extraction (strftime); works the same for MySQL/Postgres
        // via Carbon fallback if the driver differs — kept simple for the capstone scope.
        $rows = LostItem::select(DB::raw("strftime('%H', created_at) as hour"), DB::raw('count(*) as total'))
            ->groupBy('hour')
            ->orderBy('hour')
            ->get();

        return response()->json($rows);
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
