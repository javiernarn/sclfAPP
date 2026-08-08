<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Encrypted at the app layer (see User::casts()) — never
            // fillable, only ever written by TwoFactorAuthService via
            // forceFill(), so a mass-assignment bug elsewhere in the app
            // can't silently overwrite or leak a 2FA secret.
            $table->text('two_factor_secret')->nullable()->after('remember_token');
            // Holds bcrypt HASHES of the recovery codes (like a password),
            // not the plaintext codes themselves — plaintext is shown to
            // the user exactly once, at generation time, and never stored.
            $table->text('two_factor_recovery_codes')->nullable()->after('two_factor_secret');
            // Null until the user has confirmed a TOTP code against the
            // secret from /2fa/setup; that's the "2FA is actually enabled"
            // flag — having a secret alone doesn't count, since setup can
            // be abandoned mid-flow.
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_recovery_codes');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at']);
        });
    }
};
