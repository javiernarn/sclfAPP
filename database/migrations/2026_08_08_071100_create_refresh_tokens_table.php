<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Only a SHA-256 hash of the raw refresh token is ever stored —
            // same principle as Sanctum's own personal_access_tokens table.
            // A DB leak alone can't be used to mint a session.
            $table->string('token_hash', 64)->unique();
            // Every token born from the same login (and every token it
            // rotates into) shares a family_id. Reuse detection revokes
            // the whole family at once: if a refresh token gets stolen and
            // used after the legitimate client already rotated past it,
            // that's a strong signal the family is compromised, not just
            // the one token.
            $table->uuid('family_id');
            // The Sanctum personal_access_token id this refresh token was
            // issued alongside, so revoking the refresh token can also
            // kill the matching short-lived access token instead of
            // leaving it valid until it naturally expires.
            $table->unsignedBigInteger('access_token_id')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('rotated_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->string('user_agent')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'family_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
    }
};
