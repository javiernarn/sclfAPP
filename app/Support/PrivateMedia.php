<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;

/**
 * Profile pictures and found/lost item photos live on the PRIVATE disk
 * (storage/app/private), not the public one, so they cannot be opened by
 * guessing or sharing a /storage/... address.
 *
 * The API still returns a plain `image_url` / `profile_picture_url`, so
 * <img src> and CSS background-image keep working unchanged. That URL is now
 * a short-lived SIGNED link to GET /media/{dir}/{file}: it only works while
 * the signature is valid, and any edit to it is rejected.
 *
 * The expiry is rounded to a time bucket (sclf.media.url_ttl_hours), so the
 * same photo gets the SAME URL for hours at a time and the browser can cache
 * it. A URL is valid for between one and two buckets.
 */
class PrivateMedia
{
    /** Private disk (storage/app/private). */
    public const DISK = 'local';

    /** Only these folders can ever be served through /media. */
    public const DIRECTORIES = ['profile-pictures', 'found-items', 'lost-items'];

    /** Lets the browser reuse a response without asking again. */
    public static function bucketSeconds(): int
    {
        return max(1, (int) config('sclf.media.url_ttl_hours', 24)) * 3600;
    }

    /**
     * Signed relative URL for a stored path such as "profile-pictures/x.jpg",
     * or null when there is no usable path.
     *
     * Relative on purpose: it resolves against whatever origin served the
     * page (localhost, a dev proxy, the live domain), and the signature does
     * not depend on APP_URL matching.
     */
    public static function url(?string $path): ?string
    {
        $parts = self::split($path);
        if (! $parts) {
            return null;
        }

        $bucket = self::bucketSeconds();
        $expires = (intdiv(now()->getTimestamp(), $bucket) + 2) * $bucket;

        // Must be a date object: Laravel treats a bare int as "seconds from
        // now", which would turn this absolute timestamp into a year-2083 expiry.
        return URL::temporarySignedRoute(
            'media.show',
            Carbon::createFromTimestamp($expires),
            ['dir' => $parts[0], 'file' => $parts[1]],
            absolute: false,
        );
    }

    /**
     * Full https://... link for places a relative one cannot work, such as an
     * email. Same route and signature rules; it just carries APP_URL in front
     * (the signature covers path + query only) and lasts `$days` days, because
     * people open email days later.
     */
    public static function emailUrl(?string $path, int $days = 7): ?string
    {
        $parts = self::split($path);
        if (! $parts) {
            return null;
        }

        $relative = URL::temporarySignedRoute(
            'media.show',
            now()->addDays(max(1, $days)),
            ['dir' => $parts[0], 'file' => $parts[1]],
            absolute: false,
        );

        return rtrim((string) config('app.url'), '/') . $relative;
    }

    /** @return array{0:string,1:string}|null [directory, filename] when servable */
    public static function split(?string $path): ?array
    {
        if (! $path || ! str_contains($path, '/')) {
            return null;
        }

        [$dir, $file] = explode('/', $path, 2);

        return self::isServable($dir, $file) ? [$dir, $file] : null;
    }

    public static function isServable(string $dir, string $file): bool
    {
        return in_array($dir, self::DIRECTORIES, true)
            && preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]*$/', $file) === 1
            && ! str_contains($file, '..');
    }
}
