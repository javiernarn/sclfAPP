<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each person's successful global searches (the "recent searches" list in
     * the header search box). One row per account + term; searching the same
     * term again just bumps last_searched_at instead of adding a duplicate.
     * Private to the account: every query in SearchController is scoped to
     * the signed-in user's id.
     */
    public function up(): void
    {
        Schema::create('recent_searches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('term', 60);
            $table->timestamp('last_searched_at')->useCurrent();
            $table->timestamps();

            $table->unique(['user_id', 'term']);
            $table->index(['user_id', 'last_searched_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recent_searches');
    }
};
