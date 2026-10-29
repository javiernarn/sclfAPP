<?php

namespace Tests\Feature;

use App\Mail\AccountUpdatedMail;
use App\Mail\EmailChangeMail;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Profile > Change email (students + instructors), switched by
 * SCLF_EMAIL_CHANGE_ENABLED. See EmailChangeController.
 */
class EmailChangeTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role, array $attributes = []): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create(array_merge([
            'is_active' => true,
            'email_verified_at' => now(),
            'password' => Hash::make('Str0ngPass99'),
        ], $attributes));
        $user->assignRole($role);

        return $user;
    }

    protected function student(): User
    {
        return $this->makeUser('student', [
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'email' => 'occ.delacruz.juan@gmail.com',
        ]);
    }

    protected function request(string $newEmail, string $password = 'Str0ngPass99')
    {
        return $this->postJson('/api/profile/email/request', [
            'new_email' => $newEmail,
            'current_password' => $password,
        ]);
    }

    protected function sentCode(): string
    {
        $code = null;
        Mail::assertSent(EmailChangeMail::class, function ($m) use (&$code) {
            $code = $m->code;

            return true;
        });

        return $code;
    }

    public function test_student_changes_email_with_password_and_code(): void
    {
        Mail::fake();
        $user = $this->student();
        $user->forceFill(['email_verified_at' => null])->save();
        Sanctum::actingAs($user, ['*']);

        $this->request('occ.delacruz.juan2026@gmail.com')->assertOk()->assertJsonPath('success', true);

        Mail::assertSent(EmailChangeMail::class, fn ($m) => $m->hasTo('occ.delacruz.juan2026@gmail.com'));

        $this->postJson('/api/profile/email/confirm', ['code' => $this->sentCode()])
            ->assertOk()
            ->assertJsonPath('email', 'occ.delacruz.juan2026@gmail.com');

        $user->refresh();
        $this->assertSame('occ.delacruz.juan2026@gmail.com', $user->email);
        $this->assertNotNull($user->email_verified_at);

        // The previous address is warned.
        Mail::assertSent(AccountUpdatedMail::class, fn ($m) => $m->hasTo('occ.delacruz.juan@gmail.com') && $m->toOldAddress);
    }

    public function test_student_must_keep_the_school_format_and_own_last_name(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->student(), ['*']);

        $this->request('juan2026@gmail.com')->assertStatus(422)->assertJsonValidationErrors('new_email');
        $this->request('occ.santos.juan@gmail.com')->assertStatus(422)->assertJsonValidationErrors('new_email');
        $this->request('occ.delacruz.juan@yahoo.com')->assertStatus(422)->assertJsonValidationErrors('new_email');

        Mail::assertNothingSent();
    }

    public function test_instructor_may_use_any_valid_gmail_but_not_other_providers(): void
    {
        Mail::fake();
        $user = $this->makeUser('instructor', ['email' => 'old.teacher@gmail.com']);
        Sanctum::actingAs($user, ['*']);

        $this->request('maria.santos.opol@gmail.com')->assertOk();
        $this->request('maria@yahoo.com')->assertStatus(422)->assertJsonValidationErrors('new_email');
        $this->request('a@gmail.com')->assertStatus(422)->assertJsonValidationErrors('new_email');
        $this->request('maria..santos@gmail.com')->assertStatus(422)->assertJsonValidationErrors('new_email');
        $this->request('.maria.santos@gmail.com')->assertStatus(422)->assertJsonValidationErrors('new_email');
    }

    public function test_wrong_current_password_is_refused_and_sends_nothing(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->student(), ['*']);

        $this->request('occ.delacruz.juan2026@gmail.com', 'WrongPass1')
            ->assertStatus(422)
            ->assertJsonValidationErrors('current_password');

        Mail::assertNothingSent();
    }

    public function test_address_already_used_by_someone_else_is_refused(): void
    {
        Mail::fake();
        $this->student();
        $this->makeUserNoSeed('student', ['email' => 'occ.delacruz.juan2026@gmail.com', 'last_name' => 'Dela Cruz']);
        Sanctum::actingAs(User::where('email', 'occ.delacruz.juan@gmail.com')->first(), ['*']);

        $this->request('occ.delacruz.juan2026@gmail.com')->assertStatus(422)->assertJsonValidationErrors('new_email');
    }

    protected function makeUserNoSeed(string $role, array $attributes): User
    {
        $user = User::factory()->create(array_merge(['is_active' => true], $attributes));
        $user->assignRole($role);

        return $user;
    }

    public function test_wrong_code_does_not_change_email_and_locks_after_five_tries(): void
    {
        Mail::fake();
        $user = $this->student();
        Sanctum::actingAs($user, ['*']);

        $this->request('occ.delacruz.juan2026@gmail.com')->assertOk();
        $good = $this->sentCode();
        $bad = $good === '000000' ? '111111' : '000000';

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/profile/email/confirm', ['code' => $bad])->assertStatus(422);
        }

        // Locked: even the right code no longer works.
        $this->postJson('/api/profile/email/confirm', ['code' => $good])->assertStatus(422);
        $this->assertSame('occ.delacruz.juan@gmail.com', $user->fresh()->email);
    }

    public function test_code_is_bound_to_the_address_it_was_sent_to(): void
    {
        Mail::fake();
        $user = $this->student();
        Sanctum::actingAs($user, ['*']);

        $this->request('occ.delacruz.juan2026@gmail.com')->assertOk();
        // Asking again for a different address replaces the pending request.
        $this->request('occ.delacruz.juan99@gmail.com')->assertOk();

        $this->postJson('/api/profile/email/confirm', ['code' => $this->sentCode()])->assertOk();
        $this->assertSame('occ.delacruz.juan99@gmail.com', $user->fresh()->email);
    }

    public function test_switch_off_hides_and_blocks_the_feature(): void
    {
        config(['sclf.email_change.enabled' => false]);
        Mail::fake();
        $user = $this->student();
        Sanctum::actingAs($user, ['*']);

        $this->getJson('/api/me')->assertOk()->assertJsonPath('user.email_change_enabled', false);
        $this->request('occ.delacruz.juan2026@gmail.com')->assertStatus(403);
        Mail::assertNothingSent();
    }

    public function test_switch_on_exposes_the_flag_for_students_and_instructors_only(): void
    {
        config(['sclf.email_change.enabled' => true]);

        Sanctum::actingAs($this->student(), ['*']);
        $this->getJson('/api/me')->assertJsonPath('user.email_change_enabled', true);

        Sanctum::actingAs($this->makeUserNoSeed('security_officer', ['email' => 'guard@example.com']), ['*']);
        $this->getJson('/api/me')->assertJsonPath('user.email_change_enabled', false);
        $this->request('guard.new@gmail.com')->assertStatus(403);
    }
}
