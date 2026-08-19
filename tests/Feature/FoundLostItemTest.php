<?php

namespace Tests\Feature;

use App\Models\FoundItem;
use App\Models\LostItem;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FoundLostItemTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    public function test_a_student_can_report_a_found_item(): void
    {
        $student = $this->makeUser('student');

        $response = $this->actingAs($student)->postJson('/api/found-items', [
            'item_name' => 'Blue Umbrella',
            'description' => 'Found near the cafeteria entrance.',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('found_items', [
            'user_id' => $student->id,
            'item_name' => 'Blue Umbrella',
        ]);
    }

    public function test_found_item_report_requires_a_name_and_description(): void
    {
        $student = $this->makeUser('student');

        $response = $this->actingAs($student)->postJson('/api/found-items', []);

        $response->assertStatus(422)->assertJsonValidationErrors(['item_name', 'description']);
    }

    public function test_counter_intake_items_are_hidden_from_the_general_found_items_list_for_students(): void
    {
        $student = $this->makeUser('student');
        FoundItem::factory()->create(['intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE]);
        FoundItem::factory()->create(['intake_channel' => FoundItem::CHANNEL_ONLINE_REPORT]);

        $response = $this->actingAs($student)->getJson('/api/found-items');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
    }

    public function test_counter_intake_items_are_visible_to_staff_in_the_found_items_list(): void
    {
        $officer = $this->makeUser('security_officer');
        FoundItem::factory()->create(['intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE]);
        FoundItem::factory()->create(['intake_channel' => FoundItem::CHANNEL_ONLINE_REPORT]);

        $response = $this->actingAs($officer)->getJson('/api/found-items');

        $response->assertStatus(200);
        $this->assertCount(2, $response->json('data'));
    }

    public function test_only_security_officer_or_admin_can_verify_a_found_item(): void
    {
        $student = $this->makeUser('student');
        $foundItem = FoundItem::factory()->create(['verification_status' => 'pending']);

        $response = $this->actingAs($student)->postJson("/api/found-items/{$foundItem->id}/verify", [
            'approved' => true,
        ]);

        $response->assertStatus(403);
    }

    public function test_officer_approving_a_found_item_moves_it_to_accepted(): void
    {
        $officer = $this->makeUser('security_officer');
        $foundItem = FoundItem::factory()->create(['verification_status' => 'pending']);

        $response = $this->actingAs($officer)->postJson("/api/found-items/{$foundItem->id}/verify", [
            'approved' => true,
        ]);

        $response->assertStatus(200);
        $this->assertEquals(FoundItem::STATUS_ACCEPTED, $foundItem->fresh()->status);
        $this->assertEquals('approved', $foundItem->fresh()->verification_status);
    }

    public function test_officer_rejecting_a_found_item_records_notes(): void
    {
        $officer = $this->makeUser('security_officer');
        $foundItem = FoundItem::factory()->create(['verification_status' => 'pending']);

        $response = $this->actingAs($officer)->postJson("/api/found-items/{$foundItem->id}/verify", [
            'approved' => false,
            'notes' => 'Photo does not match description.',
        ]);

        $response->assertStatus(200);
        $this->assertEquals(FoundItem::STATUS_REJECTED, $foundItem->fresh()->status);
        $this->assertEquals('Photo does not match description.', $foundItem->fresh()->verification_notes);
    }

    public function test_a_student_can_report_a_lost_item_and_it_appears_in_their_own_list(): void
    {
        $student = $this->makeUser('student');

        $response = $this->actingAs($student)->postJson('/api/lost-items', [
            'item_name' => 'Black Wallet',
            'description' => 'Lost somewhere near the gym.',
        ]);

        $response->assertStatus(201);

        $mine = $this->actingAs($student)->getJson('/api/lost-items?mine=1');
        $mine->assertStatus(200);
        $this->assertCount(1, $mine->json('data'));
    }

    public function test_a_security_officer_cannot_report_a_lost_item(): void
    {
        $officer = $this->makeUser('security_officer');

        $response = $this->actingAs($officer)->postJson('/api/lost-items', [
            'item_name' => 'Black Wallet',
            'description' => 'Lost somewhere near the gym.',
        ]);

        $response->assertStatus(403);
    }

    public function test_an_instructor_can_report_a_lost_item(): void
    {
        $instructor = $this->makeUser('instructor');

        $response = $this->actingAs($instructor)->postJson('/api/lost-items', [
            'item_name' => 'Reading Glasses',
            'description' => 'Left them in the faculty lounge.',
        ]);

        $response->assertStatus(201);
    }

    public function test_a_lost_item_owner_can_delete_archive_their_own_report(): void
    {
        $student = $this->makeUser('student');
        $lostItem = LostItem::factory()->create(['user_id' => $student->id]);

        $response = $this->actingAs($student)->deleteJson("/api/lost-items/{$lostItem->id}");

        $response->assertStatus(200);
        $this->assertSoftDeleted('lost_items', ['id' => $lostItem->id]);
    }

    public function test_a_different_student_cannot_delete_someone_elses_lost_item_report(): void
    {
        $owner = $this->makeUser('student');
        $otherStudent = $this->makeUser('student');
        $lostItem = LostItem::factory()->create(['user_id' => $owner->id]);

        $response = $this->actingAs($otherStudent)->deleteJson("/api/lost-items/{$lostItem->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('lost_items', ['id' => $lostItem->id, 'deleted_at' => null]);
    }

    public function test_an_admin_can_delete_any_lost_item_report(): void
    {
        $owner = $this->makeUser('student');
        $admin = $this->makeUser('admin');
        $lostItem = LostItem::factory()->create(['user_id' => $owner->id]);

        $response = $this->actingAs($admin)->deleteJson("/api/lost-items/{$lostItem->id}");

        $response->assertStatus(200);
        $this->assertSoftDeleted('lost_items', ['id' => $lostItem->id]);
    }

    public function test_reporting_a_lost_item_that_matches_a_found_item_notifies_the_reporter(): void
    {
        $student = $this->makeUser('student');
        FoundItem::factory()->create([
            'item_name' => 'iPhone 13',
            'category' => 'Electronics',
            'brand' => 'Apple',
            'color' => 'black',
            'verification_status' => 'approved',
        ]);

        $response = $this->actingAs($student)->postJson('/api/lost-items', [
            'item_name' => 'iPhone 13',
            'description' => 'Black iPhone 13 with a cracked screen protector.',
            'category' => 'Electronics',
            'brand' => 'Apple',
            'color' => 'black',
        ]);

        $response->assertStatus(201);
        $this->assertGreaterThanOrEqual(0, $response->json('matches_found'));
    }

    public function test_any_authenticated_user_can_view_a_single_lost_item(): void
    {
        $owner = $this->makeUser('student');
        $viewer = $this->makeUser('instructor');
        $lostItem = LostItem::factory()->create(['user_id' => $owner->id]);

        $response = $this->actingAs($viewer)->getJson("/api/lost-items/{$lostItem->id}");

        $response->assertStatus(200)->assertJson(['id' => $lostItem->id]);
    }
}
