<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Visitor badge pool bookkeeping.
 *
 * badge_cycles holds the current "round" per campus + weekday prefix. A
 * visitor row remembers which prefix/number/round its badge came from, so
 * "already issued this round" can be derived straight from the visitors
 * table (deleting a mistaken entry frees its badge automatically).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('badge_cycles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->nullable()->constrained()->nullOnDelete();
            $table->string('prefix', 5);
            $table->unsignedInteger('cycle')->default(1);
            $table->timestamps();

            $table->unique(['campus_id', 'prefix']);
        });

        Schema::table('visitors', function (Blueprint $table) {
            $table->string('badge_prefix', 5)->nullable()->after('badge_number');
            $table->unsignedSmallInteger('badge_seq')->nullable()->after('badge_prefix');
            $table->unsignedInteger('badge_cycle')->nullable()->after('badge_seq');

            $table->index(['campus_id', 'badge_prefix', 'badge_cycle']);
        });
    }

    public function down(): void
    {
        Schema::table('visitors', function (Blueprint $table) {
            $table->dropIndex(['campus_id', 'badge_prefix', 'badge_cycle']);
            $table->dropColumn(['badge_prefix', 'badge_seq', 'badge_cycle']);
        });

        Schema::dropIfExists('badge_cycles');
    }
};
