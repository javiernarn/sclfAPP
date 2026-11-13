<?php

namespace App\Support;

/**
 * Cleans what a browser sends to POST /api/client-errors before it is logged.
 *
 * The browser is untrusted, so the server is the one that guarantees no
 * personal data reaches the log, whatever the client did or did not strip:
 *   - URLs keep only the path (no query string, no #fragment, no host);
 *     numeric / uuid / long-token path segments become ":id".
 *   - e-mail addresses, long digit runs (phone / student numbers) and long
 *     token-like strings inside messages and stack traces are masked.
 *   - control characters are dropped and every field has a hard length limit.
 */
class ClientTelemetry
{
    public static function text(mixed $value, int $max): string
    {
        if (! is_scalar($value)) {
            return '';
        }

        $s = mb_scrub((string) $value);
        // Drop control characters except newline and tab.
        $s = (string) preg_replace('/[^\P{C}\n\t]/u', '', $s);
        // URLs inside text: keep scheme+host+path, drop ?query and #fragment.
        $s = (string) preg_replace('~(https?://[^\s)\'"?#]+)[?#][^\s)\'"]*~i', '$1', $s);
        $s = (string) preg_replace('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', '[email]', $s);
        $s = (string) preg_replace('/\b[A-Za-z0-9_\-]{32,}\b/', '[token]', $s);

        // Minified bundles are one very long line, so a frame such as
        // "main-C7U8P8xH.js:1:148213" has a 6-digit column that the phone-number
        // mask below would wipe, making the crash impossible to decode. Keep the
        // line:column of script frames; every other long digit run is still masked.
        $frames = [];
        $s = (string) preg_replace_callback('~(\.(?:m?js|jsx)):(\d{1,6}):(\d{1,8})(?=[)\s]|$)~', function (array $m) use (&$frames) {
            $frames[] = $m[1] . ':' . $m[2] . ':' . $m[3];

            return "\u{27E6}" . (count($frames) - 1) . "\u{27E7}";
        }, $s);
        $s = (string) preg_replace('/\d{6,}/', '[num]', $s);
        $s = (string) preg_replace_callback('/\x{27E6}(\d+)\x{27E7}/u', fn (array $m) => $frames[(int) $m[1]] ?? '', $s);

        return mb_substr($s, 0, $max);
    }

    /** A page address reduced to a safe, low-cardinality path such as /app/claims/:id. */
    public static function path(mixed $value): string
    {
        if (! is_string($value) || $value === '') {
            return '';
        }

        $path = parse_url(mb_scrub($value), PHP_URL_PATH);
        if (! is_string($path) || $path === '') {
            return '';
        }

        $segments = array_map(function (string $seg) {
            if ($seg === '') {
                return $seg;
            }
            $isId = ctype_digit($seg)
                || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $seg)
                || preg_match('/^[A-Za-z0-9_\-]{24,}$/', $seg);

            return $isId ? ':id' : mb_substr((string) preg_replace('/[^\P{C}]/u', '', $seg), 0, 60);
        }, explode('/', $path));

        return mb_substr(implode('/', $segments), 0, 160);
    }

    /** Same bug => same fingerprint, so a repeating error is logged once per window. */
    public static function fingerprint(string $type, string $message, string $stack): string
    {
        $firstFrame = strtok($stack, "\n") ?: '';
        // Line numbers move with every build; only the shape of the error matters.
        $shape = preg_replace('/\d+/', '#', $type . '|' . $message . '|' . $firstFrame);

        return substr(sha1((string) $shape), 0, 20);
    }
}
