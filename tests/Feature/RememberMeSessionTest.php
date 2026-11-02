<?php

namespace Tests\Feature;

use App\Models\RefreshToken;
use App\Models\User;
use App\Support\RefreshCookie;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithRefreshCookie;
use Tests\TestCase;

/**
 * "Keep this session open": ticked = long sliding session, unticked = short
 * session that the server itself expires. The choice is stored on the refresh
 * token, so the browser cannot change it later.
 */
class RememberMeSessionTest extends TestCase
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

    protected function login(bool $remember)
    {
        return $this->postJson('/api/login', [
            'email' => 'jane@example.com',
            'password' => 'secret123',
            'remember' => $remember,
        ]);
    }

    public function test_ticked_login_gets_a_long_server_side_lifetime(): void
    {
        $user = $this->makeUser();

        $this->login(true)->assertOk();

        $row = RefreshToken::where('user_id', $user->id)->latest('id')->firstOrFail();
        $this->assertTrue($row->remember);
        $this->assertTrue($row->expires_at->greaterThan(now()->addDays(20)));
    }

    public function test_unticked_login_gets_a_short_server_side_lifetime(): void
    {
        $user = $this->makeUser();

        $this->login(false)->assertOk();

        $row = RefreshToken::where('user_id', $user->id)->latest('id')->firstOrFail();
        $this->assertFalse($row->remember);
        $this->assertTrue($row->expires_at->lessThan(now()->addMinutes(30)));
    }

    public function test_unticked_refresh_token_stops_working_after_the_idle_window(): void
    {
        $this->makeUser();
        $token = $this->refreshTokenFrom($this->login(false)->assertOk());

        $this->travel(40)->minutes();

        $this->refreshWith($token)->assertStatus(422);
    }

    public function test_ticked_refresh_token_still_works_a_day_later_and_slides_forward(): void
    {
        $user = $this->makeUser();
        $token = $this->refreshTokenFrom($this->login(true)->assertOk());

        $this->travel(1)->days();

        $this->refreshWith($token)->assertOk();

        $row = RefreshToken::where('user_id', $user->id)->latest('id')->firstOrFail();
        $this->assertTrue($row->remember);
        $this->assertTrue($row->expires_at->greaterThan(now()->addDays(20)));
    }

    public function test_the_browser_cannot_upgrade_a_short_session_by_sending_remember_on_refresh(): void
    {
        $user = $this->makeUser();
        $token = $this->refreshTokenFrom($this->login(false)->assertOk());

        $response = $this->refreshWith($token, ['remember' => true])->assertOk();

        $cookie = $response->getCookie(RefreshCookie::NAME, false);
        $this->assertNotNull($cookie);
        $this->assertSame(0, $cookie->getExpiresTime()); // still a session cookie

        $row = RefreshToken::where('user_id', $user->id)->latest('id')->firstOrFail();
        $this->assertFalse($row->remember);
    }

    public function test_a_ticked_session_keeps_its_long_cookie_even_if_the_browser_omits_the_flag(): void
    {
        $this->makeUser();
        $token = $this->refreshTokenFrom($this->login(true)->assertOk());

        $cookie = $this->refreshWith($token)->assertOk()->getCookie(RefreshCookie::NAME, false);

        $this->assertGreaterThan(time() + 20 * 86400, $cookie->getExpiresTime());
    }
}
