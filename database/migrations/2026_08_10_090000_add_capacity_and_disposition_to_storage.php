<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Phase 3: storage capacity limits + the unclaimed/disposition lifecycle
     * for found items that never get claimed.
     *
     * No doctrine/dbal in this project (see composer.json), so the
     * inventory_movements.action column can't be widened with
     * Schema::table()->change(). Unlike the storage_location_officers gap
     * from Phase 1, this one bites on SQLite too: Laravel's enum() column
     * type compiles to a real `CHECK (action IN (...))` constraint on
     * SQLite (not a plain unenforced TEXT column), so the new action
     * values ('unclaimed', 'disposed', 'restored') are rejected by the
     * test database just as they would be by MySQL's ENUM. Both drivers
     * need an explicit, driver-specific rebuild of the column.
     *
     * moved_by is also widened to nullable here: the nightly sweep runs
     * as a scheduled command with no acting user, and falls back to the
     * item's assigned security officer, which may itself be unset — so
     * the FK can legitimately be null for that one action.
     */
    public function up(): void
    {
        Schema::table('storage_locations', function (Blueprint $table) {
            // Max items this location can physically hold. Null = no
            // limit (e.g. counters, or storage locations nobody's bothered
            // to measure yet) — capacity is opt-in, not required, so
            // existing locations keep working unchanged.
            $table->unsignedInteger('capacity')->nullable()->after('status');
        });

        Schema::table('found_items', function (Blueprint $table) {
            // Set when the item is stored (or edited later by an officer):
            // the date after which an unclaimed item becomes eligible for
            // disposition. Nullable so items already in the system before
            // this migration aren't retroactively flagged.
            $table->date('retention_expires_at')->nullable()->after('storage_location_id');

            // When the retention sweep (or an officer manually) flagged
            // this item as unclaimed. Distinct from retention_expires_at
            // (the deadline) so "eligible but not yet flagged" and
            // "flagged" are both representable.
            $table->timestamp('unclaimed_at')->nullable()->after('retention_expires_at');

            // Disposition outcome once an unclaimed item is actually
            // removed from the shelf. method is kept as a plain string
            // (validated in the service layer, like counter_queue_entries'
            // purpose column) rather than a DB enum, so adding a new
            // disposition method later doesn't need a migration.
            $table->string('disposition_method')->nullable()->after('unclaimed_at');
            $table->text('disposition_notes')->nullable()->after('disposition_method');
            $table->foreignId('disposed_by')->nullable()->after('disposition_notes')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('disposed_at')->nullable()->after('disposed_by');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE inventory_movements MODIFY action ENUM('stored','moved','released','unclaimed','disposed','restored') NOT NULL"
            );
            DB::statement('ALTER TABLE inventory_movements MODIFY moved_by BIGINT UNSIGNED NULL');
        } elseif (DB::getDriverName() === 'sqlite') {
            $this->rebuildSqliteMovementsTable(
                "action TEXT NOT NULL CHECK (action IN ('stored','moved','released','unclaimed','disposed','restored'))",
                'moved_by INTEGER NULL REFERENCES users(id) ON DELETE CASCADE'
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            // Only safe to shrink the enum back if nothing's using the new
            // values — matches how this project already treats
            // down-migrations elsewhere (no data-migration on rollback).
            DB::statement(
                "ALTER TABLE inventory_movements MODIFY action ENUM('stored','moved','released') NOT NULL"
            );
            DB::statement('ALTER TABLE inventory_movements MODIFY moved_by BIGINT UNSIGNED NOT NULL');
        } elseif (DB::getDriverName() === 'sqlite') {
            $this->rebuildSqliteMovementsTable(
                "action TEXT NOT NULL CHECK (action IN ('stored','moved','released'))",
                'moved_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE'
            );
        }

        Schema::table('found_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('disposed_by');
            $table->dropColumn(['retention_expires_at', 'unclaimed_at', 'disposition_method', 'disposition_notes', 'disposed_at']);
        });

        Schema::table('storage_locations', function (Blueprint $table) {
            $table->dropColumn('capacity');
        });
    }

    /**
     * SQLite has no ALTER COLUMN / MODIFY, and Schema::table()->change()
     * needs doctrine/dbal, which isn't installed. This is SQLite's own
     * documented technique for "altering" a column: build a new table
     * with the desired definition, copy every row across, drop the old
     * table, then rename the new one into place — all other columns and
     * foreign keys are carried over unchanged.
     */
    private function rebuildSqliteMovementsTable(string $actionColumnSql, string $movedByColumnSql): void
    {
        DB::statement('PRAGMA foreign_keys=OFF');

        DB::statement(<<<SQL
            CREATE TABLE inventory_movements__new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                found_item_id INTEGER NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
                storage_location_id INTEGER NULL REFERENCES storage_locations(id) ON DELETE SET NULL,
                {$movedByColumnSql},
                {$actionColumnSql},
                notes TEXT NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL
            )
        SQL);

        DB::statement(
            'INSERT INTO inventory_movements__new '
            . '(id, found_item_id, storage_location_id, moved_by, action, notes, created_at, updated_at) '
            . 'SELECT id, found_item_id, storage_location_id, moved_by, action, notes, created_at, updated_at '
            . 'FROM inventory_movements'
        );

        DB::statement('DROP TABLE inventory_movements');
        DB::statement('ALTER TABLE inventory_movements__new RENAME TO inventory_movements');

        DB::statement('PRAGMA foreign_keys=ON');
    }
};