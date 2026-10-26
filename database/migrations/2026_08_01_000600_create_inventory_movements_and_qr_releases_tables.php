<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('found_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('storage_location_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('moved_by')->nullable()->constrained('users')->cascadeOnDelete();
            $table->enum('action', ['stored', 'moved', 'released', 'unclaimed', 'disposed', 'restored']);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('qr_releases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('claim_id')->constrained()->cascadeOnDelete();
            $table->foreignId('found_item_id')->constrained()->cascadeOnDelete();
            $table->string('public_code')->unique();
            $table->string('token_hash');
            $table->enum('status', ['pending', 'used', 'expired', 'revoked'])->default('pending');
            $table->timestamp('expires_at');
            $table->foreignId('generated_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('scanned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('scanned_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qr_releases');
        Schema::dropIfExists('inventory_movements');
    }
};
