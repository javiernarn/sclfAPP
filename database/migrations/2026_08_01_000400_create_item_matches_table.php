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
            $table->foreignId('lost_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('found_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('score');
            $table->string('match_level'); // very_high | high | possible | low
            $table->json('score_breakdown')->nullable();
            $table->json('score_details')->nullable();
            $table->timestamp('scored_at')->nullable();
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
