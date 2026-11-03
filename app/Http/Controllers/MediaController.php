<?php

namespace App\Http\Controllers;

use App\Support\PrivateMedia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Serves profile pictures and item photos from the private disk.
 *
 * No login is needed here because an <img> tag cannot send the bearer token;
 * the `signed:relative` middleware on the route is the access check (see
 * PrivateMedia for how those links are made and how long they last).
 *
 * If the file is gone from disk (hosts that reset storage/ on each deploy) it is
 * restored from the media_blobs table when a copy exists. A 404 now says WHY in
 * its body and in the X-Media-Reason header, so it can be diagnosed from a browser.
 */
class MediaController extends Controller
{
    private const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    public function show(string $dir, string $file)
    {
        abort_unless(PrivateMedia::isServable($dir, $file), 404);

        $disk = Storage::disk(PrivateMedia::DISK);
        $path = "{$dir}/{$file}";

        if (! $disk->exists($path) && ! $this->restore($path)) {
            \Log::warning('media: file missing on private disk and no database copy', ['path' => $path]);

            return $this->notFound('missing-file');
        }

        $full = $disk->path($path);

        // Sniff the real file CONTENT (never trust the extension). finfo first; if the
        // PHP fileinfo extension is not installed, getimagesize() validates it instead.
        $mime = false;
        if (function_exists('finfo_open') && ($finfo = finfo_open(FILEINFO_MIME_TYPE))) {
            $mime = finfo_file($finfo, $full);
        }
        if (! in_array($mime, self::IMAGE_MIME, true)) {
            $info = @getimagesize($full);
            $mime = $info['mime'] ?? false;
        }
        // Never hand back anything that is not a real image, whatever the extension says.
        if (! in_array($mime, self::IMAGE_MIME, true)) {
            return $this->notFound('not-an-image');
        }

        return $disk->response($path, $file, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline',
            'X-Content-Type-Options' => 'nosniff',
            // Per-browser cache only; the URL changes when the signature bucket rolls over.
            'Cache-Control' => 'private, max-age=' . min(PrivateMedia::bucketSeconds(), 86400),
        ]);
    }

    /** Re-creates the file on disk from the database copy. */
    private function restore(string $path): bool
    {
        try {
            $row = DB::table('media_blobs')->where('path', $path)->first();
            if (! $row) {
                return false;
            }
            $bytes = base64_decode((string) $row->data, true);
            if ($bytes === false || $bytes === '') {
                return false;
            }

            return (bool) Storage::disk(PrivateMedia::DISK)->put($path, $bytes);
        } catch (\Throwable $e) {
            return false; // table not migrated yet, or DB error: behave like "missing"
        }
    }

    private function notFound(string $reason)
    {
        return response('media-' . $reason, 404, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'X-Media-Reason' => $reason,
            'Cache-Control' => 'no-store',
        ]);
    }
}
