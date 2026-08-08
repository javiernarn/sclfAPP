<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Services\Audit\AuditLogService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class TwoFactorAuthService
{
    private const RECOVERY_CODE_COUNT = 8;

    public function __construct(
        protected TotpService $totp,
        protected AuditLogService $audit,
    ) {
    }

    /**
     * Step 1 of enrollment: generate a secret and stash it on the user
     * (unconfirmed — two_factor_confirmed_at stays null), and hand back the
     * secret + otpauth:// URI for the frontend to render as a QR code.
     * 2FA is NOT enabled yet; that only happens once confirm() succeeds.
     * Calling this again before confirming just overwrites the pending
     * secret, which is fine — nothing depended on the old one.
     */
    public function setup(User $user): array
    {
        $secret = $this->totp->generateSecret();

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        return [
            'secret' => $secret,
            'otpauth_uri' => $this->totp->provisioningUri($secret, $user->email),
        ];
    }

    /**
     * Step 2: the user proves they actually scanned the QR (and their
     * device clock is sane) by submitting a real code. On success, 2FA
     * flips on and a fresh batch of recovery codes is generated. The
     * plaintext codes are returned here ONLY — after this call returns,
     * only bcrypt hashes of them exist anywhere, matching how the
     * password itself is handled.
     */
    public function confirm(User $user, string $code): array
    {
        if (!$user->two_factor_secret) {
            throw new \RuntimeException('No pending 2FA setup for this account.');
        }

        if (!$this->totp->verify($user->two_factor_secret, $code)) {
            throw new \InvalidArgumentException('Invalid authentication code.');
        }

        $recoveryCodes = $this->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_recovery_codes' => json_encode(array_map(fn ($c) => Hash::make($c), $recoveryCodes)),
            'two_factor_confirmed_at' => now(),
        ])->save();

        $this->audit->log('auth.2fa_enabled', $user, "Two-factor authentication enabled for user #{$user->id}.");

        return $recoveryCodes;
    }

    public function disable(User $user): void
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        $this->audit->log('auth.2fa_disabled', $user, "Two-factor authentication disabled for user #{$user->id}.");
    }

    public function isEnabled(User $user): bool
    {
        return $user->two_factor_confirmed_at !== null;
    }

    /**
     * Verify a TOTP code from a user who already has 2FA enabled (the
     * login-time challenge), as opposed to confirm() which is only for
     * the initial enrollment step.
     */
    public function verifyCode(User $user, string $code): bool
    {
        if (!$this->isEnabled($user) || !$user->two_factor_secret) {
            return false;
        }

        return $this->totp->verify($user->two_factor_secret, $code);
    }

    /**
     * Consume a recovery code (single-use — the matching hash is removed
     * on success so it can't be replayed). Returns false without
     * modifying anything if the code doesn't match.
     */
    public function verifyRecoveryCode(User $user, string $code): bool
    {
        if (!$user->two_factor_recovery_codes) {
            return false;
        }

        $hashes = json_decode($user->two_factor_recovery_codes, true) ?: [];
        $code = strtoupper(trim($code));

        foreach ($hashes as $i => $hash) {
            if (Hash::check($code, $hash)) {
                unset($hashes[$i]);
                $user->forceFill([
                    'two_factor_recovery_codes' => json_encode(array_values($hashes)),
                ])->save();

                $this->audit->log(
                    'auth.2fa_recovery_code_used',
                    $user,
                    "User #{$user->id} logged in using a 2FA recovery code (" . count($hashes) . ' remaining).'
                );

                return true;
            }
        }

        return false;
    }

    private function generateRecoveryCodes(): array
    {
        return collect(range(1, self::RECOVERY_CODE_COUNT))
            ->map(fn () => strtoupper(Str::random(4) . '-' . Str::random(4)))
            ->all();
    }
}
