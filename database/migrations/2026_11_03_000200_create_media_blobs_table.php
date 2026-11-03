<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Database copy of profile pictures. Some hosts (containers / "deploy" platforms)
 * start every release with an EMPTY storage/app/private, which made every uploaded
 * profile photo answer 404 after a redeploy. The database persists, so MediaController
 * restores the file from here when the disk copy is gone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_blobs', function (Blueprint $table) {
            $table->id();
            $table->string('path')->unique();   // e.g. profile-pictures/abc.jpg
            $table->string('mime', 60);
            $table->longText('data');           // base64 (portable across MySQL/SQLite/Postgres)
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_blobs');
    }
};
