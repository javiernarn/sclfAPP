<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('qr_releases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('claim_id')->constrained()->onDelete('cascade');
            $table->foreignId('found_item_id')->constrained()->onDelete('cascade');

            // Opaque public identifier embedded in the QR image (e.g. SCLF-ITEM-000245).
            // Carries no sensitive data by itself.
            $table->string('public_code')->unique();

            // Hashed random token — never rendered in the QR. Scanning sends the
            // public_code + this raw token to the server for verification.
            $table->string('token_hash');

            $table->enum('status', ['pending', 'used', 'expired', 'revoked'])->default('pending');
            $table->timestamp('expires_at');

            $table->foreignId('generated_by')->constrained('users')->onDelete('cascade');
            $table->foreignId('scanned_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('scanned_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qr_releases');
    }
};
