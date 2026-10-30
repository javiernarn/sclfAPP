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
        if (!$request->user()->hasAnyRole(['security_officer', 'admin', 'staff'])) {
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
        if (!$request->user()->hasAnyRole(['security_officer', 'admin', 'staff'])) {
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
                // staff_id + profile_picture are needed even though the
                // scan result never shows them directly: they feed the
                // claimant's display_id / profile_picture_url accessors,
                // which is what the "Released to" card actually renders
                // (an instructor claimant has a staff_id, not a
                // student_id, so selecting student_id alone left the ID
                // blank whenever the claim wasn't a student's).
                'claim.claimant:id,name,student_id,staff_id,profile_picture',
                'claim.claimant.roles:id,name',
                // Item details + where it is physically stored, so the
                // officer scanning the pass knows exactly where to fetch it.
                // intake_channel decides which details the scan screen shows:
                // an online "found" report (who found it, where/when, how it
                // was verified) vs a Counter check-in (who checked it in,
                // at which counter, and the owner's own lost report).
                'foundItem:id,user_id,item_name,category,image_path,storage_location_id,security_officer_id,description,brand,color,model,unique_characteristics,details,location_found,date_found,time_found,intake_channel,verification_status,verification_notes,verified_at,created_at',
                'foundItem.securityOfficer:id,name',
                'foundItem.securityOfficer.roles:id,name',
                // The finder (online reports only — for Counter items user_id is the officer).
                'foundItem.finder:id,name,student_id,staff_id,profile_picture',
                'foundItem.finder.roles:id,name',
                // The owner's lost report the Counter hand-over was tied to, if any.
                'claim.lostItem:id,item_name,category,brand,color,model,unique_characteristics,details,description,location_lost,date_lost,time_lost',
                'foundItem.storageLocation:id,campus_id,building_id,type,status,label,room,cabinet,shelf,box,code',
                'foundItem.storageLocation.campus:id,name',
                'foundItem.storageLocation.building:id,name,code',
                // Who is staffing that counter/storage right now = who to ask.
                'foundItem.storageLocation.currentOfficers' => fn ($q) => $q->select('users.id', 'users.name'),
            ]),
        ]);
    }

    public function revoke(Request $request, QrRelease $qrRelease)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin', 'staff'])) {
            abort(403);
        }

        $qr = $this->release->revoke($qrRelease, $request->user(), $request->input('reason'));

        return response()->json(['success' => true, 'message' => 'Release code revoked.', 'data' => $qr]);
    }
}
