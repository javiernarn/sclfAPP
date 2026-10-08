<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\AdminSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * First-login setup: the real person behind an admin-created account (and
 * the seeded Admin) enters their own ID number and details.
 */
class AccountSetupTest extends TestCase
{
    use RefreshDatabase;

    protected function pendingUser(string $role, array $attrs = []): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create($attrs + [
            'is_active' => true,
            'first_name' => 'Placeholder',
            'last_name' => 'Person',
            'password' => Hash::make('TempPass123'),
            'staff_id' => User::generateStaffId($role),
            'must_setup_profile' => true,
        ]);
        $user->assignRole($role);

        return $user;
    }

    protected function payload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'staff_id' => 'EMP-2026-0042',
            'profile_picture' => UploadedFile::fake()->image('me.jpg', 200, 200),
            'password' => 'Brand-new-Pass1',
            'password_confirmation' => 'Brand-new-Pass1',
        ], $overrides);
    }

    protected function submit(User $user, array $data)
    {
        return $this->actingAs($user)->post('/api/profile/complete-setup', $data, ['Accept' => 'application/json']);
    }

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_a_security_officer_enters_their_own_id_number_at_first_login(): void
    {
        $officer = $this->pendingUser('security_officer');
        $this->assertStringStartsWith('SEC-', $officer->staff_id);

        $this->submit($officer, $this->payload(['staff_id' => 'sec-777']))
            ->assertOk()
            ->assertJsonPath('user.staff_id', 'SEC-777')
            ->assertJsonPath('user.must_setup_profile', false);

        $fresh = $officer->fresh();
        $this->assertSame('SEC-777', $fresh->staff_id);
        $this->assertSame('Maria Santos', $fresh->name);
        $this->assertFalse($fresh->must_setup_profile);
        $this->assertTrue(Hash::check('Brand-new-Pass1', $fresh->password));
    }

    public function test_instructor_and_staff_can_set_their_id_too(): void
    {
        foreach (['instructor', 'staff'] as $i => $role) {
            $user = $this->pendingUser($role);

            $this->submit($user, $this->payload(['staff_id' => "ID-{$role}-{$i}"]))->assertOk();

            $this->assertSame(strtoupper("ID-{$role}-{$i}"), $user->fresh()->staff_id);
        }
    }

    public function test_the_id_number_is_required(): void
    {
        $officer = $this->pendingUser('security_officer');

        $this->submit($officer, $this->payload(['staff_id' => '']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('staff_id');

        $this->assertTrue($officer->fresh()->must_setup_profile);
    }

    public function test_an_id_number_already_used_by_someone_else_is_rejected(): void
    {
        $other = $this->pendingUser('instructor', ['staff_id' => 'TAKEN-001']);
        $officer = $this->pendingUser('security_officer');

        $this->submit($officer, $this->payload(['staff_id' => 'TAKEN-001']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('staff_id');

        $this->assertNotSame('TAKEN-001', $officer->fresh()->staff_id);
        $this->assertSame('TAKEN-001', $other->fresh()->staff_id);
    }

    public function test_keeping_the_generated_id_is_allowed(): void
    {
        $officer = $this->pendingUser('security_officer');
        $generated = $officer->staff_id;

        $this->submit($officer, $this->payload(['staff_id' => $generated]))->assertOk();

        $this->assertSame($generated, $officer->fresh()->staff_id);
    }

    public function test_an_id_number_with_odd_characters_is_rejected(): void
    {
        $officer = $this->pendingUser('security_officer');

        $this->submit($officer, $this->payload(['staff_id' => 'bad id!']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('staff_id');
    }

    public function test_the_admin_can_replace_id_email_and_every_other_detail(): void
    {
        $admin = $this->pendingUser('admin', ['email' => 'installer@example.test', 'staff_id' => 'ADMIN-09874589']);

        $this->submit($admin, $this->payload([
            'first_name' => 'Rosa',
            'last_name' => 'Dela Cruz',
            'staff_id' => 'ADMIN-OCC-001',
            'email' => 'Rosa.Admin@School.EDU',
            'phone_number' => '09171234567',
            'gender' => 'female',
            'address' => 'Poblacion, Opol',
        ]))->assertOk();

        $fresh = $admin->fresh();
        $this->assertSame('ADMIN-OCC-001', $fresh->staff_id);
        $this->assertSame('rosa.admin@school.edu', $fresh->email);
        $this->assertSame('Rosa Dela Cruz', $fresh->name);
        $this->assertSame('09171234567', $fresh->phone_number);
        $this->assertSame('female', $fresh->gender);
        $this->assertSame('Poblacion, Opol', $fresh->address);
        $this->assertFalse($fresh->must_setup_profile);
    }

    public function test_the_admin_must_provide_an_email_and_it_must_be_unique(): void
    {
        $admin = $this->pendingUser('admin');
        $this->pendingUser('instructor', ['email' => 'used@example.test']);

        $this->submit($admin, $this->payload())->assertStatus(422)->assertJsonValidationErrors('email');
        $this->submit($admin, $this->payload(['email' => 'used@example.test']))
            ->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_other_roles_cannot_change_their_email_during_setup(): void
    {
        $officer = $this->pendingUser('security_officer', ['email' => 'officer@example.test']);

        $this->submit($officer, $this->payload(['email' => 'hijack@example.test']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        $this->assertSame('officer@example.test', $officer->fresh()->email);
    }

    public function test_reseeding_does_not_overwrite_the_admin_or_create_a_second_one(): void
    {
        $env = [
            'INITIAL_ADMIN_EMAIL' => 'installer@example.test',
            'INITIAL_ADMIN_PASSWORD' => 'InstallerPass123',
            'INITIAL_ADMIN_NAME' => 'System Administrator',
            'INITIAL_ADMIN_ID' => 'ADMIN-09874589',
        ];
        foreach ($env as $k => $v) {
            putenv("{$k}={$v}");
            $_ENV[$k] = $v;
            $_SERVER[$k] = $v;
        }

        try {
            $this->seed(RoleSeeder::class);

            // Fresh install: admin exists and is waiting for first-login setup.
            $this->seed(AdminSeeder::class);
            $admin = User::where('email', 'installer@example.test')->firstOrFail();
            $this->assertTrue($admin->must_setup_profile);
            $this->assertSame('ADMIN-09874589', $admin->staff_id);

            // The real administrator completes setup with their own details.
            $this->submit($admin, $this->payload([
                'staff_id' => 'ADMIN-OCC-001',
                'email' => 'real.admin@school.edu',
            ]))->assertOk();

            // Re-seeding later must leave that alone and not add a 2nd admin.
            $this->seed(AdminSeeder::class);

            $this->assertSame(1, User::role('admin')->count());
            $this->assertSame('ADMIN-OCC-001', $admin->fresh()->staff_id);
            $this->assertSame('real.admin@school.edu', $admin->fresh()->email);
            $this->assertNull(User::where('email', 'installer@example.test')->first());
        } finally {
            foreach (array_keys($env) as $k) {
                putenv($k);
                unset($_ENV[$k], $_SERVER[$k]);
            }
        }
    }
}
