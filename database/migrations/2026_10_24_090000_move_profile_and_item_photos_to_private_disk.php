<?php

use App\Support\PrivateMedia;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * Profile pictures and found/lost item photos were written to the 'public'
 * disk, so every file was reachable by anyone at /storage/<folder>/<name>
 * with no login. New uploads now go to the private disk and are shown
 * through signed /media links (see App\Support\PrivateMedia); this moves the
 * files that already exist.
 *
 * Only files referenced by a database row are moved, and each one is copied,
 * size-checked, and only then deleted from the public disk. A file that fails
 * stays where it is (and is logged) so nothing is lost; move any stragglers
 * by hand. Files no row points at are left alone for manual review, same as
 * the claim-evidence migration.
 */
return new class extends Migration
{
    /** table => column holding the stored path */
    private const SOURCES = [
        'users' => 'profile_picture',
        'found_items' => 'image_path',
        'lost_items' => 'image_path',
    ];

    public function up(): void
    {
        $public = Storage::disk('public');
        $private = Storage::disk(PrivateMedia::DISK);

        foreach (self::SOURCES as $table => $column) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
                continue;
            }

            DB::table($table)
                ->whereNotNull($column)
                ->select(['id', $column])
                ->orderBy('id')
                ->chunkById(200, function ($rows) use ($public, $private, $table, $column) {
                    foreach ($rows as $row) {
                        $path = (string) $row->{$column};

                        // Only the folders that are served through /media.
                        if (PrivateMedia::split($path) === null || ! $public->exists($path)) {
                            continue;
                        }

                        try {
                            if (! $private->exists($path)) {
                                $private->writeStream($path, $public->readStream($path));
                            }

                            if ($private->size($path) !== $public->size($path)) {
                                throw new RuntimeException('size mismatch after copy');
                            }

                            $public->delete($path);
                        } catch (Throwable $e) {
                            Log::warning("Could not move {$table}#{$row->id} photo ({$path}) to the private disk: {$e->getMessage()}");
                        }
                    }
                });
        }
    }

    public function down(): void
    {
        // Deliberately not reversible: moving the photos back to the public
        // disk would reintroduce the exposure this migration removes.
    }
};
