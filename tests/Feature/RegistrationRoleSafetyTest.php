<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationRoleSafetyTest extends TestCase
{
    use RefreshDatabase;

    protected function seedRoles(): void
    {
        $this->artisan('db:seed', ['--class' => \Database\Seeders\RoleSeeder::class]);
    }

    public function test_public_registration_ignores_a_client_supplied_admin_role(): void
    {
        $this->seedRoles();

        $response = $this->postJson('/api/register', [
            'name' => 'Malicious User',
            'email' => 'malicious@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'admin', // attempted privilege escalation
        ]);

        $response->assertStatus(201);

        $user = User::where('email', 'malicious@example.com')->firstOrFail();

        $this->assertTrue($user->hasRole('student'));
        $this->assertFalse($user->hasRole('admin'));
    }

    public function test_public_registration_ignores_a_client_supplied_role_object(): void
    {
        $this->seedRoles();

        $response = $this->postJson('/api/register', [
            'name' => 'Sneaky User',
            'email' => 'sneaky@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => ['name' => 'admin'],
        ]);

        $response->assertStatus(201);

        $user = User::where('email', 'sneaky@example.com')->firstOrFail();
        $this->assertTrue($user->hasRole('student'));
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
