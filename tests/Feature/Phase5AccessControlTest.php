<?php

namespace Tests\Feature;

use App\Models\FoundItem;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 5 of the security hardening (see PHASE_5.md): least privilege for
 * staff and hiding verification-critical found-item details.
 */
class Phase5AccessControlTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    // ---- M4 ------------------------------------------------------------

    public function test_staff_cannot_read_the_audit_log_or_the_activity_feed(): void
    {
        $staff = $this->makeUser('staff');

        $this->actingAs($staff)->getJson('/api/audit-logs')->assertStatus(403);
        $this->actingAs($staff)->getJson('/api/admin/activity')->assertStatus(403);
        $this->actingAs($staff)->getJson("/api/admin/activity/users/{$staff->id}/summary")->assertStatus(403);
    }

    public function test_admin_can_still_read_the_audit_log_and_the_activity_feed(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)->getJson('/api/audit-logs')->assertOk();
        $this->actingAs($admin)->getJson('/api/admin/activity')->assertOk();
    }

    public function test_staff_can_still_open_the_user_list(): void
    {
        $staff = $this->makeUser('staff');

        $this->actingAs($staff)->getJson('/api/admin/users')->assertOk();
    }

    // ---- M7 ------------------------------------------------------------

    protected function secretItem(User $finder): FoundItem
    {
        return FoundItem::factory()->create([
            'user_id' => $finder->id,
            'unique_characteristics' => 'Sticker of a red fox on the back',
            'details' => ['serial' => 'SN-998877'],
            'verification_notes' => 'Checked by officer',
        ]);
    }

    public function test_a_browsing_student_does_not_see_the_verification_details(): void
    {
        $finder = $this->makeUser('student');
        $browser = User::factory()->create(['is_active' => true]);
        $browser->assignRole('student');
        $item = $this->secretItem($finder);

        $show = $this->actingAs($browser)->getJson("/api/found-items/{$item->id}")->assertOk();
        $show->assertJsonMissingPath('unique_characteristics');
        $show->assertJsonMissingPath('details');
        $show->assertJsonMissingPath('verification_notes');
        $show->assertJsonPath('item_name', $item->item_name);

        $index = $this->actingAs($browser)->getJson('/api/found-items')->assertOk();
        $this->assertStringNotContainsString('red fox', $index->getContent());
        $this->assertStringNotContainsString('SN-998877', $index->getContent());
    }

    public function test_the_person_who_reported_it_still_sees_everything(): void
    {
        $finder = $this->makeUser('student');
        $item = $this->secretItem($finder);

        $this->actingAs($finder)->getJson("/api/found-items/{$item->id}")
            ->assertOk()
            ->assertJsonPath('unique_characteristics', 'Sticker of a red fox on the back');
    }

    public function test_security_officers_still_see_everything(): void
    {
        $finder = $this->makeUser('student');
        $officer = User::factory()->create(['is_active' => true]);
        $officer->assignRole('security_officer');
        $item = $this->secretItem($finder);

        $this->actingAs($officer)->getJson("/api/found-items/{$item->id}")
            ->assertOk()
            ->assertJsonPath('unique_characteristics', 'Sticker of a red fox on the back')
            ->assertJsonPath('verification_notes', 'Checked by officer');
    }
}
