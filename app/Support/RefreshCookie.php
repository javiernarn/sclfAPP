<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Carries the long-lived REFRESH token in an HttpOnly cookie instead of in
 * the JSON body, so JavaScript on the page (including any injected script)
 * can never read it.
 *
 *  - HttpOnly: invisible to JavaScript.
 *  - Secure: HTTPS only (automatic whenever the request is HTTPS).
 *  - SameSite=Strict: never sent on requests started from another site.
 *  - Path=/api/token: the browser only attaches it to /api/token/refresh.
 *
 * Switch: SCLF_REFRESH_COOKIE=false puts the app back in the old mode (token
 * in the JSON body, stored by the browser app). The frontend understands
 * both, so flipping the switch needs no rebuild. See PHASE_6.md.
 */
class RefreshCookie
{
    public const NAME = 'sclf_rt';
    // Path of the token endpoints; computed per request so a subfolder install
    // (https://host/sclf/...) still works. See path().
    public const PATH = '/api/token';
    public const LIFETIME_DAYS = 30; // keep equal to RefreshTokenService::REFRESH_TOKEN_TTL_DAYS

    public static function enabled(): bool
    {
        return (bool) config('sclf.refresh_cookie.enabled', true);
    }

    /** The refresh token the browser sent in its cookie (or null). */
    public static function read(Request $request): ?string
    {
        $value = $request->cookie(self::NAME);

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * Build the JSON response for a call that issues a new token pair.
     *
     * Cookie mode: the refresh token is moved out of $payload into the cookie.
     * $remember = true gives a 30-day cookie that survives closing the
     * browser ("Keep me signed in"); false gives a session cookie that the
     * browser drops when it closes.
     */
    public static function respond(Request $request, array $payload, string $refreshToken, bool $remember, int $status = 200): JsonResponse
    {
        if (! self::enabled()) {
            $payload['refresh_token'] = $refreshToken;

            return response()->json($payload, $status);
        }

        unset($payload['refresh_token']);

        $response = response()->json($payload, $status);
        $response->headers->setCookie(self::make($request, $refreshToken, $remember));

        return $response;
    }

    /** Add a cookie that makes the browser delete the stored refresh token. */
    public static function forget(Request $request, JsonResponse $response): JsonResponse
    {
        if (self::enabled()) {
            $response->headers->setCookie(new Cookie(
                self::NAME, '', 1, self::path($request), null, self::secure($request), true, false, Cookie::SAMESITE_STRICT
            ));
        }

        return $response;
    }

    protected static function make(Request $request, string $value, bool $remember): Cookie
    {
        return new Cookie(
            self::NAME,
            $value,
            $remember ? now()->addDays(self::LIFETIME_DAYS)->getTimestamp() : 0,
            self::path($request),
            null,
            self::secure($request),
            true,   // httpOnly
            false,  // raw
            Cookie::SAMESITE_STRICT
        );
    }

    protected static function path(Request $request): string
    {
        return rtrim($request->getBasePath(), '/') . self::PATH;
    }

    protected static function secure(Request $request): bool
    {
        return $request->isSecure() || (bool) config('app.force_https');
    }
}
