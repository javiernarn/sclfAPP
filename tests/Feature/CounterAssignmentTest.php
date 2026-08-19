<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\StorageLocation;
use App\Models\StorageLocationOfficer;
use App\Models\User;
use App\Services\Counter\CounterAssignmentService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CounterAssignmentTest extends TestCase
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

    protected function counter(): StorageLocation
    {
        return StorageLocation::create([
            'campus_id' => $this->campus()->id,
            'type' => StorageLocation::TYPE_COUNTER,
            'label' => 'Counter 1',
            'code' => 'CTR-1',
            'is_active' => true,
        ]);
    }

    public function test_admin_can_assign_an_officer_to_a_counter(): void
    {
        $admin = $this->admin();
        $officer = $this->officer();
        $counter = $this->counter();

        $assignment = app(CounterAssignmentService::class)->assign($counter, $officer, $admin);

        $this->assertDatabaseHas('storage_location_officers', [
            'storage_location_id' => $counter->id,
            'user_id' => $officer->id,
            'assigned_by' => $admin->id,
        ]);
        $this->assertNull($assignment->unassigned_at);
    }

    public function test_assigning_the_same_officer_twice_does_not_create_a_duplicate_active_row(): void
    {
        $admin = $this->admin();
        $officer = $this->officer();
        $counter = $this->counter();

        $service = app(CounterAssignmentService::class);
        $service->assign($counter, $officer, $admin);
        $service->assign($counter, $officer, $admin);

        $this->assertSame(
            1,
            StorageLocationOfficer::where('storage_location_id', $counter->id)
                ->where('user_id', $officer->id)
                ->current()
                ->count()
        );
    }

    public function test_only_security_officer_or_admin_roles_can_be_assigned(): void
    {
        $admin = $this->admin();
        $counter = $this->counter();

        $this->seed(RoleSeeder::class);
        $student = User::factory()->create(['is_active' => true]);
        $student->assignRole('student');

        $this->expectException(ValidationException::class);

        app(CounterAssignmentService::class)->assign($counter, $student, $admin);
    }

    public function test_unassign_ends_the_active_assignment_without_deleting_history(): void
    {
        $admin = $this->admin();
        $officer = $this->officer();
        $counter = $this->counter();

        $service = app(CounterAssignmentService::class);
        $assignment = $service->assign($counter, $officer, $admin);
        $service->unassign($counter, $officer, $admin);

        $assignment->refresh();
        $this->assertNotNull($assignment->unassigned_at);
        $this->assertDatabaseHas('storage_location_officers', ['id' => $assignment->id]);
    }

    public function test_current_officers_only_returns_active_assignments(): void
    {
        $admin = $this->admin();
        $officerA = $this->officer();
        $officerB = $this->officer();
        $counter = $this->counter();

        $service = app(CounterAssignmentService::class);
        $service->assign($counter, $officerA, $admin);
        $service->assign($counter, $officerB, $admin);
        $service->unassign($counter, $officerA, $admin);

        $currentIds = $counter->currentOfficers()->pluck('users.id')->all();

        $this->assertNotContains($officerA->id, $currentIds);
        $this->assertContains($officerB->id, $currentIds);
    }

    // --- HTTP layer ---

    protected function authHeaders(User $user): array
    {
        $token = $user->createToken('test', ['*'])->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    public function test_non_admin_officer_cannot_assign_via_http(): void
    {
        $officer = $this->officer();
        $target = $this->officer();
        $counter = $this->counter();

        $response = $this->withHeaders($this->authHeaders($officer))
            ->postJson("/api/storage-locations/{$counter->id}/officers", ['user_id' => $target->id]);

        $response->assertStatus(403);
    }

    public function test_admin_can_assign_via_http(): void
    {
        $admin = $this->admin();
        $officer = $this->officer();
        $counter = $this->counter();

        $response = $this->withHeaders($this->authHeaders($admin))
            ->postJson("/api/storage-locations/{$counter->id}/officers", ['user_id' => $officer->id]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
    }

    public function test_security_officer_can_view_current_officers_via_http(): void
    {
        $admin = $this->admin();
        $officer = $this->officer();
        $counter = $this->counter();
        app(CounterAssignmentService::class)->assign($counter, $officer, $admin);

        $viewer = $this->officer();

        $response = $this->withHeaders($this->authHeaders($viewer))
            ->getJson("/api/storage-locations/{$counter->id}/officers");

        $response->assertStatus(200);
        $response->assertJsonFragment(['id' => $officer->id]);
    }
}
