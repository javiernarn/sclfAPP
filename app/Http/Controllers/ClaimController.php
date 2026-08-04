<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReviewClaimRequest;
use App\Http\Requests\StoreClaimEvidenceRequest;
use App\Http\Requests\StoreClaimRequest;
use App\Models\Claim;
use App\Models\FoundItem;
use App\Services\Claims\ClaimService;
use App\Services\Release\ItemReleaseService;
use Illuminate\Http\Request;

class ClaimController extends Controller
{
    public function __construct(
        protected ClaimService $claims,
        protected ItemReleaseService $release,
    ) {
    }

    public function index(Request $request)
    {
        $query = Claim::with(['foundItem:id,item_name,category,image_path', 'claimant:id,name']);

        // Students/faculty only ever see their own claims. Staff see everything,
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
            $filePath = $request->file('file')->store('claim-evidence', 'public');
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