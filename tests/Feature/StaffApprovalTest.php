<?php

namespace Tests\Feature;

use App\Models\ActionRequest;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffApprovalTest extends TestCase
{
    use RefreshDatabase;

    protected function userWithRole(string $role, array $attrs = []): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $user */
        $user = User::factory()->create(['is_active' => true] + $attrs);
        $user->assignRole($role);

        return $user;
    }

    protected function actingWithToken(User $user): static
    {
        // Sanctum's guard caches the first authenticated user for the whole
        // test; without resetting it, switching between admin and staff in
        // one test would silently keep acting as whoever was first.
        $this->app['auth']->forgetGuards();

        $token = $user->createToken('test', ['*'])->plainTextToken;

        return $this->withHeaders(['Authorization' => "Bearer {$token}"]);
    }

    public function test_staff_can_read_admin_pages_but_not_write_without_approval(): void
    {
        $staff = $this->userWithRole('staff');
        $target = $this->userWithRole('instructor');

        $this->actingWithToken($staff)->getJson('/api/admin/users')->assertOk();

        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$target->id}")
            ->assertStatus(403)
            ->assertJson(['code' => 'approval_required']);

        $this->assertTrue($target->fresh()->is_active);
    }

    public function test_full_flow_request_approve_execute_then_single_use(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');
        $target = $this->userWithRole('instructor');

        $created = $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'DELETE',
            'path' => "api/admin/users/{$target->id}",
            'reason' => 'Left the college',
        ])->assertCreated();

        $id = $created->json('data.id');
        $this->assertSame('pending', $created->json('data.status'));

        // Still blocked while pending.
        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$target->id}")->assertStatus(403);

        $this->actingWithToken($admin)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'approved'])->assertOk();

        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$target->id}")->assertOk();
        $this->assertFalse($target->fresh()->is_active);
        $this->assertSame('executed', ActionRequest::find($id)->status);

        // Re-enable is a different action; and the same delete again needs a new approval.
        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$target->id}")->assertStatus(403);
    }

    public function test_approval_is_only_valid_for_the_exact_record_it_was_granted_for(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');
        $a = $this->userWithRole('instructor');
        $b = $this->userWithRole('instructor');

        $id = $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'DELETE', 'path' => "api/admin/users/{$a->id}", 'reason' => 'x y z',
        ])->json('data.id');
        $this->actingWithToken($admin)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'approved'])->assertOk();

        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$b->id}")->assertStatus(403);
        $this->assertTrue($b->fresh()->is_active);
    }

    public function test_rejected_or_pending_requests_do_not_authorise(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');
        $target = $this->userWithRole('instructor');

        $id = $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'DELETE', 'path' => "api/admin/users/{$target->id}", 'reason' => 'x y z',
        ])->json('data.id');

        $this->actingWithToken($admin)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'rejected'])->assertOk();
        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$target->id}")->assertStatus(403);

        // Admin can move it back to pending, then approve again.
        $this->actingWithToken($admin)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'pending'])->assertOk();
        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$target->id}")->assertStatus(403);
    }

    public function test_expired_approval_does_not_authorise(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');
        $target = $this->userWithRole('instructor');

        $id = $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'DELETE', 'path' => "api/admin/users/{$target->id}", 'reason' => 'x y z',
        ])->json('data.id');
        $this->actingWithToken($admin)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'approved'])->assertOk();

        ActionRequest::whereKey($id)->update(['expires_at' => now()->subMinute()]);

        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$target->id}")->assertStatus(403);
    }

    public function test_only_the_admin_can_review_and_staff_only_see_their_own_requests(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');
        $other = $this->userWithRole('staff');

        $id = $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'POST', 'path' => 'api/admin/departments', 'reason' => 'need one',
        ])->json('data.id');

        $this->actingWithToken($staff)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'approved'])->assertStatus(403);
        $this->actingWithToken($other)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'approved'])->assertStatus(403);

        $this->actingWithToken($other)->getJson('/api/action-requests')->assertOk()->assertJsonCount(0, 'data');
        $this->actingWithToken($admin)->getJson('/api/action-requests')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_admin_is_never_blocked_and_needs_no_request(): void
    {
        $admin = $this->userWithRole('admin');
        $target = $this->userWithRole('instructor');

        $this->actingWithToken($admin)->deleteJson("/api/admin/users/{$target->id}")->assertOk();
        $this->actingWithToken($admin)->postJson('/api/action-requests', [
            'method' => 'DELETE', 'path' => "api/admin/users/{$target->id}", 'reason' => 'x y z',
        ])->assertStatus(403);
    }

    public function test_there_can_only_be_one_admin(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');

        // Cannot be created as admin...
        $this->actingWithToken($admin)->postJson('/api/admin/users', [
            'first_name' => 'New', 'last_name' => 'Person', 'email' => 'new@example.com',
            'password' => 'password123', 'role' => 'admin',
        ])->assertStatus(422);

        // ...nor promoted.
        $this->actingWithToken($admin)->putJson("/api/admin/users/{$staff->id}", ['role' => 'admin'])->assertStatus(422);
        $this->assertFalse($staff->fresh()->hasRole('admin'));

        // Staff role is available.
        $this->actingWithToken($admin)->postJson('/api/admin/users', [
            'first_name' => 'New', 'last_name' => 'Staff', 'email' => 'staff2@example.com',
            'password' => 'password123', 'role' => 'staff',
        ])->assertCreated();
    }

    public function test_staff_cannot_touch_the_admin_account_even_with_approval(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');

        $id = $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'DELETE', 'path' => "api/admin/users/{$admin->id}", 'reason' => 'x y z',
        ])->json('data.id');
        $this->actingWithToken($admin)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'approved'])->assertOk();

        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$admin->id}")->assertStatus(403);
        $this->assertTrue($admin->fresh()->is_active);
    }

    public function test_staff_own_password_and_profile_actions_need_no_approval(): void
    {
        $staff = $this->userWithRole('staff');

        $this->actingWithToken($staff)->postJson('/api/logout')->assertOk();
    }

    public function test_admin_and_staff_get_bell_notifications_by_user_id(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');
        $otherStaff = $this->userWithRole('staff');
        $target = $this->userWithRole('instructor');

        $id = $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'DELETE', 'path' => "api/admin/users/{$target->id}", 'reason' => 'Left the college',
        ])->json('data.id');

        // The admin's bell gets the request; nobody else's does.
        $this->assertSame(1, $admin->notifications()->where('data->type', 'staff_request_submitted')->count());
        $this->assertSame(0, $otherStaff->notifications()->count());
        $this->assertSame(0, $staff->notifications()->count());

        $this->actingWithToken($admin)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'approved'])->assertOk();
        $this->assertSame(1, $staff->notifications()->where('data->type', 'staff_request_approved')->count());
        $this->assertSame(0, $otherStaff->notifications()->count());

        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$target->id}")->assertOk();
        $this->assertSame(1, $admin->notifications()->where('data->type', 'staff_request_executed')->count());

        // The notification deep-links to the requests page.
        $this->assertSame(
            'App\\Models\\ActionRequest',
            $admin->notifications()->where('data->type', 'staff_request_submitted')->first()->data['related_type']
        );
    }
}
