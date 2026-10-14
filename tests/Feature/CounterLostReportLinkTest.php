<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\LostItem;
use App\Models\StorageLocation;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Counter check-in: the officer can see the owner's open lost reports and
 * explicitly confirm which one a hand-over belongs to. Fixtures mirror
 * CounterIntakeServiceTest (real Sanctum token, firstOrCreate campus).
 */
class CounterLostReportLinkTest extends TestCase
{
    use RefreshDatabase;

    protected function user(string $role, array $attrs = []): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create(array_merge(['is_active' => true], $attrs));
        $user->assignRole($role);

        return $user;
    }

    protected function headers(User $user): array
    {
        return ['Authorization' => 'Bearer ' . $user->createToken('test', ['*'])->plainTextToken];
    }

    protected function counter(): StorageLocation
    {
        $campus = Campus::firstOrCreate(['code' => 'MAIN'], ['name' => 'Main Campus']);

        return StorageLocation::create([
            'campus_id' => $campus->id,
            'type' => StorageLocation::TYPE_COUNTER,
            'label' => 'Counter 1',
            'code' => 'CTR-1',
            'is_active' => true,
        ]);
    }

    protected function lost(User $owner, string $status, string $name = 'Black umbrella'): LostItem
    {
        return LostItem::factory()->create(['user_id' => $owner->id, 'status' => $status, 'item_name' => $name]);
    }

    public function test_lists_only_the_owners_open_reports(): void
    {
        $officer = $this->user('security_officer');
        $owner = $this->user('student', ['student_id' => '2024-1-00001']);
        $stranger = $this->user('student', ['student_id' => '2024-1-00002']);

        $mine = $this->lost($owner, LostItem::STATUS_PENDING);
        $this->lost($owner, LostItem::STATUS_CLOSED, 'Old report');
        $this->lost($stranger, LostItem::STATUS_PENDING, 'Not mine');

        $ids = collect(
            $this->withHeaders($this->headers($officer))
                ->getJson("/api/counter/owners/{$owner->id}/lost-reports")
                ->assertOk()
                ->json('data')
        )->pluck('id')->all();

        $this->assertSame([$mine->id], $ids);
    }

    public function test_students_cannot_list_reports(): void
    {
        $student = $this->user('student', ['student_id' => '2024-1-00003']);
        $owner = $this->user('student', ['student_id' => '2024-1-00004']);

        $this->withHeaders($this->headers($student))
            ->getJson("/api/counter/owners/{$owner->id}/lost-reports")
            ->assertStatus(403);
    }

    public function test_check_in_links_the_chosen_report(): void
    {
        $officer = $this->user('security_officer');
        $owner = $this->user('student', ['student_id' => '2024-1-00005']);
        $counter = $this->counter();
        $report = $this->lost($owner, LostItem::STATUS_PENDING);

        $this->withHeaders($this->headers($officer))
            ->postJson('/api/counter/check-in', [
                'owner_id' => $owner->id,
                'storage_location_id' => $counter->id,
                'item_name' => 'Umbrella',
                'lost_item_id' => $report->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.linked_lost_item.id', $report->id);

        $this->assertSame(LostItem::STATUS_CLAIMED, $report->fresh()->status);
    }

    public function test_check_in_rejects_a_report_that_belongs_to_someone_else(): void
    {
        $officer = $this->user('security_officer');
        $owner = $this->user('student', ['student_id' => '2024-1-00006']);
        $stranger = $this->user('student', ['student_id' => '2024-1-00007']);
        $counter = $this->counter();
        $theirs = $this->lost($stranger, LostItem::STATUS_PENDING, 'Theirs');

        $this->withHeaders($this->headers($officer))
            ->postJson('/api/counter/check-in', [
                'owner_id' => $owner->id,
                'storage_location_id' => $counter->id,
                'item_name' => 'Umbrella',
                'lost_item_id' => $theirs->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('lost_item_id');
    }
}
