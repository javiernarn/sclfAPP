<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lost_items', function (Blueprint $table) {
            $table->string('brand')->nullable()->after('category');
            $table->string('color')->nullable()->after('brand');
            $table->string('model')->nullable()->after('color');
            $table->string('unique_characteristics')->nullable()->after('model');
            $table->foreignId('campus_id')->nullable()->after('user_id')->constrained()->onDelete('set null');
            $table->time('time_lost')->nullable()->after('date_lost');
            $table->string('contact_info')->nullable()->after('image_path');
            $table->softDeletes();
        });

        // Existing enum was ('pending','matched','claimed','closed'). SQLite stores
        // enums as strings without a real CHECK constraint via Eloquent's default
        // grammar, so we can safely widen the accepted values at the app layer
        // (LostItem::STATUSES) without a destructive column rebuild here.
    }

    public function down(): void
    {
        Schema::table('lost_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('campus_id');
            $table->dropColumn(['brand', 'color', 'model', 'unique_characteristics', 'time_lost', 'contact_info']);
            $table->dropSoftDeletes();
        });
    }
};
