<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table) {
            // Why a refresh token was revoked. 'displaced' = the account
            // signed in somewhere else (single-device login), so the old
            // device can show "you were signed out because of a new login"
            // instead of the generic "session expired" message.
            $table->string('revoked_reason', 32)->nullable()->after('revoked_at');
            // Human label of the device that took over, e.g. "iPhone · Safari".
            $table->string('displaced_by', 120)->nullable()->after('revoked_reason');
        });
    }

    public function down(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table) {
            $table->dropColumn(['revoked_reason', 'displaced_by']);
        });
    }
};
