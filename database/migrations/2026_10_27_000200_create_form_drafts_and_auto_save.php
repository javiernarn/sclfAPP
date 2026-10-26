<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Auto Save, account-wide:
     *  - users.auto_save: the avatar-menu switch, now stored on the account so
     *    it is the same on every device (off by default, like before).
     *  - form_drafts: one draft per account per form, so a half-written report
     *    started on a phone can be finished on a laptop.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('auto_save')->default(false);
        });

        Schema::create('form_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('form_key', 40);
            $table->json('data');
            // When the person last typed (client clock, ms) — lets the browser
            // pick the newer of "this device" and "your account".
            $table->unsignedBigInteger('client_saved_at')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'form_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_drafts');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('auto_save');
        });
    }
};
