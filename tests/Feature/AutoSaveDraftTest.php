<?php

namespace Tests\Feature;

use App\Models\FormDraft;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Auto Save: the account-wide switch and the server-side drafts that let a
 * half-written report follow the person to another device.
 */
class AutoSaveDraftTest extends TestCase
{
    use RefreshDatabase;

    protected function user(string $role = 'student'): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true, 'email_verified_at' => now()]);
        $user->assignRole($role);

        return $user;
    }

    public function test_auto_save_is_off_by_default_and_can_be_switched(): void
    {
        $user = $this->user();
        $this->assertFalse((bool) $user->fresh()->auto_save);
        Sanctum::actingAs($user, ['*']);

        $this->patchJson('/api/profile/preferences', ['auto_save' => true])
            ->assertOk()->assertJson(['auto_save' => true]);
        $this->assertTrue((bool) $user->fresh()->auto_save);
    }

    public function test_every_role_can_use_auto_save_but_only_students_and_instructors_the_email_switch(): void
    {
        Sanctum::actingAs($this->user('security_officer'), ['*']);

        $this->patchJson('/api/profile/preferences', ['auto_save' => true])->assertOk();
        $this->patchJson('/api/profile/preferences', ['email_notifications' => false])->assertForbidden();
    }

    public function test_draft_round_trip(): void
    {
        Sanctum::actingAs($this->user(), ['*']);

        $this->getJson('/api/drafts/lost-item')->assertOk()->assertJson(['data' => null]);

        $this->putJson('/api/drafts/lost-item', ['data' => ['item_name' => 'Black umbrella'], 'saved_at' => 1700000000000])
            ->assertOk();

        $this->getJson('/api/drafts/lost-item')
            ->assertOk()
            ->assertJsonPath('data.item_name', 'Black umbrella')
            ->assertJsonPath('saved_at', 1700000000000);

        // last write wins, still one row
        $this->putJson('/api/drafts/lost-item', ['data' => ['item_name' => 'Blue umbrella']])->assertOk();
        $this->assertSame(1, FormDraft::count());
        $this->getJson('/api/drafts/lost-item')->assertJsonPath('data.item_name', 'Blue umbrella');

        $this->deleteJson('/api/drafts/lost-item')->assertOk();
        $this->getJson('/api/drafts/lost-item')->assertJson(['data' => null]);
    }

    public function test_drafts_are_private_to_each_account(): void
    {
        $mine = $this->user();
        $theirs = User::factory()->create(['is_active' => true, 'email_verified_at' => now()]);
        $theirs->assignRole('student');
        $theirs->formDrafts()->create(['form_key' => 'incident', 'data' => ['title' => 'secret'], 'client_saved_at' => 1]);

        Sanctum::actingAs($mine, ['*']);
        $this->getJson('/api/drafts/incident')->assertJson(['data' => null]);
        $this->deleteJson('/api/drafts/incident')->assertOk();
        $this->assertSame(1, FormDraft::where('user_id', $theirs->id)->count());
    }

    public function test_unknown_form_and_oversized_drafts_are_refused(): void
    {
        Sanctum::actingAs($this->user(), ['*']);

        $this->putJson('/api/drafts/not-a-form', ['data' => ['a' => 1]])->assertNotFound();
        $this->putJson('/api/drafts/incident', ['data' => ['description' => str_repeat('x', FormDraft::MAX_BYTES + 10)]])
            ->assertStatus(413);
    }

    public function test_old_drafts_are_dropped_when_read(): void
    {
        $user = $this->user();
        $draft = $user->formDrafts()->create(['form_key' => 'found-item', 'data' => ['item_name' => 'Keys'], 'client_saved_at' => 1]);
        $draft->forceFill(['updated_at' => now()->subDays(FormDraft::MAX_AGE_DAYS + 1)])->saveQuietly();

        Sanctum::actingAs($user, ['*']);
        $this->getJson('/api/drafts/found-item')->assertJson(['data' => null]);
        $this->assertSame(0, FormDraft::count());
    }

    public function test_turning_auto_save_off_deletes_saved_drafts(): void
    {
        $user = $this->user();
        $user->forceFill(['auto_save' => true])->saveQuietly();
        $user->formDrafts()->create(['form_key' => 'lost-item', 'data' => ['item_name' => 'Wallet'], 'client_saved_at' => 1]);

        Sanctum::actingAs($user, ['*']);
        $this->patchJson('/api/profile/preferences', ['auto_save' => false])->assertOk();

        $this->assertSame(0, $user->formDrafts()->count());
    }

    public function test_staff_can_save_drafts_without_admin_approval(): void
    {
        Sanctum::actingAs($this->user('staff'), ['*']);

        $this->putJson('/api/drafts/incident', ['data' => ['title' => 'Broken lock']])->assertOk();
        $this->patchJson('/api/profile/preferences', ['auto_save' => true])->assertOk();
    }
}
