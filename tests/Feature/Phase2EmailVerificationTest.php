<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/**
 * Phase 2 of the security hardening (see PHASE_2.md): email verification.
 */
class Phase2EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role = 'student', array $attributes = []): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create(array_merge(['is_active' => true], $attributes));
        $user->assignRole($role);

        return $user;
    }

    protected function verificationUrl(User $user, $expires = null, ?string $hash = null): string
    {
        return URL::temporarySignedRoute(
            'verification.verify',
            $expires ?? now()->addMinutes(60),
            ['id' => $user->id, 'hash' => $hash ?? sha1($user->email)]
        );
    }

    public function test_registration_creates_an_unverified_account_and_sends_the_email(): void
    {
        Notification::fake();
        Storage::fake('public');
        $this->seed(RoleSeeder::class);

        $response = $this->post('/api/register', [
            'first_name' => 'Juan',
            'last_name' => 'Cruz',
            'email' => 'occ.cruz.juan@gmail.com',
            'phone_number' => '09171234567',
            'address' => 'Opol, Misamis Oriental',
            'gender' => 'male',
            'student_id' => '2021-2-04062',
            'course' => 'BSIT',
            'password' => 'Str0ngPass99',
            'password_confirmation' => 'Str0ngPass99',
            'profile_picture' => UploadedFile::fake()->image('me.jpg'),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(201)->assertJsonPath('user.email_verified', false);

        $user = User::where('email', 'occ.cruz.juan@gmail.com')->firstOrFail();
        $this->assertNull($user->email_verified_at);
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_an_unverified_account_can_see_itself_but_nothing_else(): void
    {
        $user = $this->makeUser('student', ['email_verified_at' => null]);

        $this->actingAs($user)->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.email_verified', false);

        $this->actingAs($user)->getJson('/api/lost-items')
            ->assertStatus(403)
            ->assertJsonPath('code', 'email_unverified');
    }

    public function test_an_unverified_account_can_ask_for_a_new_link(): void
    {
        Notification::fake();
        $user = $this->makeUser('student', ['email_verified_at' => null]);

        $this->actingAs($user)->postJson('/api/email/verification-notification')
            ->assertOk()
            ->assertJsonPath('email_verified', false);

        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_clicking_a_valid_link_verifies_the_account_and_opens_the_api(): void
    {
        $user = $this->makeUser('student', ['email_verified_at' => null]);

        $this->get($this->verificationUrl($user))->assertRedirect('/login?verify=ok');

        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.email_verified']);

        $this->actingAs($user->fresh())->getJson('/api/lost-items')->assertOk();
    }

    public function test_a_tampered_hash_does_not_verify(): void
    {
        $user = $this->makeUser('student', ['email_verified_at' => null]);

        $this->get($this->verificationUrl($user, null, sha1('someone-else@example.com')))
            ->assertRedirect('/login?verify=invalid');

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_an_unsigned_or_expired_link_does_not_verify(): void
    {
        $user = $this->makeUser('student', ['email_verified_at' => null]);

        $this->get('/email/verify/' . $user->id . '/' . sha1($user->email))
            ->assertRedirect('/login?verify=invalid');

        $this->get($this->verificationUrl($user, now()->subMinute()))
            ->assertRedirect('/login?verify=invalid');

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_accounts_created_by_the_admin_are_already_verified(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)->postJson('/api/admin/users', [
            'first_name' => 'Ana',
            'last_name' => 'Reyes',
            'email' => 'ana.reyes@example.com',
            'password' => 'Str0ngPass99',
            'role' => 'instructor',
        ])->assertSuccessful();

        $created = User::where('email', 'ana.reyes@example.com')->firstOrFail();
        $this->assertNotNull($created->email_verified_at);
    }
}
