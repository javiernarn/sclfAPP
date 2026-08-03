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
