<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A per-account "user token" used in shareable dashboard links, e.g.
 *   /app/dashboard/{public_token}   (the student's own dashboard)
 *   /app/print/{public_token}       (the printed copy; its QR points here)
 *
 * It is only an identifier — it grants nothing by itself. The server still
 * checks WHO is asking (the owner, or an admin/staff/security account), so a
 * leaked or guessed token can't be used to read someone's dashboard.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('public_token', 40)->nullable()->unique()->after('id');
        });

        // Give every existing account one (withTrashed: soft-deleted rows too,
        // so restoring an account never leaves it without a token).
        DB::table('users')->whereNull('public_token')->orderBy('id')->each(function ($row) {
            DB::table('users')->where('id', $row->id)->update([
                'public_token' => bin2hex(random_bytes(16)),
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['public_token']);
            $table->dropColumn('public_token');
        });
    }
};
