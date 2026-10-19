<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Who deleted this, and as what?" for every record that soft-deletes.
 *
 * deleted_at already says WHEN. These two add WHO:
 *   - deleted_by       the account that deleted it (nulled if that account is
 *                      ever removed, so the record never blocks a user delete)
 *   - deleted_by_role  their role AT THAT MOMENT ("Administrator", "Security
 *                      Officer", "Staff", ...). Kept as text on purpose: it is
 *                      what we show people ("deleted by an Administrator"),
 *                      and it must not change if that person's role changes later.
 *
 * Filled automatically by App\Models\Concerns\RemembersWhoDeleted, and read by
 * App\Support\MissingRecordResponder to explain a deleted link instead of
 * showing a raw "No query results for model ..." error.
 * Rows deleted before this migration simply have both columns null.
 */
return new class extends Migration
{
    private array $tables = [
        'security_incidents',
        'service_requests',
        'lost_items',
        'found_items',
        'claims',
        'visitors',
        'storage_locations',
    ];

    public function up(): void
    {
        foreach ($this->tables as $name) {
            Schema::table($name, function (Blueprint $table) use ($name) {
                if (! Schema::hasColumn($name, 'deleted_by')) {
                    $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
                }
                if (! Schema::hasColumn($name, 'deleted_by_role')) {
                    $table->string('deleted_by_role', 40)->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $name) {
            Schema::table($name, function (Blueprint $table) use ($name) {
                if (Schema::hasColumn($name, 'deleted_by')) {
                    $table->dropConstrainedForeignId('deleted_by');
                }
                if (Schema::hasColumn($name, 'deleted_by_role')) {
                    $table->dropColumn('deleted_by_role');
                }
            });
        }
    }
};
