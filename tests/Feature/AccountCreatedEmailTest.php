<?php

namespace Tests\Feature;

use App\Mail\AccountCreatedMail;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** An admin-created account emails its owner their details + temporary password. */
class AccountCreatedEmailTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        $this->seed(RoleSeeder::class);
        $admin = User::factory()->create(['is_active' => true]);
        $admin->assignRole('admin');

        return $admin;
    }

    protected function actingWithToken(User $user): static
    {
        $this->app['auth']->forgetGuards();
        $token = $user->createToken('test', ['*'])->plainTextToken;

        return $this->withHeaders(['Authorization' => "Bearer {$token}"]);
    }

    public function test_creating_an_account_emails_the_new_user_their_details(): void
    {
        Mail::fake();

        $this->actingWithToken($this->admin())->postJson('/api/admin/users', [
            'first_name' => 'Jon', 'last_name' => 'Zkie', 'email' => 'jonzkieab3@gmail.com',
            'password' => 'TempPass123', 'role' => 'instructor', 'phone_number' => '09171234567', 'gender' => 'male',
            'teaching_course' => 'BS Information Technology',
        ])->assertCreated()->assertJsonPath('data.email_sent', true);

        Mail::assertSent(AccountCreatedMail::class, function (AccountCreatedMail $mail) {
            return $mail->hasTo('jonzkieab3@gmail.com')
                && $mail->temporaryPassword === 'TempPass123'
                && $mail->roleLabel === 'Instructor'
                && $mail->phoneNumber === '09171234567'
                && $mail->teachingCourse === 'BS Information Technology';
        });
    }

    public function test_the_password_is_never_written_to_the_audit_log(): void
    {
        Mail::fake();

        $this->actingWithToken($this->admin())->postJson('/api/admin/users', [
            'first_name' => 'Jon', 'last_name' => 'Zkie', 'email' => 'jonzkieab3@gmail.com',
            'password' => 'TempPass123', 'role' => 'staff',
        ])->assertCreated();

        $this->assertStringNotContainsString('TempPass123', json_encode(DB::table('audit_logs')->get()));
    }
}
