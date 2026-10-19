<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
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

        $mode = config('security.headers.csp', 'report-only');

        if ($mode !== 'off' && ! app()->environment('local') && $this->isHtml($response)) {
            $name = $mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
            $headers->set($name, $this->policy($request));
        }

        return $response;
    }

    protected function isHtml(Response $response): bool
    {
        return str_contains((string) $response->headers->get('Content-Type'), 'text/html');
    }

    protected function policy(Request $request): string
    {
        $directives = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "img-src 'self' data: blob:",
            "media-src 'self' blob:",
            "connect-src 'self'",
            // qr-scanner runs in a worker; the service worker is /sw.js.
            "worker-src 'self' blob:",
            "manifest-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ];

        if ($request->isSecure()) {
            $directives[] = 'upgrade-insecure-requests';
        }

        return implode('; ', $directives);
    }
}
