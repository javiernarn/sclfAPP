<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Optional photo/video evidence attached to a security incident report or
 * a service request. One polymorphic table serves both so a third report
 * type later doesn't need another migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_attachments', function (Blueprint $table) {
            $table->id();
            $table->morphs('attachable'); // attachable_type + attachable_id (indexed)
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kind', 10); // 'image' | 'video'
            $table->string('original_name');
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size'); // bytes
            $table->string('path'); // relative to the private ("local") disk
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_attachments');
    }
};
