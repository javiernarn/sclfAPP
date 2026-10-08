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

        $this->actingWithToken($other)->getJson('/api/action-requests')->assertStatus(403);
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

    /** Notifications created in the same second tie on created_at, so look them up by type. */
    private function notificationOfType(User $user, string $type)
    {
        return $user->notifications()->where('data->type', $type)->first();
    }

    public function test_staff_cannot_manage_other_staff_or_hand_out_the_staff_role(): void
    {
        $staff = $this->userWithRole('staff');
        $otherStaff = $this->userWithRole('staff');
        $instructor = $this->userWithRole('instructor');

        // Exempt from the approval gate on purpose: these must fail on role
        // rules alone, even if an approval existed.
        $this->actingWithToken($staff)->getJson('/api/admin/users')->assertOk();

        $admin = $this->userWithRole('admin');
        foreach ([['DELETE', $otherStaff], ['PUT', $instructor]] as [$method, $target]) {
            $path = "api/admin/users/{$target->id}";
            $id = $this->actingWithToken($staff)->postJson('/api/action-requests', [
                'method' => $method, 'path' => $path, 'reason' => 'x y z',
                'payload' => ['role' => 'staff'],
            ])->json('data.id');
            $this->actingWithToken($admin)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'approved'])->assertOk();
        }

        $this->actingWithToken($staff)->deleteJson("/api/admin/users/{$otherStaff->id}")->assertStatus(403);
        $this->assertTrue($otherStaff->fresh()->is_active);

        $this->actingWithToken($staff)->putJson("/api/admin/users/{$instructor->id}", ['role' => 'staff'])->assertStatus(403);
        $this->assertFalse($instructor->fresh()->hasRole('staff'));
    }

    public function test_admin_bell_hears_about_staff_requests_and_withdrawals(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');

        $id = $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'POST', 'path' => 'api/admin/users', 'reason' => 'need a new instructor',
            'payload' => ['role' => 'instructor'],
        ])->assertCreated()->json('data.id');

        $note = $this->notificationOfType($admin, 'staff_request_submitted');
        $this->assertNotNull($note);
        $this->assertStringContainsString('Create', $note->data['title']);

        $this->actingWithToken($staff)->deleteJson("/api/action-requests/{$id}")->assertOk();

        $withdrawn = $this->notificationOfType($admin, 'staff_request_withdrawn');
        $this->assertNotNull($withdrawn);
        $this->assertSame('/app/admin/requests', $withdrawn->data['link']);
    }

    public function test_staff_create_user_is_blocked_then_allowed_once_after_approval(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');

        $body = [
            'first_name' => 'Ina', 'last_name' => 'Cruz', 'email' => 'ina.cruz@example.com',
            'password' => 'password123', 'role' => 'instructor',
        ];

        $this->actingWithToken($staff)->postJson('/api/admin/users', $body)
            ->assertStatus(403)->assertJson(['code' => 'approval_required']);

        $id = $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'POST', 'path' => 'api/admin/users', 'reason' => 'new hire',
            'payload' => ['role' => 'instructor'],
        ])->json('data.id');
        $this->actingWithToken($admin)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'approved'])->assertOk();

        $this->actingWithToken($staff)->postJson('/api/admin/users', $body)->assertCreated();
        $this->assertNotNull($this->notificationOfType($admin, 'staff_request_executed'));
    }

    public function test_staff_can_confirm_and_reject_matches_without_admin_approval(): void
    {
        $staff = $this->userWithRole('staff');

        // Matches are handled by staff directly (no approval_required gate),
        // so a missing match is a plain 404, never a 403 approval error.
        foreach (['notify-owner', 'dismiss'] as $action) {
            $response = $this->actingWithToken($staff)->postJson("/api/matches/999999/{$action}");
            $response->assertNotFound();
            $this->assertNotSame('approval_required', $response->json('code'));
        }

        // And asking the admin for approval on them is pointless.
        $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'POST', 'path' => 'api/matches/42/dismiss', 'reason' => 'please allow',
        ])->assertStatus(422);
    }

    public function test_found_item_review_and_disable_requests_get_readable_summaries_and_notify_the_admin(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');
        $target = $this->userWithRole('instructor');

        $cases = [
            ['POST', 'api/found-items/7/verify', 'Review found item report #7'],
            ['DELETE', "api/admin/users/{$target->id}", "Disable user #{$target->id}"],
        ];

        foreach ($cases as [$method, $path, $expected]) {
            $summary = $this->actingWithToken($staff)->postJson('/api/action-requests', [
                'method' => $method, 'path' => $path, 'reason' => 'please allow',
            ])->assertCreated()->json('data.summary');

            $this->assertStringContainsString($expected, $summary);
        }

        $this->assertSame(count($cases), $admin->notifications()->where('data->type', 'staff_request_submitted')->count());
    }

    public function test_approval_to_create_an_instructor_cannot_create_a_security_officer(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');

        $body = [
            'first_name' => 'Ina', 'last_name' => 'Cruz', 'email' => 'ina.cruz@example.com',
            'password' => 'password123', 'role' => 'security_officer',
        ];

        // Asking without saying which role is refused: the admin must know what they approve.
        $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'POST', 'path' => 'api/admin/users', 'reason' => 'new hire',
        ])->assertStatus(422);

        $id = $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'POST', 'path' => 'api/admin/users', 'reason' => 'new hire',
            'payload' => ['role' => 'instructor'],
        ])->assertCreated()->json('data.id');
        $this->actingWithToken($admin)->patchJson("/api/admin/action-requests/{$id}", ['status' => 'approved'])->assertOk();

        // Instructor approval, security officer attempt: refused, and the approval is NOT spent.
        $this->actingWithToken($staff)->postJson('/api/admin/users', $body)
            ->assertStatus(403)->assertJson(['code' => 'approval_mismatch']);
        $this->assertDatabaseMissing('users', ['email' => 'ina.cruz@example.com']);
        $this->assertSame('approved', ActionRequest::find($id)->status);

        // The approved role still works, exactly once.
        $this->actingWithToken($staff)->postJson('/api/admin/users', array_merge($body, ['role' => 'instructor']))->assertCreated();
        $this->assertTrue(User::where('email', 'ina.cruz@example.com')->first()->hasRole('instructor'));
        $this->assertFalse(User::where('email', 'ina.cruz@example.com')->first()->hasRole('security_officer'));
    }

    public function test_create_request_summary_names_the_requested_role(): void
    {
        $admin = $this->userWithRole('admin');
        $staff = $this->userWithRole('staff');

        $this->actingWithToken($staff)->postJson('/api/action-requests', [
            'method' => 'POST', 'path' => 'api/admin/users', 'reason' => 'new hire',
            'payload' => ['role' => 'instructor'],
        ])->assertCreated();

        $this->assertStringContainsString('Instructor', ActionRequest::first()->summary);
        $this->assertStringContainsString('Instructor', $this->notificationOfType($admin, 'staff_request_submitted')->data['message']);
    }
}
