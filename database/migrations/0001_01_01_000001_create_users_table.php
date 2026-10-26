<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            // Opaque, non-guessable id used in public links (QR / visitor pages).
            $table->string('public_token', 40)->nullable()->unique();

            // Identity
            $table->string('name');
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('phone_number')->nullable()->unique();
            $table->string('address')->nullable();
            $table->string('gender')->nullable();

            // Where they belong
            $table->foreignId('campus_id')->nullable()->constrained('campuses')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();

            // School / staff identifiers. `student_id` is chosen by the student at
            // registration; `staff_id` is system-generated (e.g. SEC-2026-0001) for
            // instructors, security officers and admins. A user holds one, never both.
            $table->string('student_id')->nullable()->unique();
            $table->string('staff_id')->nullable()->unique();
            $table->string('course')->nullable();          // students
            $table->string('teaching_course')->nullable(); // instructors
            $table->string('profile_picture')->nullable();

            // Authentication
            $table->string('password');
            $table->rememberToken();
            $table->text('two_factor_secret')->nullable();
            $table->text('two_factor_recovery_codes')->nullable();
            $table->timestamp('two_factor_confirmed_at')->nullable();

            // Account state
            $table->boolean('is_active')->default(true);
            $table->boolean('must_setup_profile')->default(false);
            $table->timestamp('last_login_at')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
