<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Creates one known, password-fixed account per role so the Playwright
 * suite can log in as a real user through the real UI instead of faking
 * auth state. Never run this against production data.
 *
 *   php artisan db:seed --class=E2ETestSeeder
 *
 * Guarded so a stray `db:seed` in prod can't create these accounts —
 * this only runs when APP_ENV is local or testing.
 */
class E2ETestSeeder extends Seeder
{
    public const PASSWORD = 'E2ePassword!23';

    public const ACCOUNTS = [
        'student'          => 'e2e.student@example.test',
        'instructor'       => 'e2e.instructor@example.test',
        'security_officer' => 'e2e.security@example.test',
        'admin'            => 'e2e.admin@example.test',
    ];

    public function run(): void
    {
        if (!app()->environment(['local', 'testing'])) {
            $this->command?->error('E2ETestSeeder refuses to run outside local/testing environments.');
            return;
        }

        foreach (self::ACCOUNTS as $role => $email) {
            $user = User::firstOrCreate(
                ['email' => $email],
                [
                    'name' => 'E2E ' . ucfirst($role),
                    'first_name' => 'E2E',
                    'last_name' => ucfirst($role),
                    'password' => Hash::make(self::PASSWORD),
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]
            );

            // Keep credentials/state in sync on repeated seed runs.
            $user->forceFill([
                'password' => Hash::make(self::PASSWORD),
                'is_active' => true,
                'email_verified_at' => now(),
            ])->save();

            if (!$user->hasRole($role)) {
                $user->syncRoles([$role]);
            }
        }

        $this->command?->info('E2E test accounts ready: ' . implode(', ', self::ACCOUNTS));
    }
}
