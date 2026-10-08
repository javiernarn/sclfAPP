<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

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

        // There is only ever one Admin. Once the real administrator has
        // changed the email during first-login setup, the .env email no
        // longer matches any row — without this guard a re-seed would
        // quietly create a second admin with the old placeholder email.
        $existingAdmin = Role::where('name', 'admin')->where('guard_name', 'web')->exists()
            ? User::role('admin')->first()
            : null;

        if ($existingAdmin && $existingAdmin->email !== $email) {
            $this->command?->info("An administrator already exists ({$existingAdmin->email}); not creating another.");

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
                // The seeded account carries the installer's placeholder
                // details. The school's real administrator completes
                // SetupAccountPage on first login — Admin ID, name, email,
                // phone, photo and a new password — before anything else.
                'must_setup_profile' => true,
            ]
        );

        // Re-running the seeder must never overwrite what the real admin
        // typed in during setup. .env values are only (re)applied while the
        // account is brand new or still waiting for its first-login setup.
        if (!$admin->must_setup_profile) {
            $this->command?->info("Initial administrator already set up: {$email}");

            if (!$admin->hasRole('admin')) {
                $admin->assignRole('admin');
            }

            return;
        }

        // Keep the avatar in sync while setup is still pending.
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