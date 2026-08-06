<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

/**
 * One-time setup command: generates a VAPID keypair for Web Push and
 * writes it into .env. Safe to re-run, but doing so invalidates every
 * browser subscription created under the old public key (they'll silently
 * stop delivering — the frontend re-subscribes next time a user opens the
 * app with push already "enabled" locally, since the stored subscription's
 * key won't match anymore and the backend send will fail with 401/403).
 */
class GenerateVapidKeys extends Command
{
    protected $signature = 'webpush:vapid';

    protected $description = 'Generate a VAPID keypair for Web Push and write it into .env';

    public function handle(): int
    {
        $envPath = base_path('.env');

        if (!file_exists($envPath)) {
            $this->error('.env not found. Copy .env.example to .env first.');
            return self::FAILURE;
        }

        $keys = VAPID::createVapidKeys();

        $contents = file_get_contents($envPath);

        foreach (['VAPID_PUBLIC_KEY' => $keys['publicKey'], 'VAPID_PRIVATE_KEY' => $keys['privateKey']] as $key => $value) {
            $pattern = '/^' . preg_quote($key, '/') . '=.*/m';
            $line = "{$key}={$value}";

            $contents = preg_match($pattern, $contents)
                ? preg_replace($pattern, $line, $contents)
                : $contents . "\n{$line}";
        }

        file_put_contents($envPath, $contents);

        $this->info('VAPID keys generated and written to .env.');
        $this->line('Public key:  ' . $keys['publicKey']);
        $this->line('Private key: ' . $keys['privateKey']);
        $this->newLine();
        $this->comment('Run `php artisan config:clear` and restart `npm run dev` / rebuild so both back and front end pick up the new values.');

        return self::SUCCESS;
    }
}
