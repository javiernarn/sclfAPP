<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\SclfNotification;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The avatar-menu "Email notifications" switch: students and instructors can
 * turn the email copy of a notification off (and on again). The in-app bell
 * is never affected.
 */
class EmailNotificationPreferenceTest extends TestCase
{
    use RefreshDatabase;

    protected function user(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true, 'email_verified_at' => now()]);
        $user->assignRole($role);

        return $user;
    }

    protected function channelsFor(User $user): array
    {
        return (new SclfNotification('claim_approved', 'Title', 'Message'))->via($user->fresh());
    }

    public function test_emails_are_on_by_default_for_students_and_instructors(): void
    {
        $this->assertContains('mail', $this->channelsFor($this->user('student')));
        $this->assertContains('mail', $this->channelsFor($this->user('instructor')));
    }

    public function test_student_can_turn_email_off_and_on(): void
    {
        $student = $this->user('student');
        Sanctum::actingAs($student, ['*']);

        $this->patchJson('/api/profile/preferences', ['email_notifications' => false])
            ->assertOk()
            ->assertJson(['email_notifications' => false]);

        $channels = $this->channelsFor($student);
        $this->assertNotContains('mail', $channels);
        $this->assertContains('database', $channels); // bell still works

        $this->patchJson('/api/profile/preferences', ['email_notifications' => true])->assertOk();
        $this->assertContains('mail', $this->channelsFor($student));
    }

    public function test_security_officer_cannot_use_the_email_switch(): void
    {
        Sanctum::actingAs($this->user('security_officer'), ['*']);

        $this->patchJson('/api/profile/preferences', ['email_notifications' => false])->assertForbidden();
    }

    public function test_value_is_validated(): void
    {
        Sanctum::actingAs($this->user('instructor'), ['*']);

        $this->patchJson('/api/profile/preferences', ['email_notifications' => 'maybe'])
            ->assertStatus(422);
    }

    public function test_me_exposes_the_preference(): void
    {
        $student = $this->user('student');
        $student->forceFill(['email_verified_at' => now(), 'email_notifications' => false])->save();
        Sanctum::actingAs($student, ['*']);

        $this->getJson('/api/me')->assertOk()->assertJsonPath('user.email_notifications', false);
    }
}
