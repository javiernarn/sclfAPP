<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SingleDeviceLoginTest extends TestCase
{
    use RefreshDatabase;

    private const LAPTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
    private const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

    private function makeUser(): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create([
            'email' => 'jane@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $user->assignRole('student');

        return $user;
    }

    private function loginFrom(string $userAgent)
    {
        return $this->withHeader('User-Agent', $userAgent)->postJson('/api/login', [
            'email' => 'jane@example.com',
            'password' => 'secret123',
        ]);
    }

    public function test_second_login_displaces_the_first_device(): void
    {
        $this->makeUser();

        $laptop = $this->loginFrom(self::LAPTOP_UA)->assertOk();
        $iphone = $this->loginFrom(self::IPHONE_UA)->assertOk();

        // iPhone (newest) keeps working.
        $this->withToken($iphone->json('access_token'))->getJson('/api/me')->assertOk();

        // Laptop's access token is dead.
        $this->app['auth']->forgetGuards();
        $this->withToken($laptop->json('access_token'))->getJson('/api/me')->assertStatus(401);
    }

    public function test_displaced_device_gets_session_displaced_code_when_refreshing(): void
    {
        $this->makeUser();

        $laptop = $this->loginFrom(self::LAPTOP_UA)->assertOk();
        $this->loginFrom(self::IPHONE_UA)->assertOk();

        $this->postJson('/api/token/refresh', ['refresh_token' => $laptop->json('refresh_token')])
            ->assertStatus(401)
            ->assertJson(['code' => 'session_displaced', 'device' => 'iPhone · Safari']);
    }

    public function test_new_device_refresh_token_still_works(): void
    {
        $this->makeUser();

        $this->loginFrom(self::LAPTOP_UA)->assertOk();
        $iphone = $this->loginFrom(self::IPHONE_UA)->assertOk();

        $this->postJson('/api/token/refresh', ['refresh_token' => $iphone->json('refresh_token')])
            ->assertOk()
            ->assertJsonStructure(['access_token', 'refresh_token', 'expires_in']);
    }

    public function test_feature_can_be_disabled_via_config(): void
    {
        config(['sclf.single_device_login' => false]);
        $this->makeUser();

        $laptop = $this->loginFrom(self::LAPTOP_UA)->assertOk();
        $this->loginFrom(self::IPHONE_UA)->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($laptop->json('access_token'))->getJson('/api/me')->assertOk();
    }
}
