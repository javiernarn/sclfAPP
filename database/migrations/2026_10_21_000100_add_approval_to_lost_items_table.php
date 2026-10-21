<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lost_items', function (Blueprint $table) {
            $table->timestamp('approved_at')->nullable()->after('status');
            $table->foreignId('approved_by')->nullable()->after('approved_at')
                ->constrained('users')->nullOnDelete();
            $table->string('approval_note', 500)->nullable()->after('approved_by');
            $table->timestamp('broadcast_started_at')->nullable()->after('approval_note');
            $table->timestamp('broadcast_finished_at')->nullable()->after('broadcast_started_at');
            $table->unsignedInteger('broadcast_count')->default(0)->after('broadcast_finished_at');
        });

        // Reports filed before this feature are treated as already approved
        // (no email is sent for them), so the review queue starts empty
        // instead of showing every old report as pending.
        DB::table('lost_items')->whereNull('approved_at')->update(['approved_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('lost_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn([
                'approved_at', 'approval_note',
                'broadcast_started_at', 'broadcast_finished_at', 'broadcast_count',
            ]);
        });
    }
};
