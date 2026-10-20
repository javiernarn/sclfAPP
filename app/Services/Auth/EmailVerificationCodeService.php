<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

/**
 * 6-digit email verification code, the in-app alternative to the email link.
 *
 * Only a hash of the code is kept (in the cache, no extra table), it expires
 * with the link (60 minutes), and 5 wrong tries lock it until a new email is
 * sent. Every new email replaces the previous code.
 */
class EmailVerificationCodeService
{
    public const OK = 'ok';
    public const INVALID = 'invalid';
    public const EXPIRED = 'expired';
    public const LOCKED = 'locked';

    protected const TTL_MINUTES = 60;
    protected const MAX_ATTEMPTS = 5;

    protected function key(User $user): string
    {
        return 'email-verify-code:' . $user->id;
    }

    /** Create a new code for this user and return it (plain, to be emailed). */
    public function issue(User $user): string
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Cache::put($this->key($user), [
            'hash' => Hash::make($code),
            'attempts' => 0,
        ], now()->addMinutes(self::TTL_MINUTES));

        return $code;
    }

    public function check(User $user, string $code): string
    {
        $entry = Cache::get($this->key($user));

        if (! $entry) {
            return self::EXPIRED;
        }

        if (($entry['attempts'] ?? 0) >= self::MAX_ATTEMPTS) {
            return self::LOCKED;
        }

        if (! Hash::check($code, $entry['hash'])) {
            $entry['attempts'] = ($entry['attempts'] ?? 0) + 1;
            Cache::put($this->key($user), $entry, now()->addMinutes(self::TTL_MINUTES));

            return $entry['attempts'] >= self::MAX_ATTEMPTS ? self::LOCKED : self::INVALID;
        }

        Cache::forget($this->key($user));

        return self::OK;
    }
}
