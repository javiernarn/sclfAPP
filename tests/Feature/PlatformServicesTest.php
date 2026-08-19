<?php

namespace Tests\Feature;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\LostItem;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PlatformServicesTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    // --- Analytics ---

    public function test_a_student_cannot_view_the_analytics_overview(): void
    {
        $student = $this->makeUser('student');

        $response = $this->actingAs($student)->getJson('/api/analytics/overview');

        $response->assertStatus(403);
    }

    public function test_analytics_overview_reports_recovery_rate_for_staff(): void
    {
        $officer = $this->makeUser('security_officer');
        LostItem::factory()->create(['status' => LostItem::STATUS_CLOSED]);
        LostItem::factory()->create(['status' => LostItem::STATUS_PENDING]);

        $response = $this->actingAs($officer)->getJson('/api/analytics/overview');

        $response->assertStatus(200)
            ->assertJsonStructure(['recovery_rate', 'total_lost', 'total_found', 'found_reports', 'counter']);
        $this->assertEquals(50.0, $response->json('recovery_rate'));
    }

    public function test_analytics_overview_separates_online_reports_from_counter_intake(): void
    {
        $officer = $this->makeUser('security_officer');
        FoundItem::factory()->create(['intake_channel' => FoundItem::CHANNEL_ONLINE_REPORT]);
        FoundItem::factory()->create(['intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE]);
        FoundItem::factory()->create(['intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE]);

        $response = $this->actingAs($officer)->getJson('/api/analytics/overview');

        $response->assertStatus(200);
        $this->assertEquals(1, $response->json('found_reports.total'));
        $this->assertEquals(2, $response->json('counter.total'));
    }

    public function test_analytics_overview_counts_high_risk_claims(): void
    {
        $officer = $this->makeUser('security_officer');
        $claimant = $this->makeUser('student');
        $found = FoundItem::factory()->create();

        Claim::create([
            'found_item_id' => $found->id,
            'claimant_id' => $claimant->id,
            'status' => Claim::STATUS_PENDING,
            'risk_score' => 60,
        ]);
        Claim::create([
            'found_item_id' => FoundItem::factory()->create()->id,
            'claimant_id' => $claimant->id,
            'status' => Claim::STATUS_PENDING,
            'risk_score' => 10,
        ]);

        $response = $this->actingAs($officer)->getJson('/api/analytics/overview');

        $response->assertStatus(200)->assertJson(['suspicious_claims' => 1]);
    }

    public function test_categories_endpoint_is_staff_only_and_groups_by_category(): void
    {
        $student = $this->makeUser('student');
        $this->actingAs($student)->getJson('/api/analytics/categories')->assertStatus(403);

        $officer = $this->makeUser('security_officer');
        LostItem::factory()->create(['category' => 'Electronics']);
        LostItem::factory()->create(['category' => 'Electronics']);
        LostItem::factory()->create(['category' => 'Keys']);

        $response = $this->actingAs($officer)->getJson('/api/analytics/categories');

        $response->assertStatus(200);
        $electronics = collect($response->json())->firstWhere('category', 'Electronics');
        $this->assertEquals(2, $electronics['total']);
    }

    public function test_monthly_endpoint_returns_six_months_of_data(): void
    {
        $officer = $this->makeUser('security_officer');

        $response = $this->actingAs($officer)->getJson('/api/analytics/monthly');

        $response->assertStatus(200);
        $this->assertCount(6, $response->json());
    }

    // --- Audit Log ---

    public function test_only_admin_can_view_the_audit_log(): void
    {
        $officer = $this->makeUser('security_officer');

        $response = $this->actingAs($officer)->getJson('/api/audit-logs');

        $response->assertStatus(403);
    }

    public function test_admin_can_filter_the_audit_log_by_action(): void
    {
        $admin = $this->makeUser('admin');
        $audit = app(AuditLogService::class);
        $audit->log('auth.login', null, 'Test login event.', null, null, $admin);
        $audit->log('user.updated', null, 'Test update event.', null, null, $admin);

        $response = $this->actingAs($admin)->getJson('/api/audit-logs?action=auth.login');

        $response->assertStatus(200);
        $this->assertTrue(
            collect($response->json('data'))->every(fn ($row) => $row['action'] === 'auth.login')
        );
    }

    public function test_admin_can_filter_the_audit_log_by_user(): void
    {
        $admin = $this->makeUser('admin');
        $student = $this->makeUser('student');
        $audit = app(AuditLogService::class);
        $audit->log('user.registered', $student, 'Test event for student.', null, null, $student);
        $audit->log('user.registered', null, 'Test event for nobody.', null, null, $admin);

        $response = $this->actingAs($admin)->getJson("/api/audit-logs?user_id={$student->id}");

        $response->assertStatus(200);
        $this->assertTrue(
            collect($response->json('data'))->every(fn ($row) => $row['user_id'] === $student->id)
        );
    }

    // --- Notifications ---

    public function test_notification_index_reports_unread_count(): void
    {
        $student = $this->makeUser('student');

        $response = $this->actingAs($student)->getJson('/api/notifications');

        $response->assertStatus(200)->assertJsonStructure(['unread_count', 'notifications']);
    }

    public function test_marking_a_notification_read_only_affects_the_owner(): void
    {
        $student = $this->makeUser('student');
        $otherStudent = $this->makeUser('student');

        $student->notify(new \App\Notifications\SclfNotification(
            \App\Notifications\SclfNotification::TYPE_CLAIM_APPROVED,
            'Test title',
            'Test message',
            \App\Models\Claim::class,
            1,
        ));

        $notificationId = $student->notifications()->first()->id;

        $response = $this->actingAs($otherStudent)->postJson("/api/notifications/{$notificationId}/read");
        $response->assertStatus(404);

        $ownResponse = $this->actingAs($student)->postJson("/api/notifications/{$notificationId}/read");
        $ownResponse->assertStatus(200);
        $this->assertNotNull($student->notifications()->first()->read_at);
    }

    public function test_mark_all_read_clears_every_unread_notification(): void
    {
        $student = $this->makeUser('student');

        foreach (range(1, 3) as $i) {
            $student->notify(new \App\Notifications\SclfNotification(
                \App\Notifications\SclfNotification::TYPE_CLAIM_APPROVED,
                "Title {$i}",
                "Message {$i}",
                \App\Models\Claim::class,
                $i,
            ));
        }

        $this->assertEquals(3, $student->unreadNotifications()->count());

        $response = $this->actingAs($student)->postJson('/api/notifications/read-all');

        $response->assertStatus(200);
        $this->assertEquals(0, $student->unreadNotifications()->count());
    }

    // --- Push Subscriptions ---

    public function test_subscribing_stores_the_push_subscription_for_the_user(): void
    {
        $student = $this->makeUser('student');

        $response = $this->actingAs($student)->postJson('/api/push/subscribe', [
            'endpoint' => 'https://push.example.com/abc123',
            'keys' => [
                'p256dh' => 'fake-p256dh-key',
                'auth' => 'fake-auth-key',
            ],
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('push_subscriptions', ['user_id' => $student->id]);
    }

    public function test_resubscribing_the_same_endpoint_updates_rather_than_duplicates(): void
    {
        $student = $this->makeUser('student');
        $payload = [
            'endpoint' => 'https://push.example.com/abc123',
            'keys' => ['p256dh' => 'key-one', 'auth' => 'auth-one'],
        ];

        $this->actingAs($student)->postJson('/api/push/subscribe', $payload)->assertStatus(200);
        $this->actingAs($student)->postJson('/api/push/subscribe', array_merge($payload, [
            'keys' => ['p256dh' => 'key-two', 'auth' => 'auth-two'],
        ]))->assertStatus(200);

        $this->assertEquals(1, $student->pushSubscriptions()->count());
        $this->assertEquals('key-two', $student->pushSubscriptions()->first()->public_key);
    }

    public function test_unsubscribing_removes_the_matching_subscription(): void
    {
        $student = $this->makeUser('student');
        $this->actingAs($student)->postJson('/api/push/subscribe', [
            'endpoint' => 'https://push.example.com/abc123',
            'keys' => ['p256dh' => 'key', 'auth' => 'auth'],
        ]);

        $response = $this->actingAs($student)->postJson('/api/push/unsubscribe', [
            'endpoint' => 'https://push.example.com/abc123',
        ]);

        $response->assertStatus(200);
        $this->assertEquals(0, $student->pushSubscriptions()->count());
    }

    public function test_push_status_reports_ownership_of_a_given_endpoint(): void
    {
        $student = $this->makeUser('student');
        $this->actingAs($student)->postJson('/api/push/subscribe', [
            'endpoint' => 'https://push.example.com/mine',
            'keys' => ['p256dh' => 'key', 'auth' => 'auth'],
        ]);

        $mine = $this->actingAs($student)->getJson('/api/push/status?endpoint=https://push.example.com/mine');
        $mine->assertStatus(200)->assertJson(['owned_by_current_user' => true]);

        $notMine = $this->actingAs($student)->getJson('/api/push/status?endpoint=https://push.example.com/someone-elses');
        $notMine->assertStatus(200)->assertJson(['owned_by_current_user' => false]);
    }

    // --- Password Reset ---

    public function test_find_account_reports_no_match_for_an_unknown_email(): void
    {
        $response = $this->postJson('/api/password/find-account', ['email' => 'nobody@example.com']);

        $response->assertStatus(404)->assertJson(['success' => false]);
    }

    public function test_find_account_returns_masked_details_for_a_known_email(): void
    {
        $this->makeUser('student')->update(['email' => 'jane@example.com', 'first_name' => 'Jane', 'last_name' => 'Doe']);

        $response = $this->postJson('/api/password/find-account', ['email' => 'jane@example.com']);

        $response->assertStatus(200)->assertJson(['success' => true]);
        $this->assertEquals('jane@example.com', $response->json('data.email'));
    }

    public function test_find_account_locks_out_after_five_attempts(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/password/find-account', ['email' => 'nobody@example.com'])->assertStatus(404);
        }

        $response = $this->postJson('/api/password/find-account', ['email' => 'nobody@example.com']);

        $response->assertStatus(429);
    }

    public function test_send_reset_link_rejects_an_unknown_email(): void
    {
        $response = $this->postJson('/api/forgot-password', ['email' => 'nobody@example.com']);

        $response->assertStatus(404)->assertJson(['success' => false]);
    }

    public function test_reset_password_with_a_valid_token_updates_the_password(): void
    {
        $user = $this->makeUser('student');
        $user->update(['email' => 'jane@example.com']);

        $token = Password::createToken($user);

        $response = $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'jane@example.com',
            'password' => 'brand-new-password',
            'password_confirmation' => 'brand-new-password',
        ]);

        $response->assertStatus(200)->assertJson(['success' => true]);
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('brand-new-password', $user->fresh()->password));
    }

    public function test_reset_password_with_an_invalid_token_fails(): void
    {
        $user = $this->makeUser('student');
        $user->update(['email' => 'jane@example.com']);

        $response = $this->postJson('/api/reset-password', [
            'token' => 'not-a-real-token',
            'email' => 'jane@example.com',
            'password' => 'brand-new-password',
            'password_confirmation' => 'brand-new-password',
        ]);

        $response->assertStatus(422)->assertJson(['success' => false]);
    }
}
