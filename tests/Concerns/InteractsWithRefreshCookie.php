<?php

namespace Tests\Concerns;

use App\Support\RefreshCookie;
use Illuminate\Testing\TestResponse;

/**
 * The refresh token now travels in an HttpOnly cookie (see PHASE_6.md). These
 * helpers read it from a login/refresh response and send it back the way a
 * browser would.
 */
trait InteractsWithRefreshCookie
{
    /** The refresh token issued by $response (cookie in cookie mode, JSON body otherwise). */
    protected function refreshTokenFrom(TestResponse $response): ?string
    {
        $cookie = $response->getCookie(RefreshCookie::NAME, false);

        return $cookie ? $cookie->getValue() : $response->json('refresh_token');
    }

    /** POST /api/token/refresh as a browser holding $token in its cookie. */
    protected function refreshWith(?string $token, array $body = []): TestResponse
    {
        // Laravel's postJson() only sends cookies when withCredentials() is on.
        $client = $token
            ? $this->withCredentials()->withUnencryptedCookie(RefreshCookie::NAME, $token)
            : $this;

        return $client->postJson('/api/token/refresh', $body);
    }
}
