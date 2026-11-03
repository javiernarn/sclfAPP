<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Saves a profile picture on the private disk as a small, upright JPEG.
 *
 * Why: phones upload 12 MP+ photos (up to 5 MB). Stored as-is, every avatar
 * the app draws has to be decoded at full size, which iOS Safari cannot keep
 * up with - it silently stops painting the images while desktop and Android
 * browsers cope. An avatar never needs more than ~640 px.
 *
 * Falls back to storing the original untouched if GD cannot read the file,
 * so an upload is never lost because of this step.
 */
class ProfilePhotoStorage
{
    public const MAX_SIDE = 640;

    /** Stores the upload and returns the path, e.g. "profile-pictures/abc.jpg". */
    public static function store(UploadedFile $file): string
    {
        $resized = self::shrink((string) $file->getRealPath());
        if ($resized === null) {
            $path = $file->store('profile-pictures', PrivateMedia::DISK);
            $raw = @file_get_contents((string) $file->getRealPath());
            if ($path && $raw !== false) {
                self::backup($path, $raw, (string) $file->getMimeType());
            }

            return $path;
        }

        $path = 'profile-pictures/' . bin2hex(random_bytes(20)) . '.jpg';
        Storage::disk(PrivateMedia::DISK)->put($path, $resized);
        self::backup($path, $resized, 'image/jpeg');

        return $path;
    }

    /**
     * Keeps a copy in the database (see the media_blobs migration) so the photo
     * survives a host that wipes storage/ on every deploy. Best effort: a failure
     * here must never block the upload.
     */
    public static function backup(string $path, string $bytes, string $mime): void
    {
        if ($bytes === '' || strlen($bytes) > 1_500_000) {
            return;
        }
        try {
            \Illuminate\Support\Facades\DB::table('media_blobs')->updateOrInsert(
                ['path' => $path],
                ['mime' => $mime ?: 'image/jpeg', 'data' => base64_encode($bytes), 'updated_at' => now(), 'created_at' => now()]
            );
        } catch (\Throwable $e) {
            \Log::warning('media backup failed', ['path' => $path, 'error' => $e->getMessage()]);
        }
    }

    /** JPEG bytes of the picture scaled to MAX_SIDE and rotated upright, or null. */
    public static function shrink(string $path): ?string
    {
        if ($path === '' || ! is_file($path) || ! function_exists('imagecreatefromstring')) {
            return null;
        }
        $info = @getimagesize($path);
        if (! $info || ($info[0] * $info[1]) > 40_000_000) {
            return null;
        }
        $raw = @file_get_contents($path);
        $img = $raw === false ? false : @imagecreatefromstring($raw);
        if (! $img) {
            return null;
        }

        // Phones store sideways pictures with an EXIF flag; GD ignores it.
        if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
            $exif = @exif_read_data($path);
            $angle = match ((int) ($exif['Orientation'] ?? 1)) {
                3 => 180, 6 => -90, 8 => 90, default => 0,
            };
            if ($angle !== 0 && ($rot = imagerotate($img, $angle, 0xFFFFFF))) {
                $img = $rot;
            }
        }

        $w = imagesx($img);
        $h = imagesy($img);
        if (max($w, $h) > self::MAX_SIDE) {
            $nw = $w >= $h ? self::MAX_SIDE : (int) round($w * self::MAX_SIDE / $h);
            $nh = $w >= $h ? (int) round($h * self::MAX_SIDE / $w) : self::MAX_SIDE;
            if ($s = imagescale($img, $nw, $nh, IMG_BICUBIC)) {
                $img = $s;
            }
        }

        // Flatten transparency onto white (PNG/WebP) before saving as JPEG.
        $flat = imagecreatetruecolor(imagesx($img), imagesy($img));
        imagefill($flat, 0, 0, 0xFFFFFF);
        imagecopy($flat, $img, 0, 0, 0, 0, imagesx($img), imagesy($img));

        ob_start();
        imagejpeg($flat, null, 85);
        $bytes = ob_get_clean();

        return $bytes === false || $bytes === '' ? null : $bytes;
    }
}
