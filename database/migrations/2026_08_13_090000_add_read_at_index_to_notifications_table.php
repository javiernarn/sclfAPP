<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The base notifications table (2026_08_02_080800_create_notifications_table)
 * already indexes (notifiable_type, notifiable_id) via ->morphs(). What it
 * doesn't index is read_at — and every screen this feature adds (the
 * header bell's unread badge, its dropdown preview, and the sidebar's
 * Notifications page) runs a "this user's unread notifications" query
 * constantly: once per bell poll, on every page's mount, on every mark-
 * read action. Extending that morph index to also cover read_at lets the
 * database satisfy "unread for this notifiable" straight from the index
 * instead of pulling every row for the user and filtering read_at in
 * memory.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['notifiable_type', 'notifiable_id', 'read_at'], 'notifications_notifiable_read_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_notifiable_read_at_index');
        });
    }
};
