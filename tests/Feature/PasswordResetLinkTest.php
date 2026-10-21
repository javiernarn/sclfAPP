<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * An emailed reset link works ONCE: not after the password was changed with
 * it, not after it expires, and not after a newer link replaced it. The Reset
 * Password page asks /password/reset-token/check on open so a dead link shows
 * "no longer valid" instead of the form.
 */
class PasswordResetLinkTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create([
            'is_active' => true,
            'email' => 'jane@example.com',
            'password' => bcrypt('OldSecret123'),
        ]);
        $user->assignRole('student');

        return $user;
    }

    protected function check(string $token, string $email = 'jane@example.com')
    {
        return $this->postJson('/api/password/reset-token/check', ['token' => $token, 'email' => $email]);
    }

    protected function reset(string $token, string $password = 'NewStrong99')
    {
        return $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'jane@example.com',
            'password' => $password,
            'password_confirmation' => $password,
        ]);
    }

    public function test_a_fresh_link_checks_out_as_valid(): void
    {
        $token = Password::createToken($this->makeUser());

        $this->check($token)
            ->assertOk()
            ->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.reason', 'ok');
    }

    public function test_a_link_cannot_be_used_again_after_a_successful_reset(): void
    {
        $user = $this->makeUser();
        $token = Password::createToken($user);

        $this->reset($token)->assertOk();

        // Opening the same emailed link again is refused straight away...
        $this->check($token)
            ->assertOk()
            ->assertJsonPath('data.valid', false)
            ->assertJsonPath('data.reason', 'invalid');

        // ...and submitting it again changes nothing.
        $this->reset($token, 'AnotherPass77')
            ->assertStatus(422)
            ->assertJsonPath('code', 'link_invalid');

        $this->assertTrue(Hash::check('NewStrong99', $user->fresh()->password));
        $this->assertFalse(Hash::check('AnotherPass77', $user->fresh()->password));
    }

    public function test_an_expired_link_is_reported_as_expired_and_refused(): void
    {
        $user = $this->makeUser();
        $token = Password::createToken($user);

        DB::table(config('auth.passwords.users.table'))
            ->where('email', $user->email)
            ->update(['created_at' => now()->subMinutes(61)]);

        $this->check($token)
            ->assertOk()
            ->assertJsonPath('data.valid', false)
            ->assertJsonPath('data.reason', 'expired');

        $this->reset($token)
            ->assertStatus(422)
            ->assertJsonPath('code', 'link_expired');

        $this->assertTrue(Hash::check('OldSecret123', $user->fresh()->password));
    }

    public function test_requesting_a_newer_link_revokes_the_older_one(): void
    {
        $user = $this->makeUser();
        $old = Password::createToken($user);
        $new = Password::createToken($user);

        $this->check($old)->assertJsonPath('data.valid', false);
        $this->reset($old)->assertStatus(422)->assertJsonPath('code', 'link_invalid');

        $this->check($new)->assertJsonPath('data.valid', true);
        $this->reset($new)->assertOk();
    }

    public function test_the_check_does_not_reveal_whether_an_account_exists(): void
    {
        $this->makeUser();

        $wrongToken = $this->check('not-a-real-token');
        $noAccount = $this->check('not-a-real-token', 'nobody@example.com');

        $wrongToken->assertOk()->assertJsonPath('data.valid', false);
        $noAccount->assertOk()->assertJsonPath('data.valid', false);
        $this->assertSame($wrongToken->json('data'), $noAccount->json('data'));
    }
}
