<?php

namespace App\Http\Middleware;

use App\Models\UserActivity;
use App\Services\Activity\ActivityRiskScorer;
use App\Support\UserAgentParser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Records a lightweight "who did what, from where" row for every
 * authenticated request, feeding the Admin > User Activity screen (device /
 * IP breakdown + simple spam/abuse flagging). Deliberately fire-and-forget:
 * a failure here must never break the actual request it's attached to.
 */
class TrackUserActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! config('sclf.activity.enabled', true)) {
            return $response;
        }

        try {
            $this->record($request, $response);
        } catch (\Throwable $e) {
            report($e);
        }

        return $response;
    }

    private function record(Request $request, Response $response): void
    {
        $path = ltrim($request->path(), '/');

        foreach (config('sclf.activity.exclude_paths', []) as $pattern) {
            if ($request->is(ltrim($pattern, '/'))) {
                return;
            }
        }

        $user = $request->user();
        $ua = UserAgentParser::parse($request->userAgent());
        $now = now();

        $risk = app(ActivityRiskScorer::class)->evaluate(
            $user?->id,
            $request->ip(),
            $path,
            $now,
        );

        UserActivity::create([
            'user_id' => $user?->id,
            'method' => $request->method(),
            'path' => $path,
            'route_name' => $request->route()?->getName(),
            'status_code' => $response->getStatusCode(),
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 500),
            'device_type' => $ua['device_type'],
            'platform' => $ua['platform'],
            'browser' => $ua['browser'],
            'is_suspicious' => $risk['is_suspicious'],
            'flag_reason' => $risk['reason'],
            'created_at' => $now,
        ]);
    }
}
