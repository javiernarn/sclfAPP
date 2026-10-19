<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Email verification is being switched on (security hardening, phase 2).
 *
 * Every account that exists TODAY signed up before verification existed, so
 * they are marked as verified now. Otherwise every current student would be
 * locked out of the app until they clicked a link in an email.
 *
 * Only accounts created after this migration have to verify their email.
 *
 * If you would rather make everyone verify, delete this migration BEFORE
 * running `php artisan migrate` (existing users will then see the "verify
 * your email" screen on their next visit and can request the link there).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->whereNull('email_verified_at')
            ->update(['email_verified_at' => now()]);
    }

    public function down(): void
    {
        // Intentionally empty: we cannot tell which accounts were verified
        // by a real click and which were backfilled here.
    }
};
