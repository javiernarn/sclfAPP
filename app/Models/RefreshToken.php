<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefreshToken extends Model
{
    protected $fillable = [
        'user_id', 'token_hash', 'family_id', 'access_token_id',
        'expires_at', 'rotated_at', 'revoked_at', 'user_agent', 'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'rotated_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null
            && $this->rotated_at === null
            && $this->expires_at->isFuture();
    }
}
