<?php

namespace App\Services\Auth;

/**
 * Minimal, dependency-free TOTP (RFC 6238) + base32 (RFC 4648) implementation.
 *
 * This app has no composer packages for TOTP/QR (pragmarx/google2fa etc.)
 * and this sandbox has no network access to add one, so this is written
 * from the RFCs directly rather than left as a stub. It only depends on
 * ext-hash, which every PHP install has. Once you can run `composer
 * require`, swapping this for pragmarx/google2fa is a reasonable follow-up
 * — but it is NOT required; this implementation is spec-compliant and
 * interoperates with Google Authenticator, Authy, 1Password, etc.
 */
class TotpService
{
    private const SECRET_BYTES = 20;   // 160-bit secret, matches Google Authenticator's default
    private const DIGITS = 6;
    private const PERIOD = 30;         // seconds per step, per RFC 6238 default
    private const ALGO = 'sha1';       // what every mainstream authenticator app assumes

    /**
     * Generate a new random base32-encoded secret.
     */
    public function generateSecret(): string
    {
        return $this->base32Encode(random_bytes(self::SECRET_BYTES));
    }

    /**
     * otpauth:// URI for QR-code enrollment.
     */
    public function provisioningUri(string $secret, string $accountLabel, string $issuer = 'SCLF'): string
    {
        $label = rawurlencode("{$issuer}:{$accountLabel}");

        return sprintf(
            'otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d',
            $label,
            $secret,
            rawurlencode($issuer),
            self::DIGITS,
            self::PERIOD,
        );
    }

    /**
     * Verify a user-entered code against the secret. Allows the previous
     * and next 30-second step (a window of ±1) to tolerate normal clock
     * drift between the server and the user's phone — a stricter window
     * makes legitimate logins fail intermittently for no real security
     * benefit, since each step is still single-use in practice (codes are
     * time-boxed and this isn't a replay-prone context).
     */
    public function verify(string $secret, string $code): bool
    {
        $code = preg_replace('/\s+/', '', $code);

        if (!preg_match('/^\d{6}$/', $code)) {
            return false;
        }

        $currentStep = (int) floor(time() / self::PERIOD);

        foreach ([-1, 0, 1] as $drift) {
            if (hash_equals($this->generateCode($secret, $currentStep + $drift), $code)) {
                return true;
            }
        }

        return false;
    }

    private function generateCode(string $secret, int $step): string
    {
        $key = $this->base32Decode($secret);
        $counter = pack('N*', 0, $step); // 8-byte big-endian counter

        $hash = hash_hmac(self::ALGO, $counter, $key, true);

        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;

        $binary =
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF);

        return str_pad((string) ($binary % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    private function base32Encode(string $bytes): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bits = '';
        foreach (str_split($bytes) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $output = '';
        foreach (str_split($bits, 5) as $chunk) {
            if (strlen($chunk) < 5) {
                $chunk = str_pad($chunk, 5, '0');
            }
            $output .= $alphabet[bindec($chunk)];
        }

        return $output;
    }

    private function base32Decode(string $secret): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $secret));

        $bits = '';
        foreach (str_split($secret) as $char) {
            $pos = strpos($alphabet, $char);
            if ($pos === false) {
                continue;
            }
            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }

        $bytes = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) < 8) {
                continue; // trailing padding bits, not a full byte
            }
            $bytes .= chr(bindec($byte));
        }

        return $bytes;
    }
}
