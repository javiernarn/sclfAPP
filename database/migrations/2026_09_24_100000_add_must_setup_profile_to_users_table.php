<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Flags an admin-created staff account (instructor / security_officer
     * / admin — never student, who self-registers with their own chosen
     * credentials via AuthController::register()) as still carrying the
     * temporary password/details the admin set on their behalf. The first
     * time that account logs in, the frontend forces them through
     * SetupAccountPage before anything else is reachable (see
     * EnsureProfileSetupComplete), so the admin never ends up knowing the
     * account's real, final password/photo/name once the user has
     * personalized it.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('must_setup_profile')->default(false)->after('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('must_setup_profile');
        });
    }
};
