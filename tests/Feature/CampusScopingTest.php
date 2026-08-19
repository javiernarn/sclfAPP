<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\FoundItem;
use App\Models\StorageLocation;
use App\Models\User;
use App\Services\Counter\CounterAssignmentService;
use App\Services\Counter\CounterIntakeService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Campus-scoped authorization: an officer tied to one campus should not
 * be able to operate on another campus's counters/storage. Admins remain
 * global, and accounts with no campus_id (unscoped/legacy) are allowed
 * everywhere — see User::canOperateInCampus().
 */
class CampusScopingTest extends TestCase
{
    use RefreshDatabase;

    protected function campusA(): Campus
    {
        return Campus::firstOrCreate(['code' => 'A'], ['name' => 'Campus A']);
    }

    protected function campusB(): Campus
    {
        return Campus::firstOrCreate(['code' => 'B'], ['name' => 'Campus B']);
    }

    protected function officerAt(?Campus $campus): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $officer */
        $officer = User::factory()->create(['is_active' => true, 'campus_id' => $campus?->id]);
        $officer->assignRole('security_officer');

        return $officer;
    }

    protected function admin(): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $admin */
        $admin = User::factory()->create(['is_active' => true]);
        $admin->assignRole('admin');

        return $admin;
    }

    protected function owner(Campus $campus): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $owner */
        $owner = User::factory()->create([
            'is_active' => true,
            'campus_id' => $campus->id,
            'student_id' => '2024-1-' . str_pad((string) random_int(1, 99999), 5, '0', STR_PAD_LEFT),
        ]);
        $owner->assignRole('student');

        return $owner;
    }

    protected function counterAt(Campus $campus, string $code): StorageLocation
    {
        return StorageLocation::create([
            'campus_id' => $campus->id,
            'type' => StorageLocation::TYPE_COUNTER,
            'label' => "Counter {$code}",
            'code' => $code,
            'is_active' => true,
        ]);
    }

    public function test_officer_from_campus_a_cannot_check_in_at_a_campus_b_counter(): void
    {
        $officer = $this->officerAt($this->campusA());
        $counterB = $this->counterAt($this->campusB(), 'CTR-B1');
        $owner = $this->owner($this->campusB());

        $this->expectException(ValidationException::class);

        app(CounterIntakeService::class)->checkIn($officer, $owner, $counterB, [
            'item_name' => 'Blue Umbrella',
        ]);
    }

    public function test_officer_from_campus_a_can_check_in_at_their_own_campus_counter(): void
    {
        $officer = $this->officerAt($this->campusA());
        $counterA = $this->counterAt($this->campusA(), 'CTR-A1');
        $owner = $this->owner($this->campusA());

        $result = app(CounterIntakeService::class)->checkIn($officer, $owner, $counterA, [
            'item_name' => 'Blue Umbrella',
        ]);

        $this->assertInstanceOf(FoundItem::class, $result['found_item']);
    }

    public function test_unscoped_officer_can_check_in_at_any_campus_counter(): void
    {
        $officer = $this->officerAt(null);
        $counterB = $this->counterAt($this->campusB(), 'CTR-B2');
        $owner = $this->owner($this->campusB());

        $result = app(CounterIntakeService::class)->checkIn($officer, $owner, $counterB, [
            'item_name' => 'Blue Umbrella',
        ]);

        $this->assertInstanceOf(FoundItem::class, $result['found_item']);
    }

    public function test_admin_can_check_in_at_any_campus_counter(): void
    {
        $admin = $this->admin();
        $counterB = $this->counterAt($this->campusB(), 'CTR-B3');
        $owner = $this->owner($this->campusB());

        $result = app(CounterIntakeService::class)->checkIn($admin, $owner, $counterB, [
            'item_name' => 'Blue Umbrella',
        ]);

        $this->assertInstanceOf(FoundItem::class, $result['found_item']);
    }

    public function test_admin_cannot_assign_a_campus_a_officer_to_a_campus_b_counter(): void
    {
        $admin = $this->admin();
        $officer = $this->officerAt($this->campusA());
        $counterB = $this->counterAt($this->campusB(), 'CTR-B4');

        $this->expectException(ValidationException::class);

        app(CounterAssignmentService::class)->assign($counterB, $officer, $admin);
    }

    public function test_storage_assign_is_rejected_across_campuses_via_http(): void
    {
        $officer = $this->officerAt($this->campusA());
        $storageB = StorageLocation::create([
            'campus_id' => $this->campusB()->id,
            'type' => StorageLocation::TYPE_STORAGE,
            'room' => 'Room B',
            'code' => 'STG-B1',
            'is_active' => true,
        ]);

        $foundItem = FoundItem::factory()->create();

        $token = $officer->createToken('test', ['*'])->plainTextToken;

        $response = $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->postJson("/api/found-items/{$foundItem->id}/assign-storage", [
                'storage_location_id' => $storageB->id,
            ]);

        $response->assertStatus(403);
    }
}
