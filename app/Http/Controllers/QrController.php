<?php

namespace App\Http\Controllers;

use App\Models\QrRelease;
use App\Services\Release\ItemReleaseService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;
use Zxing\QrReader;

class QrController extends Controller
{
    public function __construct(protected ItemReleaseService $release)
    {
    }

    // Server-side fallback for "Upload QR Image". The browser decode
    // (qr-scanner / jsQR) is fast and works great for clean images, but
    // it's noticeably pickier than a full decoder about screenshots,
    // re-saved/recompressed photos, and our styled dot-pattern QR — all
    // of which a ZXing-ported PHP decoder (same class of robustness as
    // zbar) reads without trouble. The frontend only calls this route
    // after both client-side decode attempts have already failed, so it
    // isn't on the hot path for a normal successful scan.
    public function decodeImage(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403, 'Only Security Officers may release items.');
        }

        $request->validate([
            'image' => 'required|image|max:8192', // 8MB, matches typical phone screenshots/photos
        ]);

        $path = $request->file('image')->getRealPath();
        $text = $this->tryDecode($path);

        // khanamiryan/qrcode-detector-decoder has a well-documented weak
        // spot: it can silently fail (return false) on PNGs with an
        // alpha channel or certain color modes — exactly what a
        // canvas.toDataURL('image/png') export produces. If the direct
        // read comes back empty, flatten any transparency onto a plain
        // white background and upscale a little, then try once more
        // before giving up.
        if ($text === false || trim((string) $text) === '') {
            $normalized = $this->normalizeForDecode($path);

            if ($normalized) {
                $text = $this->tryDecode($normalized);
                @unlink($normalized);
            }
        }

        if ($text === false || $text === null || trim((string) $text) === '') {
            throw ValidationException::withMessages([
                'image' => ['Could not find a readable QR code in that image.'],
            ]);
        }

        return response()->json([
            'success' => true,
            'payload' => $text,
        ]);
    }

    private function tryDecode(string $path)
    {
        try {
            return (new QrReader($path, false))->text();
        } catch (Throwable $e) {
            return false;
        }
    }

    // Re-saves the upload as a flattened, truecolor, moderately-upscaled
    // PNG on a plain white background — sidesteps GD/alpha edge cases
    // that trip up the decoder and gives it a bit more resolution per
    // module to work with. Returns a temp file path, or null if GD
    // couldn't read the source image at all.
    private function normalizeForDecode(string $path): ?string
    {
        $raw = @file_get_contents($path);
        $source = $raw !== false ? @imagecreatefromstring($raw) : false;

        if (!$source) {
            return null;
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $scale = $width < 700 ? 2 : 1;

        $flat = imagecreatetruecolor($width * $scale, $height * $scale);
        imagefill($flat, 0, 0, imagecolorallocate($flat, 255, 255, 255));
        imagecopyresampled($flat, $source, 0, 0, 0, 0, $width * $scale, $height * $scale, $width, $height);
        imagedestroy($source);

        $tmpPath = tempnam(sys_get_temp_dir(), 'qr_') . '.png';
        imagepng($flat, $tmpPath);
        imagedestroy($flat);

        return $tmpPath;
    }

    public function scan(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403, 'Only Security Officers may release items.');
        }

        // Accepts either a single scanned QR "payload" string (camera flow)
        // or the split public_code/token pair (manual-entry fallback).
        $validated = $request->validate([
            'payload' => 'nullable|string',
            'public_code' => 'nullable|string|required_without:payload',
            'token' => 'nullable|string|required_without:payload',
        ]);

        if (!empty($validated['payload'])) {
            $parsed = QrRelease::parsePayload($validated['payload']);

            if (!$parsed) {
                throw ValidationException::withMessages([
                    'qr' => ['That QR code is not a recognized SCLF release pass.'],
                ]);
            }

            [$publicCode, $token] = [$parsed['public_code'], $parsed['token']];
        } else {
            $publicCode = $validated['public_code'];
            $token = $validated['token'];
        }

        $qr = $this->release->scanAndRelease($publicCode, $token, $request->user());

        return response()->json([
            'success' => true,
            'message' => 'Item released successfully. Case closed.',
            'data' => $qr->load([
                'claim.claimant:id,name,student_id',
                'foundItem:id,item_name,category,image_path,storage_location_id',
            ]),
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
