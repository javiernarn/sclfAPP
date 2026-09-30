<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per authenticated request (see App\Http\Middleware\TrackUserActivity).
     * This is deliberately a *separate* table from audit_logs: audit_logs is a
     * curated, human-readable trail of meaningful actions ("claim approved",
     * "asset retired", ...), written explicitly by services. This table is the
     * raw click-stream — every route hit, from every device — used purely for
     * the admin-facing "who's using the system, from where, and is any of it
     * spammy" view. Keeping them apart means turning this on/off or pruning it
     * aggressively never risks losing a real audit trail entry.
     */
    public function up(): void
    {
        Schema::create('user_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('cascade');
            $table->string('method', 10);
            $table->string('path', 255);
            $table->string('route_name', 150)->nullable();
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('device_type', 20)->nullable(); // mobile | tablet | desktop | bot | unknown
            $table->string('platform', 40)->nullable();    // Windows, macOS, Android, iOS, Linux, ...
            $table->string('browser', 40)->nullable();      // Chrome, Safari, Firefox, Edge, ...
            // Set at write time by ActivityRiskScorer — cheap to read back for
            // the admin table filter ("Flagged only") without re-aggregating
            // on every page load.
            $table->boolean('is_suspicious')->default(false);
            $table->string('flag_reason', 120)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at']);
            $table->index(['ip_address', 'created_at']);
            $table->index('is_suspicious');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_activities');
    }
};
