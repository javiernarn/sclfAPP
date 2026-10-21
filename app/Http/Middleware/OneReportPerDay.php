<?php

namespace App\Http\Middleware;

use App\Models\FoundItem;
use App\Models\LostItem;
use App\Models\SecurityIncident;
use App\Models\ServiceRequest;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Limits each student account to N reports per calendar day, counted
 * separately per report type: lost, found, incident, service.
 *
 * Switch on/off with SCLF_ONE_REPORT_PER_DAY (true = limited, false = no limit).
 * Counted from the database (not the cache), including archived/deleted rows,
 * so deleting a report does not hand the student another one. The day resets
 * at midnight in APP_TIMEZONE.
 *
 * Usage on a route: ->middleware('daily.report:lost')
 */
class OneReportPerDay
{
    /** type => [model, owner column, label shown to the user] */
    private const TYPES = [
        'lost' => [LostItem::class, 'user_id', 'lost item report'],
        'found' => [FoundItem::class, 'user_id', 'found item report'],
        'incident' => [SecurityIncident::class, 'reported_by', 'incident report'],
        'service' => [ServiceRequest::class, 'requested_by', 'service request'],
    ];

    public function handle(Request $request, Closure $next, string $type): Response
    {
        if (! config('sclf.daily_report_limit.enabled')) {
            return $next($request);
        }

        $user = $request->user();
        $roles = (array) config('sclf.daily_report_limit.roles', ['student']);

        // Only the configured roles are limited (students by default).
        // Security / staff / admin file reports for the desk all day.
        if (! $user || ! $user->hasAnyRole($roles) || ! isset(self::TYPES[$type])) {
            return $next($request);
        }

        [$model, $column, $label] = self::TYPES[$type];
        $limit = max(1, (int) config('sclf.daily_report_limit.limit', 1));

        $today = $model::withTrashed()
            ->where($column, $user->id)
            ->where('created_at', '>=', now()->startOfDay())
            ->count();

        if ($today >= $limit) {
            // 422 (not 429) so the app shows this message instead of the
            // generic "too many attempts" toast.
            return response()->json([
                'message' => $limit === 1
                    ? "You can only submit one {$label} per day. Please try again tomorrow."
                    : "You can only submit {$limit} {$label}s per day. Please try again tomorrow.",
                'code' => 'daily_report_limit',
            ], 422);
        }

        return $next($request);
    }
}
