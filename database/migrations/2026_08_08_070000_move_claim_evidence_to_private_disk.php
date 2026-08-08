<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Section 3 fix: claim-evidence files were being written to the 'public'
 * disk, making every file guessable/enumerable at
 * /storage/claim-evidence/{filename} with zero auth check. New uploads
 * already go to the private 'local' disk (see ClaimController::addEvidence
 * and this migration's sibling code change), but files uploaded *before*
 * that fix still need to be physically relocated so the old public copies
 * stop being reachable.
 *
 * This only moves files referenced by an existing claim_evidence row — a
 * bare "move everything in the folder" pass could pick up something
 * unrelated. Any public-disk file not referenced by a row is left alone
 * for manual review rather than silently deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        $public = Storage::disk('public');
        $private = Storage::disk('local');

        $rows = DB::table('claim_evidence')
            ->whereNotNull('file_path')
            ->get(['id', 'file_path']);

        foreach ($rows as $row) {
            if (!$public->exists($row->file_path)) {
                continue; // already private, or never existed on the public disk
            }

            try {
                $private->put($row->file_path, $public->get($row->file_path));
                $public->delete($row->file_path);
            } catch (\Throwable $e) {
                // Don't let one bad file abort the whole migration — log it
                // and let it get caught by the admin's manual review of
                // whatever's left in public/storage/claim-evidence.
                Log::warning("Failed to migrate claim evidence #{$row->id} ({$row->file_path}) to private disk: {$e->getMessage()}");
            }
        }
    }

    public function down(): void
    {
        // Deliberately not reversible: moving evidence back to the public
        // disk would reintroduce the vulnerability this migration fixes.
    }
};
