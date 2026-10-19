<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\RefreshCookie;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithRefreshCookie;
use Tests\TestCase;

/**
 * Phase 6 of the security hardening (see PHASE_6.md): the refresh token lives
 * in an HttpOnly cookie, not in JavaScript-readable storage.
 */
class Phase6RefreshCookieTest extends TestCase
{
    use InteractsWithRefreshCookie;
    use RefreshDatabase;

    protected function makeUser(): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create([
            'email' => 'jane@example.com',
            'password' => bcrypt('secret123'),
            'is_active' => true,
        ]);
        $user->assignRole('student');

        return $user;
    }

    protected function login(array $extra = [])
    {
        return $this->postJson('/api/login', array_merge(['email' => 'jane@example.com', 'password' => 'secret123'], $extra));
    }

    public function test_login_puts_the_refresh_token_in_an_httponly_strict_cookie_not_in_the_body(): void
    {
        $this->makeUser();

        $response = $this->login(['remember' => true])->assertOk();

        $response->assertJsonStructure(['access_token', 'expires_in']);
        $this->assertNull($response->json('refresh_token'));

        $cookie = $response->getCookie(RefreshCookie::NAME, false);
        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('strict', strtolower((string) $cookie->getSameSite()));
        $this->assertSame('/api/token', $cookie->getPath());
        $this->assertGreaterThan(time() + 20 * 86400, $cookie->getExpiresTime()); // "keep me signed in"
    }

    public function test_without_keep_me_signed_in_the_cookie_is_a_session_cookie(): void
    {
        $this->makeUser();

        $cookie = $this->login(['remember' => false])->assertOk()->getCookie(RefreshCookie::NAME, false);

        $this->assertNotNull($cookie);
        $this->assertSame(0, $cookie->getExpiresTime()); // gone when the browser closes
    }

    public function test_the_cookie_is_marked_secure_on_https(): void
    {
        $this->makeUser();

        $response = $this->postJson('https://localhost/api/login', ['email' => 'jane@example.com', 'password' => 'secret123']);

        $this->assertTrue($response->getCookie(RefreshCookie::NAME, false)->isSecure());
    }

    public function test_refresh_reads_the_cookie_rotates_it_and_keeps_the_lifetime(): void
    {
        $this->makeUser();
        $token = $this->refreshTokenFrom($this->login(['remember' => true]));

        $response = $this->refreshWith($token, ['remember' => true])->assertOk();

        $response->assertJsonStructure(['access_token', 'expires_in']);
        $this->assertNull($response->json('refresh_token'));

        $new = $response->getCookie(RefreshCookie::NAME, false);
        $this->assertNotNull($new);
        $this->assertNotSame($token, $new->getValue());
        $this->assertGreaterThan(time() + 20 * 86400, $new->getExpiresTime());
    }

    public function test_a_refresh_token_in_the_request_body_is_ignored_in_cookie_mode(): void
    {
        $this->makeUser();
        $token = $this->refreshTokenFrom($this->login());

        $this->postJson('/api/token/refresh', ['refresh_token' => $token])->assertStatus(422);
    }

    public function test_refresh_without_a_cookie_fails_and_clears_the_cookie(): void
    {
        $response = $this->postJson('/api/token/refresh', [])->assertStatus(422);

        $cookie = $response->getCookie(RefreshCookie::NAME, false);
        $this->assertNotNull($cookie);
        $this->assertLessThanOrEqual(time(), $cookie->getExpiresTime());
    }

    public function test_logout_clears_the_refresh_cookie(): void
    {
        $user = $this->makeUser();
        $token = $user->createToken('access-token', ['*'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/logout')->assertOk();

        $cookie = $response->getCookie(RefreshCookie::NAME, false);
        $this->assertNotNull($cookie);
        $this->assertLessThanOrEqual(time(), $cookie->getExpiresTime());
    }

    public function test_the_old_body_mode_still_works_when_the_switch_is_off(): void
    {
        config(['sclf.refresh_cookie.enabled' => false]);
        $this->makeUser();

        $login = $this->login()->assertOk();

        $this->assertNull($login->getCookie(RefreshCookie::NAME, false));
        $token = $login->json('refresh_token');
        $this->assertNotEmpty($token);

        $this->postJson('/api/token/refresh', ['refresh_token' => $token])
            ->assertOk()
            ->assertJsonStructure(['access_token', 'refresh_token', 'expires_in']);
    }
}
