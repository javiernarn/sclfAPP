<?php

namespace App\Support;

/**
 * The link printed (as a QR code) on each physical visitor badge.
 *
 *   https://sclf.occph.com/visitor/{campusId}-{M07}-{signature}
 *
 * The badge itself is reused day after day, so the QR identifies the BADGE,
 * not one visit: the server looks up whoever is currently checked in with
 * that badge. The signature is an HMAC with the app key, so nobody can guess
 * or enumerate links for other badges; and because it is derived (nothing
 * stored), the same link can always be re-printed.
 */
final class VisitorBadgeLink
{
    private const SIG_LENGTH = 20;

    /** Token for a badge label such as "M-07" at a campus (null = no campus). */
    public static function token(?int $campusId, string $label): ?string
    {
        $compact = self::compact($label);
        if (! $compact) {
            return null;
        }
        $cid = (int) ($campusId ?? 0);

        return "{$cid}-{$compact}-" . self::signature($cid, $compact);
    }

    public static function url(?int $campusId, ?string $label): ?string
    {
        $token = $label ? self::token($campusId, $label) : null;

        return $token ? rtrim((string) config('app.url'), '/') . '/visitor/' . $token : null;
    }

    /**
     * Validate a token and return [campusId|null, "M-07"], or null if it was
     * not issued by this app (wrong shape or bad signature).
     */
    public static function parse(string $token): ?array
    {
        if (! preg_match('/^(\d{1,9})-([A-Z]\d{1,4})-([a-f0-9]{' . self::SIG_LENGTH . '})$/', $token, $m)) {
            return null;
        }

        if (! hash_equals(self::signature((int) $m[1], $m[2]), $m[3])) {
            return null;
        }

        return [(int) $m[1] ?: null, $m[2][0] . '-' . str_pad(substr($m[2], 1), 2, '0', STR_PAD_LEFT)];
    }

    /** "M-07" -> "M07"; anything that is not a pool badge label -> null. */
    private static function compact(string $label): ?string
    {
        $c = strtoupper(preg_replace('/[\s\-]+/', '', $label));

        return preg_match('/^[A-Z]\d{1,4}$/', $c) ? $c : null;
    }

    private static function signature(int $campusId, string $compact): string
    {
        return substr(hash_hmac('sha256', "visitor-badge|{$campusId}|{$compact}", (string) config('app.key')), 0, self::SIG_LENGTH);
    }
}
