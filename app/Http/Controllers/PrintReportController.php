<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Violation;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\Request;

/**
 * Data for a printed student/instructor dashboard (/app/print/{token}).
 *
 * The printed copy carries a QR code that points at this same page, so an
 * admin / staff / security officer can scan the paper and see the owner's
 * dashboard. The token only IDENTIFIES the account; access is decided here:
 * the owner, or a lost & found handler role — nobody else.
 */
class PrintReportController extends Controller
{
    /** Who may open someone else's report. */
    private const HANDLER_ROLES = ['admin', 'staff', 'security_officer'];

    /** Whose dashboards can be printed this way. */
    private const SUBJECT_ROLES = ['student', 'instructor'];

    public function show(Request $request, string $token, AnalyticsController $analytics, AuditLogService $audit)
    {
        $viewer = $request->user();

        $subject = User::with('department:id,name')->where('public_token', $token)->first();
        abort_if(! $subject, 404, 'This code does not match any account.');

        $isSelf = $viewer->id === $subject->id;

        if (! $isSelf && ! $viewer->hasAnyRole(self::HANDLER_ROLES)) {
            abort(403, 'You can only open your own dashboard report.');
        }

        abort_if(
            ! $subject->hasAnyRole(self::SUBJECT_ROLES),
            404,
            'There is no printable dashboard for this account.'
        );

        // Opening somebody else's dashboard is a privileged read — keep a trail.
        if (! $isSelf) {
            $audit->log(
                'dashboard.report_viewed',
                $subject,
                "User #{$viewer->id} opened the printed dashboard of user #{$subject->id} ({$subject->name})."
            );
        }

        return response()->json([
            'generated_at' => now()->toIso8601String(),
            'viewer_is_self' => $isSelf,
            'subject' => [
                'public_token' => $subject->public_token,
                'name' => $subject->name,
                'display_id' => $subject->display_id,
                'role' => $subject->hasRole('instructor') ? 'instructor' : 'student',
                'course' => $subject->hasRole('instructor') ? $subject->teaching_course : $subject->course,
                'department' => optional($subject->department)->name,
                'email' => $subject->email,
                'profile_picture_url' => $subject->profile_picture_url,
            ],
            'report' => $analytics->personalPayload($subject),
            'violations' => $this->violationsFor($subject, $viewer),
        ]);
    }

    /**
     * Confirmed violations for the printed dashboard. The count is zero (and
     * `items` empty) for a clean record so the page can print "No violations".
     * Files still waiting for review are only counted for the handler roles —
     * they are not a finding against the person yet.
     *
     * @return array{count:int, pending:int|null, items:array<int,array<string,mixed>>}
     */
    private function violationsFor(User $subject, User $viewer): array
    {
        $confirmed = Violation::where('user_id', $subject->id)->confirmed();

        $items = (clone $confirmed)
            ->with('reviewer:id,name', 'reviewer.roles:id,name')
            ->latest('reviewed_at')
            ->limit(10)
            ->get()
            ->map(fn (Violation $v) => [
                'id' => $v->id,
                'type' => $v->type,
                'source' => $v->source,
                'reason' => $v->reason,
                'at' => optional($v->reviewed_at ?? $v->created_at)->toIso8601String(),
                // Role only (Administrator / Security Officer / Staff) — the
                // person reading their own printout isn't shown a staff name.
                'confirmed_by' => $v->reviewerRoleLabel(),
            ])
            ->values();

        return [
            'count' => $confirmed->count(),
            'pending' => $viewer->hasAnyRole(self::HANDLER_ROLES)
                ? Violation::where('user_id', $subject->id)->where('status', Violation::STATUS_PENDING)->count()
                : null,
            'items' => $items,
        ];
    }
}
