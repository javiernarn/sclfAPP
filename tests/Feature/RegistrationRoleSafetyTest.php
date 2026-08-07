<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RegistrationRoleSafetyTest extends TestCase
{
    use RefreshDatabase;

    protected function seedRoles(): void
    {
        $this->artisan('db:seed', ['--class' => \Database\Seeders\RoleSeeder::class]);
    }

    /**
     * Valid base payload for the *real* public registration form
     * (AuthController::register()) — first_name/last_name, the
     * occ.lastname.firstname@gmail.com email convention, a PH mobile
     * number, the YYYY-N-NNNNN student ID format, and a required
     * profile picture. $overrides lets each test attempt its own
     * privilege-escalation payload on top of an otherwise-valid form.
     */
    protected function validRegistrationPayload(array $overrides = []): array
    {
        Storage::fake('public');

        return array_merge([
            'first_name' => 'Juan',
            'last_name' => 'Delacruz',
            'email' => 'occ.delacruz.juan@gmail.com',
            'phone_number' => '09171234567',
            'address' => '123 Sample St, Cagayan de Oro',
            'gender' => 'male',
            'student_id' => '2021-2-04062',
            'course' => 'BS Information Technology',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'profile_picture' => UploadedFile::fake()->image('avatar.jpg'),
        ], $overrides);
    }

    public function test_public_registration_ignores_a_client_supplied_admin_role(): void
    {
        $this->seedRoles();

        $response = $this->postJson('/api/register', $this->validRegistrationPayload([
            'role' => 'admin', // attempted privilege escalation
        ]));

        $response->assertStatus(201);

        $user = User::where('email', 'occ.delacruz.juan@gmail.com')->firstOrFail();

        $this->assertTrue($user->hasRole('student'));
        $this->assertFalse($user->hasRole('admin'));
    }

    public function test_public_registration_ignores_a_client_supplied_role_object(): void
    {
        $this->seedRoles();

        $response = $this->postJson('/api/register', $this->validRegistrationPayload([
            'role' => ['name' => 'admin'],
        ]));

        $response->assertStatus(201);

        $user = User::where('email', 'occ.delacruz.juan@gmail.com')->firstOrFail();
        $this->assertTrue($user->hasRole('student'));
    }

    public function test_public_registration_ignores_a_client_supplied_staff_id(): void
    {
        $this->seedRoles();

        // Staff IDs (ADM-/SEC-/INS- prefixes) are only ever generated
        // server-side by User::generateStaffId() for admin-created staff
        // accounts — a public registrant should never be able to hand
        // themselves one directly.
        $response = $this->postJson('/api/register', $this->validRegistrationPayload([
            'staff_id' => 'ADM-2026-0001',
        ]));

        $response->assertStatus(201);

        $user = User::where('email', 'occ.delacruz.juan@gmail.com')->firstOrFail();

        $this->assertTrue($user->hasRole('student'));
        $this->assertNull($user->staff_id);
    }

    public function test_disabled_account_cannot_log_in(): void
    {
        $this->seedRoles();

        $user = User::factory()->create(['is_active' => false]);
        $user->assignRole('student');

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertStatus(422);
    }
}
