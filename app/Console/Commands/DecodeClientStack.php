<?php

namespace App\Console\Commands;

use App\Support\StackDecoder;
use Illuminate\Console\Command;

/**
 * Turns the minified stack traces in storage/logs/client.log back into the
 * original file and line, using the private source maps that `npm run build`
 * leaves in storage/app/private/sourcemaps (never under public/).
 *
 *     php artisan client-errors:decode                 # the 5 newest logged crashes
 *     php artisan client-errors:decode --last=20
 *     php artisan client-errors:decode --stack="at https://.../main-C7U8P8xH.js:1:148213"
 *     php artisan client-errors:decode --file=stack.txt
 *
 * Read-only. A frame is decoded only when the map of the SAME build is still
 * there (file names carry a content hash, so a mismatch can never mis-decode).
 */
class DecodeClientStack extends Command
{
    protected $signature = 'client-errors:decode
        {--last=5 : How many of the newest logged crashes to decode}
        {--stack= : Decode this stack text instead of reading the log}
        {--file= : Decode the stack text in this file instead of reading the log}
        {--maps= : Directory holding the .map files (default: storage/app/private/sourcemaps)}';

    protected $description = 'Decode minified browser stack traces from client.log using the private source maps';

    public function handle(): int
    {
        $mapDir = (string) ($this->option('maps') ?: config('sclf.telemetry.sourcemap_path'));
        if (! is_dir($mapDir)) {
            $this->error("No source maps found at {$mapDir}. They are created by `npm run build` (unless SCLF_SOURCEMAPS=false).");

            return self::FAILURE;
        }
        $decoder = new StackDecoder($mapDir);

        $stack = (string) $this->option('stack');
        if ($stack === '' && $this->option('file')) {
            $path = (string) $this->option('file');
            if (! is_file($path)) {
                $this->error("File not found: {$path}");

                return self::FAILURE;
            }
            $stack = (string) file_get_contents($path);
        }
        if ($stack !== '') {
            $this->line($decoder->decode($stack));

            return self::SUCCESS;
        }

        $entries = $this->recentCrashes(max(1, (int) $this->option('last')));
        if ($entries === []) {
            $this->info('No logged browser crashes found in client.log.');

            return self::SUCCESS;
        }

        foreach ($entries as $e) {
            $this->line(sprintf('[%s] %s  %s  (%s)', $e['time'], $e['type'], $e['message'], $e['path']));
            $this->line($decoder->decode($e['stack']));
            $this->newLine();
        }

        return self::SUCCESS;
    }

    /** @return array<int, array{time:string,type:string,message:string,path:string,stack:string}> oldest first */
    private function recentCrashes(int $limit): array
    {
        $configured = (string) config('logging.channels.client.path', storage_path('logs/client.log'));
        $files = glob(dirname($configured) . '/' . pathinfo($configured, PATHINFO_FILENAME) . '*.log') ?: [];
        rsort($files); // daily files carry the date in their name: newest first

        $found = [];
        foreach ($files as $file) {
            $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            foreach (array_reverse($lines) as $line) {
                if (! preg_match('/^\[([^\]]+)\] \S+: client_error (\{.*\}) \[\]\s*$/', $line, $m)) {
                    continue;
                }
                $ctx = json_decode($m[2], true);
                if (! is_array($ctx)) {
                    continue;
                }
                $found[] = [
                    'time' => $m[1],
                    'type' => (string) ($ctx['type'] ?? ''),
                    'message' => (string) ($ctx['message'] ?? ''),
                    'path' => (string) ($ctx['path'] ?? ''),
                    'stack' => (string) ($ctx['stack'] ?? ''),
                ];
                if (count($found) >= $limit) {
                    break 2;
                }
            }
        }

        return array_reverse($found);
    }
}
