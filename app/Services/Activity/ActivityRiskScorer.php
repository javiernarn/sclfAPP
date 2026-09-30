<?php

namespace App\Services\Activity;

use App\Models\UserActivity;
use Illuminate\Support\Facades\DB;

/**
 * Decides whether a just-recorded request looks like abuse/spam rather than
 * normal browsing, and — if so — why. Kept rule-based and transparent on
 * purpose: a super admin reviewing a flagged account needs to see "42
 * requests to /claims in 60s" printed on the row, not a black-box score.
 *
 * Thresholds are intentionally generous (a real person clicking around
 * fast, or a slow connection retrying, shouldn't light up), and are read
 * from config/sclf.php so they can be tuned per deployment without a code
 * change.
 */
class ActivityRiskScorer
{
    /**
     * @return array{is_suspicious: bool, reason: ?string}
     */
    public function evaluate(?int $userId, ?string $ip, string $path, \DateTimeInterface $now): array
    {
        $windowSeconds = (int) config('sclf.activity.burst_window_seconds', 60);
        $burstLimit = (int) config('sclf.activity.burst_limit', 40);
        $sameEndpointLimit = (int) config('sclf.activity.same_endpoint_limit', 20);

        $since = (clone $now)->modify("-{$windowSeconds} seconds");

        $identity = $userId
            ? ['user_id', $userId]
            : ['ip_address', $ip];

        if ($identity[1] === null) {
            return ['is_suspicious' => false, 'reason' => null];
        }

        $recentCount = UserActivity::query()
            ->where($identity[0], $identity[1])
            ->where('created_at', '>=', $since)
            ->count();

        if ($recentCount >= $burstLimit) {
            return [
                'is_suspicious' => true,
                'reason' => "{$recentCount} requests in the last {$windowSeconds}s",
            ];
        }

        $sameEndpointCount = UserActivity::query()
            ->where($identity[0], $identity[1])
            ->where('path', $path)
            ->where('created_at', '>=', $since)
            ->count();

        if ($sameEndpointCount >= $sameEndpointLimit) {
            return [
                'is_suspicious' => true,
                'reason' => "{$sameEndpointCount} hits on {$path} in the last {$windowSeconds}s",
            ];
        }

        return ['is_suspicious' => false, 'reason' => null];
    }

    /**
     * Distinct IP addresses seen for a user in the given number of days —
     * surfaced on the admin "Devices & IP Addresses" card. A high count on
     * its own isn't proof of anything (campus wifi + mobile data + home is
     * normal), but it's the kind of thing worth a human glance.
     */
    public function distinctIpCount(int $userId, int $days = 30): int
    {
        return UserActivity::query()
            ->where('user_id', $userId)
            ->where('created_at', '>=', now()->subDays($days))
            ->whereNotNull('ip_address')
            ->distinct('ip_address')
            ->count('ip_address');
    }
}
