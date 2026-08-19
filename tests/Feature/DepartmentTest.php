<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Department;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DepartmentTest extends TestCase
{
    use RefreshDatabase;

    protected function campus(): Campus
    {
        return Campus::firstOrCreate(['code' => 'MAIN'], ['name' => 'Main Campus']);
    }

    protected function admin(): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $admin */
        $admin = User::factory()->create(['is_active' => true]);
        $admin->assignRole('admin');

        return $admin;
    }

    protected function officer(): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $officer */
        $officer = User::factory()->create(['is_active' => true]);
        $officer->assignRole('security_officer');

        return $officer;
    }

    protected function authHeaders(User $user): array
    {
        $token = $user->createToken('test', ['*'])->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    public function test_admin_can_create_a_department(): void
    {
        $admin = $this->admin();
        $campus = $this->campus();

        $response = $this->withHeaders($this->authHeaders($admin))->postJson('/api/admin/departments', [
            'campus_id' => $campus->id,
            'name' => 'Registrar',
            'code' => 'REG',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('departments', ['name' => 'Registrar', 'campus_id' => $campus->id]);
    }

    public function test_non_admin_cannot_create_a_department(): void
    {
        $officer = $this->officer();
        $campus = $this->campus();

        $response = $this->withHeaders($this->authHeaders($officer))->postJson('/api/admin/departments', [
            'campus_id' => $campus->id,
            'name' => 'Registrar',
        ]);

        $response->assertStatus(403);
    }

    public function test_deleting_a_department_does_not_delete_its_users(): void
    {
        $admin = $this->admin();
        $campus = $this->campus();
        $department = Department::create(['campus_id' => $campus->id, 'name' => 'Registrar']);

        $this->seed(RoleSeeder::class);
        $staff = User::factory()->create(['is_active' => true, 'department_id' => $department->id]);
        $staff->assignRole('instructor');

        $this->withHeaders($this->authHeaders($admin))
            ->deleteJson("/api/admin/departments/{$department->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('departments', ['id' => $department->id]);
        $this->assertDatabaseHas('users', ['id' => $staff->id]); // still exists
        $this->assertNull($staff->fresh()->department_id); // link cleared, not orphaned
    }

    public function test_any_authenticated_user_can_read_the_department_reference_list(): void
    {
        $officer = $this->officer();
        $campus = $this->campus();
        Department::create(['campus_id' => $campus->id, 'name' => 'Registrar']);

        $response = $this->withHeaders($this->authHeaders($officer))->getJson('/api/departments');

        $response->assertStatus(200);
        $response->assertJsonFragment(['name' => 'Registrar']);
    }
}
