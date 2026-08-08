<?php

namespace App\Services\Auth;

use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Sanctum's personal access tokens don't expire by default, so a stolen
 * token is valid forever (until someone notices and revokes it manually).
 * This layers short-lived access tokens + long-lived, single-use, rotating
 * refresh tokens on top of Sanctum: the access token is what's actually
 * sent on API requests and expires quickly (15 min); the refresh token is
 * only ever sent to POST /token/refresh, is swapped for a new pair every
 * time it's used, and reuse of an already-rotated refresh token revokes
 * every token descended from that login (see rotate() below).
 */
class RefreshTokenService
{
    private const ACCESS_TOKEN_TTL_MINUTES = 15;
    private const REFRESH_TOKEN_TTL_DAYS = 30;

    /**
     * Issue a brand new access+refresh pair for a fresh login (or after a
     * successful 2FA challenge) — starts a new token family.
     */
    public function issue(User $user, ?Request $request = null, array $abilities = ['*']): array
    {
        return $this->issueForFamily($user, (string) Str::uuid(), $request, $abilities);
    }

    /**
     * Exchange a valid, not-yet-rotated refresh token for a new pair.
     * Throws RefreshTokenReuseException if the presented token was already
     * rotated or revoked (signal of a stolen/replayed token), or a plain
     * RuntimeException for "just doesn't exist" / "expired".
     */
    public function rotate(string $rawRefreshToken, ?Request $request = null): array
    {
        $hash = hash('sha256', $rawRefreshToken);
        $stored = RefreshToken::where('token_hash', $hash)->first();

        if (!$stored) {
            throw new \RuntimeException('Invalid refresh token.');
        }

        if ($stored->revoked_at !== null || $stored->rotated_at !== null) {
            // Someone presented a refresh token that's already been used
            // (or was explicitly revoked, e.g. by logout). Either the
            // legitimate client retried a request weirdly, or this token
            // was stolen and the thief and the real user are now racing
            // each other — either way, the safe move is to kill the whole
            // family and force a fresh login.
            $this->revokeFamily($stored->family_id);

            throw new RefreshTokenReuseException('Refresh token reuse detected; all sessions from this login have been revoked.');
        }

        if ($stored->expires_at->isPast()) {
            throw new \RuntimeException('Refresh token has expired.');
        }

        $stored->forceFill(['rotated_at' => now()])->save();

        if ($stored->access_token_id) {
            $stored->user->tokens()->where('id', $stored->access_token_id)->delete();
        }

        return $this->issueForFamily($stored->user, $stored->family_id, $request, ['*']);
    }

    /**
     * Revoke every token (access + refresh) descended from one login.
     */
    public function revokeFamily(string $familyId): void
    {
        $tokens = RefreshToken::where('family_id', $familyId)->get();

        foreach ($tokens as $token) {
            if ($token->access_token_id) {
                $token->user->tokens()->where('id', $token->access_token_id)->delete();
            }
        }

        RefreshToken::where('family_id', $familyId)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);
    }

    /**
     * Revoke the refresh token tied to a specific access token — used by
     * logout() so signing out of one device kills that device's refresh
     * token too, instead of leaving it valid for another 30 days.
     */
    public function revokeForAccessToken(int $accessTokenId): void
    {
        RefreshToken::where('access_token_id', $accessTokenId)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);
    }

    /**
     * Revoke every refresh token belonging to a user — used when a
     * password changes, matching the existing "revoke every other active
     * Sanctum token" behavior in AuthController::changePassword().
     */
    public function revokeAllForUser(User $user, ?int $exceptAccessTokenId = null): void
    {
        $query = RefreshToken::where('user_id', $user->id)->whereNull('revoked_at');

        if ($exceptAccessTokenId) {
            $query->where('access_token_id', '!=', $exceptAccessTokenId);
        }

        $query->update(['revoked_at' => now()]);
    }

    /**
     * Issue a short-lived, 2FA-pending-only access token (no refresh
     * token) for the window between "password correct" and "TOTP code
     * verified". Deliberately not part of any refresh-token family — it's
     * meant to die in a few minutes either way.
     */
    public function issuePendingTwoFactorToken(User $user): string
    {
        return $user->createToken(
            '2fa-pending',
            ['2fa-pending'],
            now()->addMinutes(5),
        )->plainTextToken;
    }

    private function issueForFamily(User $user, string $familyId, ?Request $request, array $abilities): array
    {
        $accessToken = $user->createToken('access-token', $abilities, now()->addMinutes(self::ACCESS_TOKEN_TTL_MINUTES));

        $rawRefreshToken = Str::random(64);

        RefreshToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $rawRefreshToken),
            'family_id' => $familyId,
            'access_token_id' => $accessToken->accessToken->id,
            'expires_at' => now()->addDays(self::REFRESH_TOKEN_TTL_DAYS),
            'user_agent' => $request?->userAgent(),
            'ip_address' => $request?->ip(),
        ]);

        return [
            'access_token' => $accessToken->plainTextToken,
            'refresh_token' => $rawRefreshToken,
            'expires_in' => self::ACCESS_TOKEN_TTL_MINUTES * 60,
        ];
    }
}
