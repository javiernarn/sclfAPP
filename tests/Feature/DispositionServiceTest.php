<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\FoundItem;
use App\Models\InventoryMovement;
use App\Models\StorageLocation;
use App\Models\User;
use App\Services\Inventory\DispositionService;
use App\Services\Inventory\InventoryService;
use App\Services\Inventory\StorageCapacityExceededException;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Phase 3: retention sweep, dispose/restore lifecycle, and storage
 * capacity enforcement. Mirrors the style of CounterIntakeServiceTest —
 * service-level assertions first, then the HTTP layer for the
 * authorization/campus-scoping rules.
 */
class DispositionServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function campus(string $code = 'MAIN'): Campus
    {
        return Campus::firstOrCreate(['code' => $code], ['name' => "Campus {$code}"]);
    }

    protected function officer(?Campus $campus = null, bool $admin = false): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $officer */
        $officer = User::factory()->create(['is_active' => true, 'campus_id' => $campus?->id]);
        $officer->assignRole($admin ? 'admin' : 'security_officer');

        return $officer;
    }

    protected function storage(Campus $campus, string $code, ?int $capacity = null): StorageLocation
    {
        return StorageLocation::create([
            'campus_id' => $campus->id,
            'type' => StorageLocation::TYPE_STORAGE,
            'code' => $code,
            'capacity' => $capacity,
            'is_active' => true,
        ]);
    }

    protected function authHeaders(User $user): array
    {
        $token = $user->createToken('test', ['*'])->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    // --- Retention sweep -----------------------------------------------

    public function test_sweep_flags_stored_items_past_retention_and_leaves_others_alone(): void
    {
        $campus = $this->campus();
        $location = $this->storage($campus, 'STOR-A');

        $expired = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_STORED,
            'retention_expires_at' => now()->subDay()->toDateString(),
        ]);

        $notYetExpired = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_STORED,
            'retention_expires_at' => now()->addDays(30)->toDateString(),
        ]);

        $noRetentionSet = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_STORED,
            'retention_expires_at' => null,
        ]);

        $alreadyClaimed = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_CLAIMED,
            'retention_expires_at' => now()->subDay()->toDateString(),
        ]);

        $flagged = app(DispositionService::class)->sweepUnclaimed();

        $this->assertSame(1, $flagged);
        $this->assertSame(FoundItem::STATUS_UNCLAIMED, $expired->fresh()->status);
        $this->assertNotNull($expired->fresh()->unclaimed_at);
        $this->assertSame(FoundItem::STATUS_STORED, $notYetExpired->fresh()->status);
        $this->assertSame(FoundItem::STATUS_STORED, $noRetentionSet->fresh()->status);
        $this->assertSame(FoundItem::STATUS_CLAIMED, $alreadyClaimed->fresh()->status);

        $this->assertDatabaseHas('inventory_movements', [
            'found_item_id' => $expired->id,
            'action' => InventoryMovement::ACTION_UNCLAIMED,
        ]);
    }

    public function test_sweep_also_flags_matched_but_unclaimed_items(): void
    {
        $campus = $this->campus();
        $location = $this->storage($campus, 'STOR-B');

        $matched = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_MATCHED,
            'retention_expires_at' => now()->subDay()->toDateString(),
        ]);

        app(DispositionService::class)->sweepUnclaimed();

        $this->assertSame(FoundItem::STATUS_UNCLAIMED, $matched->fresh()->status);
    }

    public function test_sweep_is_idempotent(): void
    {
        $campus = $this->campus();
        $location = $this->storage($campus, 'STOR-C');

        FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_STORED,
            'retention_expires_at' => now()->subDay()->toDateString(),
        ]);

        $service = app(DispositionService::class);
        $first = $service->sweepUnclaimed();
        $second = $service->sweepUnclaimed();

        $this->assertSame(1, $first);
        $this->assertSame(0, $second);
    }

    // --- Dispose / restore ----------------------------------------------

    public function test_dispose_requires_the_item_to_be_unclaimed_first(): void
    {
        $campus = $this->campus();
        $officer = $this->officer($campus);
        $location = $this->storage($campus, 'STOR-D');

        $item = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_STORED,
        ]);

        $this->expectException(ValidationException::class);
        app(DispositionService::class)->dispose($item, $officer, FoundItem::DISPOSITION_DONATED);
    }

    public function test_dispose_sets_terminal_status_and_records_movement(): void
    {
        $campus = $this->campus();
        $officer = $this->officer($campus);
        $location = $this->storage($campus, 'STOR-E');

        $item = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_UNCLAIMED,
            'unclaimed_at' => now()->subDay(),
        ]);

        $disposed = app(DispositionService::class)->dispose($item, $officer, FoundItem::DISPOSITION_DONATED, 'Given to campus food bank drive.');

        $this->assertSame(FoundItem::STATUS_DISPOSED, $disposed->status);
        $this->assertSame(FoundItem::DISPOSITION_DONATED, $disposed->disposition_method);
        $this->assertSame($officer->id, $disposed->disposed_by);
        $this->assertNotNull($disposed->disposed_at);

        $this->assertDatabaseHas('inventory_movements', [
            'found_item_id' => $item->id,
            'action' => InventoryMovement::ACTION_DISPOSED,
        ]);
    }

    public function test_disposed_item_no_longer_counts_toward_capacity(): void
    {
        $campus = $this->campus();
        $officer = $this->officer($campus);
        $location = $this->storage($campus, 'STOR-F', capacity: 1);

        $item = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_UNCLAIMED,
        ]);

        $this->assertTrue($location->fresh()->isAtCapacity());

        app(DispositionService::class)->dispose($item, $officer, FoundItem::DISPOSITION_DISCARDED);

        $this->assertFalse($location->fresh()->isAtCapacity());
    }

    public function test_restore_returns_an_unclaimed_item_to_stored(): void
    {
        $campus = $this->campus();
        $officer = $this->officer($campus);
        $location = $this->storage($campus, 'STOR-G');

        $item = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_UNCLAIMED,
            'unclaimed_at' => now()->subDay(),
        ]);

        $restored = app(DispositionService::class)->restore($item, $officer, 'Owner showed up in person.');

        $this->assertSame(FoundItem::STATUS_STORED, $restored->status);
        $this->assertNull($restored->unclaimed_at);

        $this->assertDatabaseHas('inventory_movements', [
            'found_item_id' => $item->id,
            'action' => InventoryMovement::ACTION_RESTORED,
        ]);
    }

    public function test_cannot_restore_an_already_disposed_item(): void
    {
        $campus = $this->campus();
        $officer = $this->officer($campus);
        $location = $this->storage($campus, 'STOR-H');

        $item = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_DISPOSED,
            'disposition_method' => FoundItem::DISPOSITION_DISCARDED,
            'disposed_at' => now(),
            'disposed_by' => $officer->id,
        ]);

        $this->expectException(ValidationException::class);
        app(DispositionService::class)->restore($item, $officer);
    }

    // --- Storage capacity -------------------------------------------------

    public function test_assign_storage_blocks_when_location_is_at_capacity(): void
    {
        $campus = $this->campus();
        $officer = $this->officer($campus);
        $location = $this->storage($campus, 'STOR-I', capacity: 1);

        FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_STORED,
        ]);

        $newItem = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'status' => FoundItem::STATUS_ACCEPTED,
        ]);

        $this->expectException(StorageCapacityExceededException::class);
        app(InventoryService::class)->assignStorage($newItem, $location, $officer);
    }

    public function test_assign_storage_sets_a_default_retention_date(): void
    {
        $campus = $this->campus();
        $officer = $this->officer($campus);
        $location = $this->storage($campus, 'STOR-J');

        $item = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'status' => FoundItem::STATUS_ACCEPTED,
            'retention_expires_at' => null,
        ]);

        $stored = app(InventoryService::class)->assignStorage($item, $location, $officer);

        $this->assertNotNull($stored->retention_expires_at);
        $this->assertTrue($stored->retention_expires_at->isFuture());
    }

    public function test_assign_storage_does_not_overwrite_an_existing_retention_date(): void
    {
        $campus = $this->campus();
        $officer = $this->officer($campus);
        $location = $this->storage($campus, 'STOR-K');
        $customDate = now()->addDays(5)->toDateString();

        $item = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'status' => FoundItem::STATUS_ACCEPTED,
            'retention_expires_at' => $customDate,
        ]);

        $stored = app(InventoryService::class)->assignStorage($item, $location, $officer);

        $this->assertSame($customDate, $stored->retention_expires_at->toDateString());
    }

    // --- HTTP layer: authorization + campus scoping ----------------------

    public function test_non_staff_cannot_list_unclaimed_items(): void
    {
        $this->seed(RoleSeeder::class);
        $student = User::factory()->create(['is_active' => true]);
        $student->assignRole('student');

        $response = $this->withHeaders($this->authHeaders($student))->getJson('/api/inventory/unclaimed');

        $response->assertStatus(403);
    }

    public function test_officer_only_sees_unclaimed_items_at_their_own_campus(): void
    {
        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $locationA = $this->storage($campusA, 'STOR-CA');
        $locationB = $this->storage($campusB, 'STOR-CB');

        $itemA = FoundItem::factory()->create([
            'campus_id' => $campusA->id,
            'storage_location_id' => $locationA->id,
            'status' => FoundItem::STATUS_UNCLAIMED,
        ]);
        FoundItem::factory()->create([
            'campus_id' => $campusB->id,
            'storage_location_id' => $locationB->id,
            'status' => FoundItem::STATUS_UNCLAIMED,
        ]);

        $officer = $this->officer($campusA);

        $response = $this->withHeaders($this->authHeaders($officer))->getJson('/api/inventory/unclaimed');

        $response->assertStatus(200);
        $ids = collect($response->json('data.data'))->pluck('id');
        $this->assertContains($itemA->id, $ids);
        $this->assertCount(1, $ids);
    }

    public function test_officer_cannot_dispose_of_an_item_at_another_campus(): void
    {
        $campusA = $this->campus('A');
        $campusB = $this->campus('B');
        $locationB = $this->storage($campusB, 'STOR-DB');

        $item = FoundItem::factory()->create([
            'campus_id' => $campusB->id,
            'storage_location_id' => $locationB->id,
            'status' => FoundItem::STATUS_UNCLAIMED,
        ]);

        $officer = $this->officer($campusA);

        $response = $this->withHeaders($this->authHeaders($officer))
            ->postJson("/api/found-items/{$item->id}/dispose", ['method' => FoundItem::DISPOSITION_DISCARDED]);

        $response->assertStatus(403);
    }

    public function test_dispose_endpoint_rejects_an_invalid_method(): void
    {
        $campus = $this->campus();
        $officer = $this->officer($campus);
        $location = $this->storage($campus, 'STOR-L');

        $item = FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_UNCLAIMED,
        ]);

        $response = $this->withHeaders($this->authHeaders($officer))
            ->postJson("/api/found-items/{$item->id}/dispose", ['method' => 'thrown_in_the_river']);

        $response->assertStatus(422);
    }

    public function test_sweep_endpoint_flags_eligible_items_for_the_caller(): void
    {
        $campus = $this->campus();
        $officer = $this->officer($campus);
        $location = $this->storage($campus, 'STOR-M');

        FoundItem::factory()->create([
            'campus_id' => $campus->id,
            'storage_location_id' => $location->id,
            'status' => FoundItem::STATUS_STORED,
            'retention_expires_at' => now()->subDay()->toDateString(),
        ]);

        $response = $this->withHeaders($this->authHeaders($officer))->postJson('/api/inventory/unclaimed/sweep');

        $response->assertStatus(200)->assertJson(['flagged_count' => 1]);
    }
}
