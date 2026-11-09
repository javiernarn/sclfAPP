<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Account-wide Auto Save drafts: one draft per account per form, so a
     * half-written report started on a phone can be finished on a laptop.
     * (The on/off switch itself is users.auto_save.)
     */
    public function up(): void
    {
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
    }
};
