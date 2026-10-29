<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

/**
 * Holds ONE pending "change my email" request per account.
 *
 * The 6-digit code is emailed to the NEW address, and only a hash of it is
 * kept (in the cache, no extra table) together with the address it belongs to.
 * It expires after sclf.email_change.code_ttl_minutes, 5 wrong tries lock it,
 * and a new request replaces the old one — so a code can never be used for an
 * address other than the one it was sent to.
 */
class EmailChangeService
{
    public const OK = 'ok';
    public const INVALID = 'invalid';
    public const EXPIRED = 'expired';
    public const LOCKED = 'locked';

    protected function key(User $user): string
    {
        return 'email-change:' . $user->id;
    }

    protected function ttl(): int
    {
        return max(1, (int) config('sclf.email_change.code_ttl_minutes', 15));
    }

    public function isEnabled(): bool
    {
        return (bool) config('sclf.email_change.enabled', true);
    }

    public function allowedFor(User $user): bool
    {
        return $this->isEnabled() && $user->hasAnyRole((array) config('sclf.email_change.roles', ['student', 'instructor']));
    }

    /** Start (or replace) the pending request and return the plain code to email. */
    public function issue(User $user, string $newEmail): string
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Cache::put($this->key($user), [
            'email' => $newEmail,
            'hash' => Hash::make($code),
            'attempts' => 0,
            'sent_at' => now()->timestamp,
        ], now()->addMinutes($this->ttl()));

        return $code;
    }

    /** The address a code is currently waiting for, or null. */
    public function pendingEmail(User $user): ?string
    {
        return Cache::get($this->key($user))['email'] ?? null;
    }

    /** Seconds before another code may be sent (0 = go ahead). */
    public function secondsUntilResend(User $user): int
    {
        $sentAt = Cache::get($this->key($user))['sent_at'] ?? null;
        if (! $sentAt) {
            return 0;
        }

        return max(0, (int) config('sclf.email_change.resend_after_seconds', 60) - (now()->timestamp - $sentAt));
    }

    /**
     * @return array{0: string, 1: ?string} [result, newEmail]. The address is
     *         only filled in on OK, and the pending request is then consumed.
     */
    public function check(User $user, string $code): array
    {
        $entry = Cache::get($this->key($user));

        if (! $entry) {
            return [self::EXPIRED, null];
        }

        $max = (int) config('sclf.email_change.max_attempts', 5);

        if (($entry['attempts'] ?? 0) >= $max) {
            return [self::LOCKED, null];
        }

        if (! Hash::check($code, $entry['hash'])) {
            $entry['attempts'] = ($entry['attempts'] ?? 0) + 1;
            Cache::put($this->key($user), $entry, now()->addMinutes($this->ttl()));

            return [$entry['attempts'] >= $max ? self::LOCKED : self::INVALID, null];
        }

        Cache::forget($this->key($user));

        return [self::OK, $entry['email']];
    }

    public function cancel(User $user): void
    {
        Cache::forget($this->key($user));
    }
}
