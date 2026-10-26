<?php

namespace App\Console\Commands;

use App\Models\Campus;
use App\Services\Visitors\BadgePoolService;
use App\Support\VisitorBadgeLink;
use Illuminate\Console\Command;

/**
 * Writes the link that belongs in the QR code of every physical visitor badge
 * (badge label -> URL) to a CSV file, for printing the badges.
 *
 *   php artisan visitor:badge-links
 *   php artisan visitor:badge-links --campus=1 --prefix=M --out=C:\badges.csv
 */
class ExportVisitorBadgeLinks extends Command
{
    protected $signature = 'visitor:badge-links
        {--campus= : Only this campus id (default: every campus, plus "no campus" as id 0)}
        {--prefix= : Only this badge letter, e.g. M (default: all days)}
        {--out= : Output CSV path (default: storage/app/visitor-badge-links.csv)}';

    protected $description = 'Export the QR link of every visitor badge to a CSV file for printing';

    public function handle(BadgePoolService $pool): int
    {
        $campuses = $this->option('campus') !== null
            ? [(int) $this->option('campus') => null]
            : [0 => null] + Campus::query()->pluck('code', 'id')->all();
        // keep codes for the chosen campus when --campus is given
        if ($this->option('campus') !== null) {
            $id = (int) $this->option('campus');
            $campuses = [$id => Campus::query()->whereKey($id)->value('code')];
        }

        $letters = array_keys($pool->sets());
        if ($this->option('prefix')) {
            $letters = array_values(array_intersect($letters, [strtoupper($this->option('prefix'))]));
            if (! $letters) {
                $this->error('That badge letter is not configured (config/sclf.php visitor_badges.prefixes).');

                return self::FAILURE;
            }
        }

        $path = $this->option('out') ?: storage_path('app/visitor-badge-links.csv');
        $fh = fopen($path, 'w');
        fputcsv($fh, ['campus_id', 'campus_code', 'badge', 'url']);

        $rows = 0;
        foreach ($campuses as $campusId => $code) {
            foreach ($letters as $letter) {
                for ($n = 1; $n <= $pool->size(); $n++) {
                    $label = $pool->label($letter, $n);
                    fputcsv($fh, [$campusId, $code, $label, VisitorBadgeLink::url($campusId ?: null, $label)]);
                    $rows++;
                }
            }
        }
        fclose($fh);

        $this->info("Wrote {$rows} badge links to {$path}");
        $this->line('Each badge needs its own QR code made from the "url" column. Keep APP_KEY unchanged, or every printed QR stops working.');

        return self::SUCCESS;
    }
}
