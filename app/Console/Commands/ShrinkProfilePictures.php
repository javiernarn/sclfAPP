<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\PrivateMedia;
use App\Support\ProfilePhotoStorage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * One-off: shrinks profile pictures uploaded before resize-on-upload existed.
 * The file keeps its name/extension, so no database change is needed.
 *   php artisan profile-pictures:shrink [--dry-run]
 */
class ShrinkProfilePictures extends Command
{
    protected $signature = 'profile-pictures:shrink {--dry-run : Only report what would change}';
    protected $description = 'Downscale oversized profile pictures so iPhones can display them';

    public function handle(): int
    {
        $disk = Storage::disk(PrivateMedia::DISK);
        $done = 0;

        User::whereNotNull('profile_picture')->select('id', 'profile_picture')->chunkById(100, function ($users) use ($disk, &$done) {
            foreach ($users as $u) {
                $path = $u->profile_picture;
                if (! PrivateMedia::split($path) || ! $disk->exists($path)) {
                    continue;
                }
                $info = @getimagesize($disk->path($path));
                if (! $info || max($info[0], $info[1]) <= ProfilePhotoStorage::MAX_SIDE) {
                    continue;
                }
                $this->line("{$path}: {$info[0]}x{$info[1]}");
                if ($this->option('dry-run')) {
                    continue;
                }
                $bytes = ProfilePhotoStorage::shrink($disk->path($path));
                if ($bytes !== null) {
                    $disk->put($path, $bytes); // JPEG bytes under the old name; MediaController sniffs content
                    $done++;
                }
            }
        });

        $this->info($this->option('dry-run') ? 'Dry run finished.' : "Shrunk {$done} picture(s).");

        return self::SUCCESS;
    }
}
