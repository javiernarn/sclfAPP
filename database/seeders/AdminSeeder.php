<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('INITIAL_ADMIN_EMAIL');
        $password = env('INITIAL_ADMIN_PASSWORD');
        $name = env('INITIAL_ADMIN_NAME', 'System Administrator');
        $phone = env('INITIAL_ADMIN_PHONE');
        $adminId = env('INITIAL_ADMIN_ID');
        $gender = env('INITIAL_ADMIN_GENDER');   // male | female | other | prefer_not_to_say

        if (!$email || !$password) {
            $this->command?->warn(       // From ENV
                'Skipping initial admin seeder: INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD not set in .env'
            );

            return;
        }

        $admin = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'first_name' => explode(' ', $name)[0] ?? $name,
                'last_name' => trim(str_replace(explode(' ', $name)[0] ?? '', '', $name)) ?: $name,
                'password' => Hash::make($password),
                'is_active' => true,
                'email_verified_at' => now(),
                'profile_picture' => 'profile-pictures/admin-avatar.jpeg',
            ]
        );

        // Keep the avatar in sync even if the admin row already existed
        // from a previous seed run.
        if ($admin->profile_picture !== 'profile-pictures/admin-avatar.jpeg') {
            $admin->update(['profile_picture' => 'profile-pictures/admin-avatar.jpeg']);
        }

        // Phone, admin ID and gender come from .env. They are kept in sync on
        // every seed run (like the avatar), so editing .env and re-running
        // `php artisan db:seed --class=AdminSeeder` updates the existing admin.
        $details = array_filter([
            'phone_number' => $phone ?: null,
            'staff_id' => $adminId ?: null,
            'gender' => $gender ? strtolower(str_replace(' ', '_', trim($gender))) : null,
        ], fn ($v) => $v !== null);

        if ($details) {
            $admin->fill($details)->save();
        }

        if (!$admin->hasRole('admin')) {
            $admin->assignRole('admin');
        }

        $this->command?->info("Initial administrator ready: {$email}");
    }
}