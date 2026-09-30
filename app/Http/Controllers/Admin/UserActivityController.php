<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Http\Request;

/**
 * Super-admin visibility into what's actually hitting the app: which
 * account (or anonymous IP), from which device, doing what, and whether the
 * volume looks like normal use or spam/abuse. Everything here reads from
 * user_activities (see the migration + TrackUserActivity middleware) — a
 * raw request log, separate from the curated audit_logs trail.
 */
class UserActivityController extends Controller
{
    /**
     * Paginated, filterable raw activity feed — the "everything" view.
     */
    public function index(Request $request)
    {
        abort_unless($request->user()->hasAdminAccess(), 403);

        $rows = UserActivity::query()
            ->with('user:id,name,email')
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', $request->integer('user_id')))
            ->when($request->filled('ip_address'), fn ($q) => $q->where('ip_address', $request->string('ip_address')))
            ->when($request->filled('device_type'), fn ($q) => $q->where('device_type', $request->string('device_type')))
            ->when($request->boolean('suspicious_only'), fn ($q) => $q->where('is_suspicious', true))
            ->when($request->filled('from'), fn ($q) => $q->where('created_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->where('created_at', '<=', $request->date('to')))
            ->latest('created_at')
            ->paginate(30);

        return response()->json($rows);
    }

    /**
     * Per-user rollup: every device/IP this account has been seen on, how
     * often, and how recently — plus the running flagged-request count.
     * This is what the "Devices & IP Addresses" card on Admin > User
     * Details pulls, and it's also usable as a standalone lookup by
     * user_id from the main Activity screen.
     */
    public function summary(Request $request, User $user)
    {
        abort_unless($request->user()->hasAdminAccess(), 403);

        $days = (int) $request->input('days', 30);
        $since = now()->subDays($days);

        $base = UserActivity::query()->where('user_id', $user->id)->where('created_at', '>=', $since);

        $devices = (clone $base)
            ->selectRaw('device_type, platform, browser, COUNT(*) as hits, MAX(created_at) as last_seen')
            ->groupBy('device_type', 'platform', 'browser')
            ->orderByDesc('last_seen')
            ->get();

        $ips = (clone $base)
            ->selectRaw('ip_address, COUNT(*) as hits, MAX(created_at) as last_seen')
            ->whereNotNull('ip_address')
            ->groupBy('ip_address')
            ->orderByDesc('last_seen')
            ->get();

        $mostVisited = (clone $base)
            ->selectRaw('path, COUNT(*) as hits')
            ->groupBy('path')
            ->orderByDesc('hits')
            ->limit(10)
            ->get();

        return response()->json([
            'data' => [
                'window_days' => $days,
                'total_requests' => (clone $base)->count(),
                'flagged_requests' => (clone $base)->where('is_suspicious', true)->count(),
                'distinct_ip_count' => $ips->count(),
                'distinct_device_count' => $devices->count(),
                'last_seen' => (clone $base)->max('created_at'),
                'devices' => $devices,
                'ip_addresses' => $ips,
                'most_visited' => $mostVisited,
            ],
        ]);
    }
}
