<?php

namespace Tests\Feature;

use App\Models\LostItem;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A lost report is held back from the community until a handler approves it
 * (approved_at). These tests make sure that rule lives on the SERVER: hiding
 * the "Pending review" tab in React is not access control.
 */
class LostItemVisibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    private function pendingReportBy(User $owner, string $name = 'Secret Pending Wallet'): LostItem
    {
        return LostItem::factory()->create(['user_id' => $owner->id, 'item_name' => $name, 'approved_at' => null]);
    }

    private function approvedReportBy(User $owner, string $name = 'Public Approved Umbrella'): LostItem
    {
        return LostItem::factory()->create(['user_id' => $owner->id, 'item_name' => $name, 'approved_at' => now()]);
    }

    public function test_a_student_cannot_list_someone_elses_pending_report(): void
    {
        $owner = $this->makeUser('student');
        $other = User::factory()->create(['is_active' => true]);
        $other->assignRole('student');
        $this->pendingReportBy($owner);

        $names = collect($this->actingAs($other)->getJson('/api/lost-items')->assertOk()->json('data'))->pluck('item_name');

        $this->assertNotContains('Secret Pending Wallet', $names->all());
    }

    public function test_the_pending_filter_does_not_unlock_other_peoples_reports_for_a_student(): void
    {
        $owner = $this->makeUser('student');
        $other = User::factory()->create(['is_active' => true]);
        $other->assignRole('student');
        $this->pendingReportBy($owner);

        $rows = $this->actingAs($other)->getJson('/api/lost-items?approval=pending')->assertOk()->json('data');

        $this->assertSame([], $rows);
    }

    public function test_a_student_still_sees_approved_reports_and_their_own_pending_ones(): void
    {
        $me = $this->makeUser('student');
        $someone = User::factory()->create(['is_active' => true]);
        $someone->assignRole('student');
        $this->approvedReportBy($someone);
        $this->pendingReportBy($me, 'My Own Pending Bag');
        $this->pendingReportBy($someone, 'Not Mine Pending');

        $names = collect($this->actingAs($me)->getJson('/api/lost-items')->assertOk()->json('data'))->pluck('item_name')->all();

        $this->assertContains('Public Approved Umbrella', $names);
        $this->assertContains('My Own Pending Bag', $names);
        $this->assertNotContains('Not Mine Pending', $names);
    }

    public function test_a_student_cannot_open_someone_elses_pending_report_directly(): void
    {
        $owner = $this->makeUser('student');
        $other = User::factory()->create(['is_active' => true]);
        $other->assignRole('student');
        $report = $this->pendingReportBy($owner);

        $this->actingAs($other)->getJson("/api/lost-items/{$report->id}")->assertForbidden();
        $this->actingAs($owner)->getJson("/api/lost-items/{$report->id}")->assertOk();
    }

    public function test_an_approved_report_can_be_opened_by_any_signed_in_user(): void
    {
        $owner = $this->makeUser('student');
        $other = User::factory()->create(['is_active' => true]);
        $other->assignRole('instructor');
        $report = $this->approvedReportBy($owner);

        $this->actingAs($other)->getJson("/api/lost-items/{$report->id}")->assertOk();
    }

    public function test_global_search_does_not_reveal_someone_elses_pending_report(): void
    {
        $owner = $this->makeUser('student');
        $other = User::factory()->create(['is_active' => true]);
        $other->assignRole('student');
        $this->pendingReportBy($owner);

        $json = $this->actingAs($other)->getJson('/api/search?q=Secret')->assertOk()->getContent();

        $this->assertStringNotContainsString('Secret Pending Wallet', $json);
    }

    public function test_search_suggestions_do_not_autocomplete_someone_elses_pending_report(): void
    {
        $owner = $this->makeUser('student');
        $other = User::factory()->create(['is_active' => true]);
        $other->assignRole('student');
        $this->pendingReportBy($owner);

        $json = $this->actingAs($other)->getJson('/api/search/suggestions?q=Secret')->assertOk()->getContent();

        $this->assertStringNotContainsString('Secret Pending Wallet', $json);
    }

    public function test_handlers_still_see_the_whole_queue_and_can_filter_it(): void
    {
        $owner = $this->makeUser('student');
        $this->pendingReportBy($owner);
        $this->approvedReportBy($owner);

        foreach (['security_officer', 'admin', 'staff'] as $role) {
            $handler = User::factory()->create(['is_active' => true]);
            $handler->assignRole($role);
            $all = $this->actingAs($handler)->getJson('/api/lost-items')->assertOk()->json('data');
            $pending = $this->actingAs($handler)->getJson('/api/lost-items?approval=pending')->assertOk()->json('data');
            $approved = $this->actingAs($handler)->getJson('/api/lost-items?approval=approved')->assertOk()->json('data');

            $this->assertCount(2, $all, "$role should see every report");
            $this->assertCount(1, $pending, "$role pending filter");
            $this->assertCount(1, $approved, "$role approved filter");
        }
    }
}
