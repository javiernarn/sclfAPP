<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Email and student_id already have unique indexes (see the
     * 0001_01_01_000000_create_users_table and
     * 2026_08_02_070000_add_profile_fields_to_users_table migrations).
     * phone_number was missing the same protection — this closes that
     * gap so "same phone number, different account" can never happen at
     * the database level, on top of the app-level uniqueness checks in
     * AuthController::register / AdminCreateUserRequest.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unique('phone_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['phone_number']);
        });
    }
};
