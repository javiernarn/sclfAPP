<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Campus;
use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\InventoryMovement;
use App\Models\StorageLocation;
use App\Models\User;
use App\Services\Counter\CounterIntakeService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Locks down the current Counter check-in behavior (CounterIntakeService +
 * CounterController) before any architecture changes are made on top of it.
 * If a future refactor (campus scoping, dedicated Counter model, staff
 * assignment, etc.) breaks any of these, that's the point catching it.
 */
class CounterIntakeServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function campus(): Campus
    {
        return Campus::firstOrCreate(['code' => 'MAIN'], ['name' => 'Main Campus']);
    }

    protected function officer(bool $active = true): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $officer */
        $officer = User::factory()->create(['is_active' => $active]);
        $officer->assignRole('security_officer');

        return $officer;
    }

    protected function owner(): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $owner */
        $owner = User::factory()->create([
            'is_active' => true,
            'student_id' => '2024-1-' . str_pad((string) random_int(1, 99999), 5, '0', STR_PAD_LEFT),
        ]);
        $owner->assignRole('student');

        return $owner;
    }

    /**
     * A real Sanctum personal access token, not the fake TransientToken
     * that actingAs() issues by default — needed here because
     * EnsureAccountActive calls ->currentAccessToken()?->delete(), which
     * TransientToken doesn't implement. Production logins always go
     * through AuthController and get a real token, so this matches
     * actual behavior rather than testing an artifact of the test helper.
     */
    protected function authHeaders(User $user): array
    {
        $token = $user->createToken('test', ['*'])->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    protected function counter(bool $active = true): StorageLocation
    {
        return StorageLocation::create([
            'campus_id' => $this->campus()->id,
            'type' => StorageLocation::TYPE_COUNTER,
            'label' => 'Counter 1',
            'code' => 'CTR-1',
            'is_active' => $active,
        ]);
    }

    protected function storageLocation(): StorageLocation
    {
        return StorageLocation::create([
            'campus_id' => $this->campus()->id,
            'type' => StorageLocation::TYPE_STORAGE,
            'room' => 'Room 1',
            'code' => 'STG-1',
            'is_active' => true,
        ]);
    }

    protected function checkInPayload(): array
    {
        return [
            'item_name' => 'Blue Umbrella',
            'description' => 'Checked in for a walk-in owner.',
            'category' => 'Accessories',
        ];
    }

    // --- HTTP layer (CounterController) ---

    public function test_unauthenticated_access_is_rejected(): void
    {
        $response = $this->postJson('/api/counter/check-in', $this->checkInPayload());

        $response->assertStatus(401);
    }

    public function test_non_security_role_is_rejected(): void
    {
        $student = $this->owner();
        $counter = $this->counter();
        $owner = $this->owner();

        $response = $this->actingAs($student)->postJson('/api/counter/check-in', [
            ...$this->checkInPayload(),
            'owner_id' => $owner->id,
            'storage_location_id' => $counter->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_inactive_account_is_rejected(): void
    {
        $officer = $this->officer(active: false);
        $counter = $this->counter();
        $owner = $this->owner();

        $response = $this->withHeaders($this->authHeaders($officer))->postJson('/api/counter/check-in', [
            ...$this->checkInPayload(),
            'owner_id' => $owner->id,
            'storage_location_id' => $counter->id,
        ]);

        // account.active middleware revokes the token and aborts with 403.
        $response->assertStatus(403);
    }

    public function test_successful_check_in_via_http(): void
    {
        $officer = $this->officer();
        $counter = $this->counter();
        $owner = $this->owner();

        $response = $this->actingAs($officer)->postJson('/api/counter/check-in', [
            ...$this->checkInPayload(),
            'owner_id' => $owner->id,
            'storage_location_id' => $counter->id,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);

        $this->assertDatabaseHas('found_items', [
            'item_name' => 'Blue Umbrella',
            'intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE,
            'security_officer_id' => $officer->id,
            'storage_location_id' => $counter->id,
        ]);

        $this->assertDatabaseHas('claims', [
            'claimant_id' => $owner->id,
            'status' => Claim::STATUS_APPROVED,
        ]);
    }

    // --- Service layer (CounterIntakeService) ---

    public function test_non_counter_location_is_rejected(): void
    {
        $officer = $this->officer();
        $owner = $this->owner();
        $storage = $this->storageLocation();

        $this->expectException(ValidationException::class);

        app(CounterIntakeService::class)->checkIn($officer, $owner, $storage, $this->checkInPayload());
    }

    public function test_inactive_counter_is_rejected(): void
    {
        $officer = $this->officer();
        $owner = $this->owner();
        $counter = $this->counter(active: false);

        $this->expectException(ValidationException::class);

        app(CounterIntakeService::class)->checkIn($officer, $owner, $counter, $this->checkInPayload());
    }

    public function test_officer_cannot_check_in_item_as_self(): void
    {
        $officer = $this->officer();
        $counter = $this->counter();

        $this->expectException(ValidationException::class);

        app(CounterIntakeService::class)->checkIn($officer, $officer, $counter, $this->checkInPayload());
    }

    public function test_duplicate_submission_is_rejected(): void
    {
        $officer = $this->officer();
        $owner = $this->owner();
        $counter = $this->counter();

        app(CounterIntakeService::class)->checkIn($officer, $owner, $counter, $this->checkInPayload());

        $this->expectException(ValidationException::class);

        app(CounterIntakeService::class)->checkIn($officer, $owner, $counter, $this->checkInPayload());
    }

    public function test_successful_check_in_creates_item_movement_claim_and_audit_event(): void
    {
        $officer = $this->officer();
        $owner = $this->owner();
        $counter = $this->counter();

        $result = app(CounterIntakeService::class)->checkIn($officer, $owner, $counter, $this->checkInPayload());

        $item = $result['found_item'];
        $claim = $result['claim'];

        $this->assertInstanceOf(FoundItem::class, $item);
        $this->assertSame(FoundItem::CHANNEL_COUNTER_INTAKE, $item->intake_channel);
        $this->assertSame(FoundItem::STATUS_STORED, $item->status);
        $this->assertSame($counter->id, $item->storage_location_id);

        $this->assertInstanceOf(Claim::class, $claim);
        $this->assertSame(Claim::STATUS_APPROVED, $claim->status);
        $this->assertSame($owner->id, $claim->claimant_id);
        $this->assertSame($officer->id, $claim->reviewed_by);

        $this->assertDatabaseHas('inventory_movements', [
            'found_item_id' => $item->id,
            'storage_location_id' => $counter->id,
            'moved_by' => $officer->id,
            'action' => InventoryMovement::ACTION_STORED,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'counter.checked_in',
            'entity_type' => FoundItem::class,
            'entity_id' => $item->id,
        ]);
    }

    public function test_release_remains_a_separate_action_no_qr_generated_on_check_in(): void
    {
        $officer = $this->officer();
        $owner = $this->owner();
        $counter = $this->counter();

        $result = app(CounterIntakeService::class)->checkIn($officer, $owner, $counter, $this->checkInPayload());

        $this->assertDatabaseMissing('qr_releases', [
            'claim_id' => $result['claim']->id,
        ]);
    }

    public function test_closed_counter_is_rejected(): void
    {
        $officer = $this->officer();
        $owner = $this->owner();
        $counter = $this->counter();
        $counter->update(['status' => StorageLocation::STATUS_CLOSED]);

        $this->expectException(ValidationException::class);

        app(CounterIntakeService::class)->checkIn($officer, $owner, $counter, $this->checkInPayload());
    }

    public function test_maintenance_counter_is_rejected(): void
    {
        $officer = $this->officer();
        $owner = $this->owner();
        $counter = $this->counter();
        $counter->update(['status' => StorageLocation::STATUS_MAINTENANCE]);

        $this->expectException(ValidationException::class);

        app(CounterIntakeService::class)->checkIn($officer, $owner, $counter, $this->checkInPayload());
    }

    public function test_open_counter_created_without_explicit_status_still_accepts_check_ins(): void
    {
        // Regression guard for the StorageLocation::$attributes default —
        // a freshly-created counter that never set 'status' explicitly
        // must still behave as 'open' in memory, not null.
        $officer = $this->officer();
        $owner = $this->owner();
        $counter = $this->counter(); // deliberately doesn't pass status

        $this->assertSame(StorageLocation::STATUS_OPEN, $counter->status);

        $result = app(CounterIntakeService::class)->checkIn($officer, $owner, $counter, $this->checkInPayload());

        $this->assertInstanceOf(FoundItem::class, $result['found_item']);
    }
}
