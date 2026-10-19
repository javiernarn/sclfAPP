<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Like;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 3 of the security hardening (see PHASE_3.md): rate limits and search
 * input hardening.
 */
class Phase3AbuseProtectionTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role = 'student'): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    public function test_login_is_limited_per_ip_across_different_emails(): void
    {
        // Password spraying: many different accounts, same machine.
        for ($i = 1; $i <= 60; $i++) {
            $this->postJson('/api/login', ['email' => "user{$i}@example.com", 'password' => 'whatever1A'])
                ->assertStatus(422);
        }

        $this->postJson('/api/login', ['email' => 'user61@example.com', 'password' => 'whatever1A'])
            ->assertStatus(429);
    }

    public function test_registration_is_limited_per_minute_per_ip(): void
    {
        // Empty payloads fail validation (422) but still count as attempts.
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/register', [])->assertStatus(422);
        }

        $this->postJson('/api/register', [])->assertStatus(429);
    }

    public function test_creating_reports_is_limited_per_user(): void
    {
        $user = $this->makeUser();

        for ($i = 0; $i < 30; $i++) {
            $this->actingAs($user)->postJson('/api/lost-items', [])->assertStatus(422);
        }

        $this->actingAs($user)->postJson('/api/lost-items', [])
            ->assertStatus(429)
            ->assertJsonStructure(['message']);
    }

    public function test_change_password_attempts_are_limited(): void
    {
        $user = $this->makeUser();

        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($user)->postJson('/api/change-password', [
                'current_password' => 'wrong',
                'password' => 'NewStrong99',
                'password_confirmation' => 'NewStrong99',
            ])->assertStatus(422);
        }

        $this->actingAs($user)->postJson('/api/change-password', [
            'current_password' => 'wrong',
            'password' => 'NewStrong99',
            'password_confirmation' => 'NewStrong99',
        ])->assertStatus(429);
    }

    public function test_like_helper_escapes_wildcards_and_limits_length(): void
    {
        $this->assertSame('100\\%', Like::escape('100%'));
        $this->assertSame('a\\_b', Like::escape('a_b'));
        $this->assertSame('back\\\\slash', Like::escape('back\\slash'));
        $this->assertSame('%wallet%', Like::contains('wallet'));
        $this->assertSame(Like::MAX_LENGTH, mb_strlen(Like::escape(str_repeat('x', 500))));
    }
}
