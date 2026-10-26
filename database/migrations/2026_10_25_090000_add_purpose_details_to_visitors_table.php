<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Purpose-specific visit details (delivery company + items, meeting agenda,
 * work order for maintenance, ...). Stored as JSON because each purpose has
 * its own set of fields; the fields themselves are defined and validated in
 * App\Services\Visitors\PurposeDetails. Nullable so older entries stay valid.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visitors', function (Blueprint $table) {
            $table->json('purpose_details')->nullable()->after('purpose');
        });
    }

    public function down(): void
    {
        Schema::table('visitors', function (Blueprint $table) {
            $table->dropColumn('purpose_details');
        });
    }
};
