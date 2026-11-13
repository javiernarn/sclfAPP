<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\IpUtils;
use Symfony\Component\HttpFoundation\Response;

/**
 * Behind Cloudflare -> host proxy, the host's proxy overwrites X-Forwarded-For
 * with its own internal address (e.g. 10.0.0.2), so $request->ip() was the same
 * for every visitor. Cloudflare's CF-Connecting-IP still carries the real one.
 *
 * The header is only believed when the direct peer is a private/internal
 * address (our host's proxy), so a visitor cannot spoof it by hitting the
 * app directly from the internet.
 */
class UseCloudflareClientIp
{
    private const INTERNAL = [
        '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
        '127.0.0.0/8', '100.64.0.0/10', 'fc00::/7', '::1/128',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $client = trim((string) $request->header('CF-Connecting-IP'));
        $peer = (string) $request->server->get('REMOTE_ADDR');

        if (
            $client !== ''
            && filter_var($client, FILTER_VALIDATE_IP)
            && IpUtils::checkIp($peer, self::INTERNAL)
        ) {
            // ip() reads X-Forwarded-For via the trusted proxy list; give it the real address.
            $request->headers->set('X-Forwarded-For', $client);
        }

        return $next($request);
    }
}
