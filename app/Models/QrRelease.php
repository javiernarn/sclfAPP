<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class QrRelease extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_USED = 'used';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_REVOKED = 'revoked';

    // Prefix identifying our own QR payload format, so the scanner can
    // reject anything that isn't one of our release passes before it ever
    // touches the database (e.g. someone scans a random QR code).
    public const PAYLOAD_PREFIX = 'SCLF-RELEASE';

    protected $fillable = [
        'claim_id', 'found_item_id', 'public_code', 'token_hash',
        'status', 'expires_at', 'generated_by', 'scanned_by', 'scanned_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'scanned_at' => 'datetime',
    ];

    /**
     * Generate the raw, unhashed token to embed in the QR payload.
     * Only ever returned once, at creation time — never stored in plain form.
     */
    public static function generateRawToken(): string
    {
        return Str::random(48);
    }

    public static function hashToken(string $rawToken): string
    {
        return hash('sha256', $rawToken);
    }

    public function verifyToken(string $rawToken): bool
    {
        return hash_equals($this->token_hash, self::hashToken($rawToken));
    }

    /**
     * Build the plain-text string that gets encoded into the QR image.
     * Intentionally minimal — just the public code and the one-time raw
     * token, nothing about the student or the item. Anyone photographing
     * the QR learns nothing more than they would from the code itself;
     * all matching happens server-side after a scan.
     */
    public static function buildPayload(string $publicCode, string $rawToken): string
    {
        return self::PAYLOAD_PREFIX . '|' . $publicCode . '|' . $rawToken;
    }

    /**
     * Parse a scanned QR payload back into its parts. Returns null for
     * anything that isn't a recognized SCLF release payload (e.g. a
     * random QR code someone scanned by mistake).
     */
    public static function parsePayload(string $payload): ?array
    {
        $parts = explode('|', trim($payload));

        if (count($parts) !== 3 || $parts[0] !== self::PAYLOAD_PREFIX || $parts[1] === '' || $parts[2] === '') {
            return null;
        }

        return ['public_code' => $parts[1], 'token' => $parts[2]];
    }

    public function isValid(): bool
    {
        return $this->status === self::STATUS_PENDING && $this->expires_at->isFuture();
    }

    public function foundItem()
    {
        return $this->belongsTo(FoundItem::class);
    }

    public function claim()
    {
        return $this->belongsTo(Claim::class);
    }

    public function generator()
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public function scanner()
    {
        return $this->belongsTo(User::class, 'scanned_by');
    }
}
