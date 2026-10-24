<?php

namespace App\Http\Controllers;

use App\Support\PrivateMedia;
use Illuminate\Support\Facades\Storage;

/**
 * Serves profile pictures and item photos from the private disk.
 *
 * No login is needed here because an <img> tag cannot send the bearer token;
 * the `signed:relative` middleware on the route is the access check (see
 * PrivateMedia for how those links are made and how long they last).
 */
class MediaController extends Controller
{
    private const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    public function show(string $dir, string $file)
    {
        abort_unless(PrivateMedia::isServable($dir, $file), 404);

        $disk = Storage::disk(PrivateMedia::DISK);
        $path = "{$dir}/{$file}";
        abort_unless($disk->exists($path), 404);

        // Sniff the real file CONTENT. Flysystem's mimeType() falls back to the
        // file extension when the content looks like plain text, so a text file
        // named x.jpg would otherwise pass as image/jpeg.
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = $finfo ? finfo_file($finfo, $disk->path($path)) : false;
        // Never hand back anything that is not a real image, whatever the extension says.
        abort_unless(in_array($mime, self::IMAGE_MIME, true), 404);

        return $disk->response($path, $file, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline',
            'X-Content-Type-Options' => 'nosniff',
            // Per-browser cache only; the URL changes when the signature bucket rolls over.
            'Cache-Control' => 'private, max-age=' . min(PrivateMedia::bucketSeconds(), 86400),
        ]);
    }
}
