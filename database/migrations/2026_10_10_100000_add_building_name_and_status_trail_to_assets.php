<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Two small changes that make the asset registry easier to use:
 *
 *  - assets.building_name: the building is now typed in by the officer
 *    (like "Location"), instead of picked from the buildings table. The old
 *    building_id column stays so nothing that already points at it breaks;
 *    existing assets get their building name copied across below.
 *
 *  - asset_movements.from_status / to_status: each history row records the
 *    status the asset moved from and to ("In storage -> Assigned"), so the
 *    history can say what actually changed instead of just an action name.
 *    Older rows stay null; the UI derives the "to" status from the action.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('building_name', 150)->nullable()->after('building_id');
        });

        Schema::table('asset_movements', function (Blueprint $table) {
            $table->string('from_status', 30)->nullable()->after('action');
            $table->string('to_status', 30)->nullable()->after('from_status');
        });

        $names = DB::table('buildings')->pluck('name', 'id');
        DB::table('assets')->whereNotNull('building_id')->orderBy('id')->each(function ($asset) use ($names) {
            if (isset($names[$asset->building_id])) {
                DB::table('assets')->where('id', $asset->id)->update(['building_name' => $names[$asset->building_id]]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('asset_movements', function (Blueprint $table) {
            $table->dropColumn(['from_status', 'to_status']);
        });

        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('building_name');
        });
    }
};
