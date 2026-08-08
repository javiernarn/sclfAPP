<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReviewClaimRequest;
use App\Http\Requests\StoreClaimEvidenceRequest;
use App\Http\Requests\StoreClaimRequest;
use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use App\Models\ClaimEvidence;
use App\Services\Claims\ClaimService;
use App\Services\Release\ItemReleaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClaimController extends Controller
{
    public function __construct(
        protected ClaimService $claims,
        protected ItemReleaseService $release,
        protected AuditLogService $audit,
    ) {
    }

    public function index(Request $request)
    {
        $query = Claim::with(['foundItem:id,item_name,category,image_path,intake_channel', 'claimant:id,name']);

        // Students/instructor only ever see their own claims. Staff see everything,
        // scoped by their own status filter if provided.
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            $query->where('claimant_id', $request->user()->id);
        }

        $claims = $query
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->latest()
            ->paginate(10);

        return response()->json($claims);
    }

    public function store(StoreClaimRequest $request, FoundItem $foundItem)
    {
        $claim = $this->claims->submit($request->user(), $foundItem, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'Claim submitted successfully.',
            'data' => $claim,
        ], 201);
    }

    public function show(Claim $claim)
    {
        $this->authorize('view', $claim);

        $claim->load([
            'foundItem', 'lostItem', 'claimant:id,name,email,student_id',
            'reviewer:id,name', 'evidence.submitter:id,name', 'qrRelease',
        ]);

        return response()->json($claim);
    }

    public function addEvidence(StoreClaimEvidenceRequest $request, Claim $claim)
    {
        $filePath = null;
        if ($request->hasFile('file')) {
            // Claim evidence is sensitive (proof-of-ownership documents,
            // photos of serial numbers, etc.) and must NOT be reachable by
            // guessing/enumerating a public URL, so this goes on the
            // private 'local' disk (storage/app/private) rather than
            // 'public'. Retrieval is only ever through downloadEvidence()
            // below, which re-checks the same policy as viewing the claim.
            $filePath = $request->file('file')->store('claim-evidence', 'local');
        }

        $evidence = $this->claims->addEvidence($claim, $request->user(), [
            'type' => $request->input('type'),
            'content' => $request->input('content'),
            'file_path' => $filePath,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Evidence submitted.',
            'data' => $evidence,
        ], 201);
    }

    /**
     * Stream a piece of claim evidence to whoever is allowed to see the
     * claim it belongs to (the claimant themselves, or security/admin
     * staff) — mirrors ClaimPolicy::view() rather than a new policy method,
     * since "can see the claim" and "can see its evidence" are the same
     * question here. Unlike the old public-disk approach, there is no URL
     * that works without a valid Sanctum token and a passing authorization
     * check on every request.
     */
    public function downloadEvidence(ClaimEvidence $evidence): StreamedResponse
    {
        $this->authorize('view', $evidence->claim);

        abort_if(!$evidence->file_path || !Storage::disk('local')->exists($evidence->file_path), 404);

        return Storage::disk('local')->download($evidence->file_path);
    }

    public function review(ReviewClaimRequest $request, Claim $claim)
    {
        $updated = $this->claims->transition(
            $claim,
            $request->input('status'),
            $request->user(),
            $request->input('notes'),
        );

        return response()->json([
            'success' => true,
            'message' => 'Claim status updated.',
            'data' => $updated,
        ]);
    }

    public function destroy(Claim $claim)
    {
        $this->authorize('delete', $claim);

        // Also clears out any notifications pointing at this claim so
        // nobody's bell list is left with a dead link (see
        // ClaimService::delete / purgeNotifications for why that's needed
        // instead of a DB-level foreign key).
        $this->claims->delete($claim);

        return response()->json(['success' => true, 'message' => 'Claim deleted.']);
    }

    /**
     * Admin bulk cleanup: permanently remove every cancelled claim for a
     * given user (and their related notifications) in one go — e.g. from
     * the "User Details" page when a student/instructor account has piled up
     * a bunch of cancelled claims. Gated by the 'role:admin' route group.
     */
    public function destroyCancelledForUser(Request $request, User $user)
    {
        abort_unless($request->user()->hasRole('admin'), 403);

        $count = $this->claims->deleteCancelledForUser($user);

        $this->audit->log(
            'claim.bulk_deleted',
            $user,
            "Deleted {$count} cancelled claim(s) for user #{$user->id} by admin #{$request->user()->id}."
        );

        return response()->json([
            'success' => true,
            'message' => $count > 0
                ? "Deleted {$count} cancelled claim(s)."
                : 'No cancelled claims to delete.',
            'data' => ['deleted' => $count],
        ]);
    }

    public function cancel(Claim $claim)
    {
        $this->authorize('cancel', $claim);

        $updated = $this->claims->transition($claim, Claim::STATUS_CANCELLED, auth()->user(), 'Cancelled by claimant.');

        return response()->json(['success' => true, 'message' => 'Claim cancelled.', 'data' => $updated]);
    }

    public function generateRelease(Claim $claim)
    {
        $this->authorize('generateRelease', $claim);

        $result = $this->release->generate($claim, auth()->user());

        return response()->json([
            'success' => true,
            'message' => 'Release QR generated.',
            'data' => [
                'public_code' => $result['public_code'],
                'token' => $result['raw_token'], // shown once — this is the officer's own manual-entry fallback
                'qr_payload' => $result['qr_payload'],
                'expires_at' => $result['qr_release']->expires_at,
            ],
        ], 201);
    }

    /**
     * Manual override for when the claimant can't present their QR at all
     * (lost phone, expired code) — requires a logged reason instead of a
     * token. See ItemReleaseService::manualRelease().
     */
    public function manualRelease(Request $request, Claim $claim)
    {
        $this->authorize('generateRelease', $claim);

        $request->validate(['reason' => 'required|string|max:500']);

        $updated = $this->release->manualRelease($claim, $request->user(), $request->input('reason'));

        return response()->json([
            'success' => true,
            'message' => 'Item manually released. Case closed.',
            'data' => $updated,
        ]);
    }

    public function regenerateRelease(Claim $claim)
    {
        $this->authorize('generateRelease', $claim);

        $result = $this->release->regenerateToken($claim, auth()->user());

        return response()->json([
            'success' => true,
            'message' => 'Release token regenerated.',
            'data' => [
                'public_code' => $result['public_code'],
                'token' => $result['raw_token'], // shown once — this is the officer's own manual-entry fallback
                'qr_payload' => $result['qr_payload'],
                'expires_at' => $result['qr_release']->expires_at,
            ],
        ], 201);
    }

    /**
     * Claimant-facing: issue/re-issue the downloadable release QR for the
     * signed-in student's own claim. The raw token is only ever returned
     * here, baked into qr_payload — never persisted, never shown again
     * once this response is gone.
     */
    public function downloadRelease(Claim $claim)
    {
        $this->authorize('downloadRelease', $claim);

        $result = $this->release->issueForClaimant($claim, auth()->user());

        return response()->json([
            'success' => true,
            'message' => 'Release QR issued.',
            'data' => [
                'public_code' => $result['public_code'],
                'qr_payload' => $result['qr_payload'],
                'expires_at' => $result['qr_release']->expires_at,
            ],
        ], 201);
    }
}