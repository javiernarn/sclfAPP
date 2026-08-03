<?php

namespace App\Http\Controllers;

use App\Models\QrRelease;
use App\Services\Release\ItemReleaseService;
use Illuminate\Http\Request;

class QrController extends Controller
{
    public function __construct(protected ItemReleaseService $release)
    {
    }

    public function scan(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403, 'Only Security Officers may release items.');
        }

        $validated = $request->validate([
            'public_code' => 'required|string',
            'token' => 'required|string',
        ]);

        $qr = $this->release->scanAndRelease($validated['public_code'], $validated['token'], $request->user());

        return response()->json([
            'success' => true,
            'message' => 'Item released successfully. Case closed.',
            'data' => $qr->load('claim', 'foundItem'),
        ]);
    }

    public function revoke(Request $request, QrRelease $qrRelease)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $qr = $this->release->revoke($qrRelease, $request->user(), $request->input('reason'));

        return response()->json(['success' => true, 'message' => 'Release code revoked.', 'data' => $qr]);
    }
}
