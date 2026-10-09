<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records when an account last completed a sign-in. NULL means the
     * account has never signed in — that is what lets the app greet a
     * first login with "Welcome" and every later one with "Welcome back".
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_login_at')->nullable()->after('is_active');
        });

        // Accounts that existed before this column did must not be greeted
        // as brand-new on their next login. Backfill from the audit trail
        // (every successful credential check already writes 'auth.login').
        $lastLogins = DB::table('audit_logs')
            ->where('action', 'auth.login')
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->selectRaw('user_id, MAX(created_at) as last_at')
            ->get();

        foreach ($lastLogins as $row) {
            DB::table('users')->where('id', $row->user_id)->update(['last_login_at' => $row->last_at]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_login_at');
        });
    }
};
