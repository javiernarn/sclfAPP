<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds the standard browser-side protections to every response.
 *
 *  - X-Content-Type-Options / X-Frame-Options / Referrer-Policy /
 *    Permissions-Policy: always.
 *  - Strict-Transport-Security: only on HTTPS requests and only when enabled.
 *  - Content-Security-Policy: only on HTML pages, and not in `local` (Vite dev
 *    server). Defaults to report-only; see config/security.php.
 *
 * CSP notes: the React build is same-origin, so scripts are 'self' only (no
 * inline or eval). Styles allow 'unsafe-inline' because the components use
 * style attributes and <style> tags. Google Fonts is allowed because
 * resources/views/app.blade.php loads it.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $mode = config('security.headers.csp', 'report-only');
        $cspActive = $mode !== 'off' && ! app()->environment('local');

        // A fresh random nonce per request. Laravel stamps it on the inline
        // Vite prefetch script (its content changes every build, so a hash
        // can never keep up) and we allow that nonce in script-src below.
        // Must be called BEFORE the view renders.
        $nonce = $cspActive ? Vite::useCspNonce() : null;

        $response = $next($request);

        $headers = $response->headers;

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        // The QR scanner needs the camera on this site only.
        $headers->set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()');

        if ($request->isSecure() && config('security.headers.hsts')) {
            $headers->set(
                'Strict-Transport-Security',
                'max-age=' . (int) config('security.headers.hsts_max_age', 31536000)
            );
        }

        if ($cspActive && $this->isHtml($response)) {
            $name = $mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
            $headers->set($name, $this->policy($request, $mode === 'enforce', $nonce));
        }

        return $response;
    }

    protected function isHtml(Response $response): bool
    {
        return str_contains((string) $response->headers->get('Content-Type'), 'text/html');
    }

    /**
     * Extra sources from .env (space separated), e.g. a third-party script host
     * or a 'sha256-...' hash. Anything that is not a plain source token is dropped
     * so a typo in .env cannot inject a new directive (no ';' or ',' allowed).
     */
    protected function extra(string $key): string
    {
        $items = preg_split('/\s+/', trim((string) config("security.headers.{$key}", '')), -1, PREG_SPLIT_NO_EMPTY);
        $items = array_filter($items, fn ($v) => preg_match("/^[A-Za-z0-9:\/\.\-\*_'+=]+$/", $v));

        return $items ? ' ' . implode(' ', $items) : '';
    }

    protected function policy(Request $request, bool $enforcing = false, ?string $nonce = null): string
    {
        $directives = [
            "default-src 'self'",
            "script-src 'self'" . ($nonce ? " 'nonce-{$nonce}'" : '') . $this->extra('csp_script_src'),
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "img-src 'self' data: blob:",
            "media-src 'self' blob:",
            "connect-src 'self'" . $this->extra('csp_connect_src'),
            // qr-scanner runs in a worker; the service worker is /sw.js.
            "worker-src 'self' blob:",
            "manifest-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ];

        // Browsers ignore this directive (and print a console warning) in a
        // report-only policy, so only send it when the policy is enforced.
        if ($enforcing && $request->isSecure()) {
            $directives[] = 'upgrade-insecure-requests';
        }

        return implode('; ', $directives);
    }
}
