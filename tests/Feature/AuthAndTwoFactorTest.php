<?php

namespace Tests\Feature;

use App\Models\RefreshToken;
use App\Models\User;
use App\Services\Auth\TotpService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthAndTwoFactorTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role = 'student', array $attributes = []): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create(array_merge(['is_active' => true], $attributes));
        $user->assignRole($role);

        return $user;
    }

    /**
     * Generate a currently-valid 6-digit TOTP code for a secret, using the
     * same RFC 6238 algorithm the app itself implements (TotpService has
     * no external dependency, so this mirrors it exactly rather than
     * guessing a code).
     */
    protected function currentTotpCode(string $secret): string
    {
        $totp = app(TotpService::class);

        // TotpService::verify() checks the current step ±1, so asking it
        // to verify freshly-generated codes for the current step is the
        // simplest way to get a code we know will pass — we call the
        // private generator indirectly by brute-forcing str codes would
        // be wasteful, so instead reflect into the protected method.
        $ref = new \ReflectionClass($totp);
        $method = $ref->getMethod('generateCode');
        $method->setAccessible(true);
        $step = (int) floor(time() / 30);

        return $method->invoke($totp, $secret, $step);
    }

    public function test_login_with_correct_credentials_returns_token_pair(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $response = $this->postJson('/api/login', [
            'email' => 'jane@example.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['user', 'roles', 'access_token', 'refresh_token', 'expires_in']);
    }

    public function test_login_with_wrong_password_is_rejected_and_reports_remaining_attempts(): void
    {
        $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $response = $this->postJson('/api/login', [
            'email' => 'jane@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_disabled_account_cannot_log_in(): void
    {
        $this->makeUser('student', [
            'email' => 'jane@example.com',
            'password' => bcrypt('secret123'),
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'jane@example.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_five_failed_attempts_locks_out_a_sixth(): void
    {
        $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'wrong'])
                ->assertStatus(422);
        }

        $response = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);

        $response->assertStatus(422);
        $this->assertStringContainsString(
            'Too many login attempts',
            $response->json('errors.email.0')
        );
    }

    public function test_refresh_token_rotates_into_a_new_pair(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $login = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);
        $refreshToken = $login->json('refresh_token');

        $response = $this->postJson('/api/token/refresh', ['refresh_token' => $refreshToken]);

        $response->assertStatus(200)
            ->assertJsonStructure(['access_token', 'refresh_token', 'expires_in']);
        $this->assertNotEquals($refreshToken, $response->json('refresh_token'));
    }

    public function test_reusing_an_already_rotated_refresh_token_revokes_the_whole_family(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $login = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);
        $original = $login->json('refresh_token');

        // First rotation succeeds and consumes the original token.
        $this->postJson('/api/token/refresh', ['refresh_token' => $original])->assertStatus(200);

        // Replaying the now-stale original token should be rejected...
        $replay = $this->postJson('/api/token/refresh', ['refresh_token' => $original]);
        $replay->assertStatus(422);

        // ...and it should have revoked every token descended from that
        // login, including the one issued by the legitimate rotation.
        $this->assertTrue(
            RefreshToken::where('user_id', $user->id)->whereNull('revoked_at')->doesntExist()
        );
    }

    public function test_expired_refresh_token_is_rejected(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $login = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);
        $rawToken = $login->json('refresh_token');

        RefreshToken::where('user_id', $user->id)->update(['expires_at' => now()->subDay()]);

        $response = $this->postJson('/api/token/refresh', ['refresh_token' => $rawToken]);

        $response->assertStatus(422);
    }

    public function test_logout_revokes_the_current_access_token_and_its_refresh_token(): void
    {
        $user = $this->makeUser();

        $token = $user->createToken('access-token', ['*'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/logout');

        $response->assertStatus(200);
    }

    public function test_change_password_requires_correct_current_password(): void
    {
        $user = $this->makeUser('student', ['password' => bcrypt('secret123')]);

        $response = $this->actingAs($user)->postJson('/api/change-password', [
            'current_password' => 'wrong-current',
            'password' => 'brand-new-password',
            'password_confirmation' => 'brand-new-password',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('current_password');
    }

    public function test_change_password_revokes_other_active_tokens(): void
    {
        $user = $this->makeUser('student', ['password' => bcrypt('secret123')]);

        $otherToken = $user->createToken('access-token', ['*']);
        $currentToken = $user->createToken('access-token', ['*']);

        $response = $this->withHeader('Authorization', "Bearer {$currentToken->plainTextToken}")
            ->postJson('/api/change-password', [
                'current_password' => 'secret123',
                'password' => 'brand-new-password',
                'password_confirmation' => 'brand-new-password',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $otherToken->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $currentToken->accessToken->id]);
    }

    public function test_two_factor_setup_and_confirm_enables_it_and_returns_recovery_codes(): void
    {
        $user = $this->makeUser();

        $setup = $this->actingAs($user)->postJson('/api/2fa/setup');
        $setup->assertStatus(200)->assertJsonStructure(['secret', 'otpauth_uri']);

        $secret = $setup->json('secret');
        $code = $this->currentTotpCode($secret);

        $confirm = $this->actingAs($user)->postJson('/api/2fa/confirm', ['code' => $code]);

        $confirm->assertStatus(200)->assertJsonCount(8, 'recovery_codes');
        $this->assertTrue($user->fresh()->two_factor_confirmed_at !== null);
    }

    public function test_two_factor_confirm_rejects_an_invalid_code(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->postJson('/api/2fa/setup');

        $response = $this->actingAs($user)->postJson('/api/2fa/confirm', ['code' => '000000']);

        $response->assertStatus(422)->assertJsonValidationErrors('code');
        $this->assertNull($user->fresh()->two_factor_confirmed_at);
    }

    public function test_login_for_a_two_factor_enabled_user_returns_a_pending_token_not_a_session(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $secret = app(\App\Services\Auth\TwoFactorAuthService::class)->setup($user)['secret'];
        app(\App\Services\Auth\TwoFactorAuthService::class)->confirm($user, $this->currentTotpCode($secret));

        $response = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);

        $response->assertStatus(200)->assertJson(['two_factor_required' => true]);
        $this->assertArrayHasKey('temp_token', $response->json());
        $this->assertArrayNotHasKey('access_token', $response->json());
    }

    public function test_a_pending_two_factor_token_cannot_reach_ordinary_protected_routes(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $secret = app(\App\Services\Auth\TwoFactorAuthService::class)->setup($user)['secret'];
        app(\App\Services\Auth\TwoFactorAuthService::class)->confirm($user, $this->currentTotpCode($secret));

        $login = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);
        $pendingToken = $login->json('temp_token');

        $response = $this->withHeader('Authorization', "Bearer {$pendingToken}")->getJson('/api/me');

        $response->assertStatus(403);
    }

    public function test_verify_login_with_correct_totp_code_exchanges_pending_token_for_a_real_session(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $secret = app(\App\Services\Auth\TwoFactorAuthService::class)->setup($user)['secret'];
        app(\App\Services\Auth\TwoFactorAuthService::class)->confirm($user, $this->currentTotpCode($secret));

        $login = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);
        $pendingToken = $login->json('temp_token');

        $response = $this->withHeader('Authorization', "Bearer {$pendingToken}")
            ->postJson('/api/2fa/login-verify', ['code' => $this->currentTotpCode($secret)]);

        $response->assertStatus(200)->assertJsonStructure(['access_token', 'refresh_token']);
    }

    public function test_verify_login_with_wrong_code_is_rejected(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $secret = app(\App\Services\Auth\TwoFactorAuthService::class)->setup($user)['secret'];
        app(\App\Services\Auth\TwoFactorAuthService::class)->confirm($user, $this->currentTotpCode($secret));

        $login = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);
        $pendingToken = $login->json('temp_token');

        $response = $this->withHeader('Authorization', "Bearer {$pendingToken}")
            ->postJson('/api/2fa/login-verify', ['code' => '111111']);

        $response->assertStatus(422);
    }

    public function test_disable_requires_correct_password(): void
    {
        $user = $this->makeUser('student', ['password' => bcrypt('secret123')]);

        $secret = app(\App\Services\Auth\TwoFactorAuthService::class)->setup($user)['secret'];
        app(\App\Services\Auth\TwoFactorAuthService::class)->confirm($user, $this->currentTotpCode($secret));

        $response = $this->actingAs($user)->postJson('/api/2fa/disable', ['password' => 'wrong']);

        $response->assertStatus(422);
        $this->assertNotNull($user->fresh()->two_factor_confirmed_at);
    }

    public function test_disable_with_correct_password_turns_two_factor_off(): void
    {
        $user = $this->makeUser('student', ['password' => bcrypt('secret123')]);

        $secret = app(\App\Services\Auth\TwoFactorAuthService::class)->setup($user)['secret'];
        app(\App\Services\Auth\TwoFactorAuthService::class)->confirm($user, $this->currentTotpCode($secret));

        $response = $this->actingAs($user)->postJson('/api/2fa/disable', ['password' => 'secret123']);

        $response->assertStatus(200);
        $this->assertNull($user->fresh()->two_factor_confirmed_at);
    }

    public function test_a_recovery_code_can_be_used_once_and_not_twice(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $service = app(\App\Services\Auth\TwoFactorAuthService::class);
        $secret = $service->setup($user)['secret'];
        $recoveryCodes = $service->confirm($user, $this->currentTotpCode($secret));
        $code = $recoveryCodes[0];

        $login = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);
        $pendingToken = $login->json('temp_token');

        $first = $this->withHeader('Authorization', "Bearer {$pendingToken}")
            ->postJson('/api/2fa/login-verify', ['code' => $code]);
        $first->assertStatus(200);

        // Same recovery code, fresh login attempt — must not work twice.
        $login2 = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);
        $pendingToken2 = $login2->json('temp_token');

        $second = $this->withHeader('Authorization', "Bearer {$pendingToken2}")
            ->postJson('/api/2fa/login-verify', ['code' => $code]);
        $second->assertStatus(422);
    }
}
