<?php

namespace Tests\Feature;

use App\Models\RefreshToken;
use App\Models\User;
use App\Services\Auth\TotpService;
use App\Services\Auth\TwoFactorAuthService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * Phase 1 of the security hardening (see PHASE_1.md):
 *  - password reset signs out every existing session
 *  - password recovery no longer reveals which accounts exist
 *  - one password policy
 *  - 2FA per-account lockout and no code replay
 */
class Phase1AuthHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role = 'student', array $attributes = []): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create(array_merge(['is_active' => true], $attributes));
        $user->assignRole($role);

        return $user;
    }

    protected function currentTotpCode(string $secret): string
    {
        $totp = app(TotpService::class);
        $method = (new \ReflectionClass($totp))->getMethod('generateCode');
        $method->setAccessible(true);

        return $method->invoke($totp, $secret, (int) floor(time() / 30));
    }

    protected function userWithTwoFactor(): array
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);
        $secret = app(TwoFactorAuthService::class)->setup($user)['secret'];
        app(TwoFactorAuthService::class)->confirm($user, $this->currentTotpCode($secret));

        return [$user, $secret];
    }

    protected function pendingToken(): string
    {
        return $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123'])
            ->json('temp_token');
    }

    // ---- H2: reset signs everyone out ---------------------------------

    public function test_password_reset_revokes_all_existing_sessions(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com', 'password' => bcrypt('secret123')]);

        $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'secret123'])->assertOk();
        $this->assertGreaterThan(0, $user->tokens()->count());

        $token = Password::createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'jane@example.com',
            'password' => 'NewStrong99',
            'password_confirmation' => 'NewStrong99',
        ])->assertOk();

        $this->assertSame(0, $user->tokens()->count());
        $this->assertSame(0, RefreshToken::where('user_id', $user->id)->whereNull('revoked_at')->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.password_reset']);
    }

    public function test_password_reset_rejects_a_weak_password(): void
    {
        $user = $this->makeUser('student', ['email' => 'jane@example.com']);
        $token = Password::createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'jane@example.com',
            'password' => 'alllowercase',
            'password_confirmation' => 'alllowercase',
        ])->assertStatus(422);
    }

    // ---- H5: no account enumeration -----------------------------------

    public function test_find_account_answers_the_same_for_known_and_unknown_emails(): void
    {
        $this->makeUser('student', ['email' => 'jane@example.com', 'first_name' => 'Jane', 'last_name' => 'Doe']);

        $known = $this->postJson('/api/password/find-account', ['email' => 'jane@example.com']);
        $unknown = $this->postJson('/api/password/find-account', ['email' => 'nobody@example.com']);

        $known->assertOk();
        $unknown->assertOk();
        $this->assertSame($known->json('message'), $unknown->json('message'));
        $this->assertStringNotContainsString('Jane', $known->getContent());
        $this->assertArrayNotHasKey('full_name', $known->json('data'));
    }

    public function test_forgot_password_answers_the_same_for_known_and_unknown_emails(): void
    {
        $this->makeUser('student', ['email' => 'jane@example.com']);

        $known = $this->postJson('/api/forgot-password', ['email' => 'jane@example.com']);
        $unknown = $this->postJson('/api/forgot-password', ['email' => 'nobody@example.com']);

        $known->assertOk();
        $unknown->assertOk();
        $this->assertSame($known->json('message'), $unknown->json('message'));
    }

    // ---- M1: 2FA lockout and replay -----------------------------------

    public function test_two_factor_login_locks_the_account_after_five_wrong_codes(): void
    {
        [$user, $secret] = $this->userWithTwoFactor();

        // Each attempt uses a fresh pending token, as an attacker who knows
        // the password would — the budget is per account, not per token.
        for ($i = 0; $i < 5; $i++) {
            $this->withHeader('Authorization', 'Bearer ' . $this->pendingToken())
                ->postJson('/api/2fa/login-verify', ['code' => '000000'])
                ->assertStatus(422);
        }

        // Even the CORRECT code is now refused.
        $this->withHeader('Authorization', 'Bearer ' . $this->pendingToken())
            ->postJson('/api/2fa/login-verify', ['code' => $this->currentTotpCode($secret)])
            ->assertStatus(422);

        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.2fa_locked']);
    }

    public function test_a_totp_code_cannot_be_used_twice(): void
    {
        [$user, $secret] = $this->userWithTwoFactor();
        $code = $this->currentTotpCode($secret);

        $this->withHeader('Authorization', 'Bearer ' . $this->pendingToken())
            ->postJson('/api/2fa/login-verify', ['code' => $code])
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer ' . $this->pendingToken())
            ->postJson('/api/2fa/login-verify', ['code' => $code])
            ->assertStatus(422);
    }

    public function test_a_successful_two_factor_login_resets_the_failure_counter(): void
    {
        [$user, $secret] = $this->userWithTwoFactor();

        for ($i = 0; $i < 3; $i++) {
            $this->withHeader('Authorization', 'Bearer ' . $this->pendingToken())
                ->postJson('/api/2fa/login-verify', ['code' => '000000'])
                ->assertStatus(422);
        }

        $this->withHeader('Authorization', 'Bearer ' . $this->pendingToken())
            ->postJson('/api/2fa/login-verify', ['code' => $this->currentTotpCode($secret)])
            ->assertOk();
    }
}
