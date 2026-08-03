<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('item_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lost_item_id')->constrained()->onDelete('cascade');
            $table->foreignId('found_item_id')->constrained()->onDelete('cascade');
            $table->unsignedTinyInteger('score');
            $table->string('match_level'); // very_high | high | possible | low
            $table->json('score_breakdown')->nullable();

            // pending: engine produced it, nobody notified yet
            // notified: owner has been notified
            // claimed: a claim was submitted off the back of this match
            // dismissed: owner or system dismissed it as irrelevant
            $table->string('status')->default('pending');

            $table->timestamps();

            $table->unique(['lost_item_id', 'found_item_id']);
            $table->index('score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('item_matches');
    }
};
