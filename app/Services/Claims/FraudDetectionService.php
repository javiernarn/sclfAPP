<?php

namespace App\Services\Claims;

use App\Models\Claim;
use App\Models\User;

/**
 * Rule-based fraud/risk indicator scoring. This NEVER auto-bans or
 * auto-rejects a user — it only raises a risk score + flags for the
 * Security Officer to weigh during manual review.
 */
class FraudDetectionService
{
    public function assess(User $claimant, ?int $excludeClaimId = null): array
    {
        $flags = [];
        $score = 0;

        $recentClaims = Claim::where('claimant_id', $claimant->id)
            ->when($excludeClaimId, fn ($q) => $q->where('id', '!=', $excludeClaimId))
            ->where('created_at', '>=', now()->subDays(30))
            ->get();

        $rejectedCount = $recentClaims->where('status', Claim::STATUS_REJECTED)->count();
        if ($rejectedCount >= 2) {
            $flags[] = "Claimant has {$rejectedCount} rejected claims in the last 30 days.";
            $score += 30;
        }

        $totalRecent = $recentClaims->count();
        if ($totalRecent >= 5) {
            $flags[] = "Claimant has submitted {$totalRecent} claims in the last 30 days (abnormally frequent).";
            $score += 25;
        }

        $distinctCategories = $recentClaims->pluck('foundItem.category')->filter()->unique()->count();
        if ($distinctCategories >= 4) {
            $flags[] = "Claimant has claimed items across {$distinctCategories} unrelated categories recently.";
            $score += 20;
        }

        $pendingCount = $recentClaims->whereIn('status', [Claim::STATUS_PENDING, Claim::STATUS_UNDER_REVIEW])->count();
        if ($pendingCount >= 3) {
            $flags[] = "Claimant has {$pendingCount} other claims currently pending review.";
            $score += 15;
        }

        return [min(100, $score), $flags];
    }
}
