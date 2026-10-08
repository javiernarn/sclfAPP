<?php

namespace App\Http\Middleware;

use App\Services\Staff\StaffApprovalService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The single choke point for the "staff can look, but not touch" rule.
 *
 * Staff pass every role check the admin does (so they can open the same
 * pages and read the same data), but this middleware refuses any write
 * (POST/PUT/PATCH/DELETE) unless the admin has approved a request for that
 * exact action on that exact record. The approval is consumed once the
 * action succeeds. Admins and every other role are untouched.
 *
 * Because it is applied to the whole authenticated route group, a new
 * endpoint added later is protected for staff automatically.
 */
class RequireStaffApproval
{
    public function __construct(protected StaffApprovalService $approvals)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (
            !$user
            || !$user->hasRole('staff')
            || $user->hasRole('admin')
            || in_array($request->method(), StaffApprovalService::SAFE_METHODS, true)
            || $this->approvals->isExempt($request)
        ) {
            return $next($request);
        }

        $approval = $request->route()
            ? $this->approvals->findApproved($user, $request->method(), $request->route())
            : null;

        if (!$approval) {
            return response()->json([
                'code' => 'approval_required',
                'message' => 'This action needs the administrator\'s approval. Send a request and try again once it is approved.',
            ], 403);
        }

        if ($mismatch = $this->approvals->lockedFieldMismatch($approval, $request)) {
            return response()->json(['code' => 'approval_mismatch', 'message' => $mismatch], 403);
        }

        $response = $next($request);

        // Only spend the approval if the action really went through — a
        // validation error shouldn't force the staff member to ask again.
        if ($response->getStatusCode() < 400) {
            $this->approvals->markExecuted($approval, $user);
        }

        return $response;
    }
}
