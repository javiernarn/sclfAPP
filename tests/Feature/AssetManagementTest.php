<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetMovement;
use App\Models\Campus;
use App\Models\User;
use App\Services\Assets\AssetService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Phase 5: asset registry — register -> assign/unassign -> repair cycle
 * -> retire/lost, plus the AssetMovement audit trail each action leaves
 * behind. Same structure as ServiceRequestTest/SecurityIncidentTest —
 * service-level assertions first, then the HTTP layer.
 */
class AssetManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function campus(string $code = 'MAIN'): Campus
    {
        return Campus::firstOrCreate(['code' => $code], ['name' => "Campus {$code}"]);
    }

    protected function user(string $role, ?Campus $campus = null): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $user */
        $user = User::factory()->create(['is_active' => true, 'campus_id' => $campus?->id]);
        $user->assignRole($role);

        return $user;
    }

    protected function authHeaders(User $user): array
    {
        $token = $user->createToken('test', ['*'])->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    protected function baseAssetData(array $overrides = []): array
    {
        return array_merge([
            'category' => Asset::CATEGORY_ELECTRONICS,
            'name' => 'Dell Latitude 5420',
            'serial_number' => 'DL5420-0001',
        ], $overrides);
    }

    // --- Service: register -------------------------------------------------

    public function test_register_creates_a_sequential_asset_tag_and_a_registered_movement(): void
    {
        $campus = $this->campus();
        $officer = $this->user('security_officer', $campus);

        $asset = app(AssetService::class)->register($officer, $this->baseAssetData());

        $this->assertSame(Asset::STATUS_IN_STORAGE, $asset->status);
        $this->assertSame($campus->id, $asset->campus_id);
        $this->assertMatchesRegularExpression('/^AST-\d{4}-0001$/', $asset->asset_tag);
        $this->assertDatabaseHas('asset_movements', [
            'asset_id' => $asset->id,
            'action' => AssetMovement::ACTION_REGISTERED,
        ]);
    }

    public function test_asset_tags_increment_sequentially(): void
    {
        $officer = $this->user('security_officer');

        $first = app(AssetService::class)->register($officer, $this->baseAssetData(['serial_number' => 'A']));
        $second = app(AssetService::class)->register($officer, $this->baseAssetData(['serial_number' => 'B']));

        $this->assertNotSame($first->asset_tag, $second->asset_tag);
        $this->assertStringEndsWith('0002', $second->asset_tag);
    }

    public function test_register_rejects_invalid_category(): void
    {
        $this->expectException(ValidationException::class);

        $officer = $this->user('security_officer');
        app(AssetService::class)->register($officer, $this->baseAssetData(['category' => 'not_a_real_category']));
    }

    // --- Service: assign / unassign -----------------------------------------

    public function test_assign_hands_asset_to_a_custodian_and_logs_the_movement(): void
    {
        $officer = $this->user('security_officer');
        $custodian = $this->user('student');

        $asset = app(AssetService::class)->register($officer, $this->baseAssetData());
        $updated = app(AssetService::class)->assign($asset, $custodian, $officer);

        $this->assertSame(Asset::STATUS_ASSIGNED, $updated->status);
        $this->assertSame($custodian->id, $updated->assigned_to);
        $this->assertDatabaseHas('asset_movements', [
            'asset_id' => $asset->id,
            'action' => AssetMovement::ACTION_ASSIGNED,
            'to_user_id' => $custodian->id,
        ]);
    }

    public function test_unassign_requires_currently_assigned_status(): void
    {
        $this->expectException(ValidationException::class);

        $officer = $this->user('security_officer');
        $asset = app(AssetService::class)->register($officer, $this->baseAssetData());

        app(AssetService::class)->unassign($asset, $officer);
    }

    public function test_reassigning_from_one_custodian_to_another_records_the_from_and_to_users(): void
    {
        $officer = $this->user('security_officer');
        $custodianA = $this->user('student');
        $custodianB = $this->user('student');

        $asset = app(AssetService::class)->register($officer, $this->baseAssetData());
        app(AssetService::class)->assign($asset, $custodianA, $officer);
        $updated = app(AssetService::class)->assign($asset->fresh(), $custodianB, $officer);

        $this->assertSame($custodianB->id, $updated->assigned_to);
        $this->assertDatabaseHas('asset_movements', [
            'asset_id' => $asset->id,
            'action' => AssetMovement::ACTION_ASSIGNED,
            'from_user_id' => $custodianA->id,
            'to_user_id' => $custodianB->id,
        ]);
    }

    // --- Service: repair cycle -----------------------------------------------

    public function test_send_for_repair_clears_any_current_custodian(): void
    {
        $officer = $this->user('security_officer');
        $custodian = $this->user('student');

        $asset = app(AssetService::class)->register($officer, $this->baseAssetData());
        app(AssetService::class)->assign($asset, $custodian, $officer);

        $updated = app(AssetService::class)->sendForRepair($asset->fresh(), $officer, 'Battery not charging.');

        $this->assertSame(Asset::STATUS_IN_REPAIR, $updated->status);
        $this->assertNull($updated->assigned_to);
    }

    public function test_return_from_repair_requires_in_repair_status(): void
    {
        $this->expectException(ValidationException::class);

        $officer = $this->user('security_officer');
        $asset = app(AssetService::class)->register($officer, $this->baseAssetData());

        app(AssetService::class)->returnFromRepair($asset, $officer);
    }

    // --- Service: retire / lost (terminal) -----------------------------------

    public function test_retire_is_terminal_and_blocks_further_assignment(): void
    {
        $this->expectException(ValidationException::class);

        $officer = $this->user('security_officer');
        $custodian = $this->user('student');

        $asset = app(AssetService::class)->register($officer, $this->baseAssetData());
        app(AssetService::class)->retire($asset, $officer, 'End of life.');

        app(AssetService::class)->assign($asset->fresh(), $custodian, $officer);
    }

    public function test_report_lost_clears_custodian_and_is_terminal(): void
    {
        $officer = $this->user('security_officer');
        $custodian = $this->user('student');

        $asset = app(AssetService::class)->register($officer, $this->baseAssetData());
        app(AssetService::class)->assign($asset, $custodian, $officer);

        $updated = app(AssetService::class)->reportLost($asset->fresh(), $officer, 'Not returned after checkout.');

        $this->assertSame(Asset::STATUS_LOST, $updated->status);
        $this->assertNull($updated->assigned_to);
        $this->assertTrue($updated->isTerminal());
    }

    // --- HTTP layer ----------------------------------------------------

    public function test_only_staff_can_register_an_asset_via_http(): void
    {
        $student = $this->user('student');

        $this->withHeaders($this->authHeaders($student))
            ->postJson('/api/assets', $this->baseAssetData())
            ->assertStatus(403);
    }

    public function test_staff_sees_full_campus_registry_student_sees_only_their_own_assigned_assets(): void
    {
        $campus = $this->campus();
        $officer = $this->user('security_officer', $campus);
        $custodian = $this->user('student', $campus);
        $otherStudent = $this->user('student', $campus);

        $assigned = app(AssetService::class)->register($officer, $this->baseAssetData(['serial_number' => 'ASSIGNED']));
        app(AssetService::class)->assign($assigned, $custodian, $officer);
        app(AssetService::class)->register($officer, $this->baseAssetData(['serial_number' => 'UNASSIGNED']));

        $staffList = $this->withHeaders($this->authHeaders($officer))->getJson('/api/assets');
        $staffList->assertStatus(200);
        $this->assertCount(2, $staffList->json('data.data'));

        // Sanctum's guard caches the resolved user for the test's guard
        // instance, so switching to a different user's token within the
        // same test method needs a forced reset between calls — same
        // issue SecurityIncidentTest/ServiceRequestTest flag on their
        // multi-actor HTTP tests.
        \Illuminate\Support\Facades\Auth::forgetGuards();

        $custodianList = $this->withHeaders($this->authHeaders($custodian))->getJson('/api/assets');
        $custodianList->assertStatus(200);
        $this->assertCount(1, $custodianList->json('data.data'));

        \Illuminate\Support\Facades\Auth::forgetGuards();

        $otherList = $this->withHeaders($this->authHeaders($otherStudent))->getJson('/api/assets');
        $otherList->assertStatus(200);
        $this->assertCount(0, $otherList->json('data.data'));
    }

    public function test_custodian_can_view_their_own_assigned_asset_but_not_someone_elses(): void
    {
        $officer = $this->user('security_officer');
        $custodian = $this->user('student');
        $otherStudent = $this->user('student');

        $asset = app(AssetService::class)->register($officer, $this->baseAssetData());
        app(AssetService::class)->assign($asset, $custodian, $officer);

        $this->withHeaders($this->authHeaders($custodian))
            ->getJson("/api/assets/{$asset->id}")
            ->assertStatus(200);

        \Illuminate\Support\Facades\Auth::forgetGuards();

        $this->withHeaders($this->authHeaders($otherStudent))
            ->getJson("/api/assets/{$asset->id}")
            ->assertStatus(403);
    }

    public function test_only_staff_can_assign_via_http(): void
    {
        $officer = $this->user('security_officer');
        $custodian = $this->user('student');
        $otherStudent = $this->user('student');

        $asset = app(AssetService::class)->register($officer, $this->baseAssetData());

        $this->withHeaders($this->authHeaders($otherStudent))
            ->postJson("/api/assets/{$asset->id}/assign", ['user_id' => $custodian->id])
            ->assertStatus(403);

        Auth::forgetGuards();

        $this->withHeaders($this->authHeaders($officer))
            ->postJson("/api/assets/{$asset->id}/assign", ['user_id' => $custodian->id])
            ->assertStatus(200)
            ->assertJsonPath('data.status', Asset::STATUS_ASSIGNED);
    }

    // --- Typed building, status trail, specific edit history -----------------

    public function test_register_saves_a_typed_building_name(): void
    {
        $officer = $this->user('security_officer');

        $asset = app(AssetService::class)->register($officer, $this->baseAssetData([
            'building_name' => '  Main Building ',
            'location_text' => 'Room 204',
        ]));

        $this->assertSame('Main Building', $asset->building_name);
        $this->assertSame('Room 204', $asset->location_text);
    }

    public function test_each_movement_records_the_status_it_moved_from_and_to(): void
    {
        $officer = $this->user('security_officer');
        $custodian = $this->user('student');
        $service = app(AssetService::class);

        $asset = $service->register($officer, $this->baseAssetData());
        $service->assign($asset, $custodian, $officer);
        $service->sendForRepair($asset->fresh(), $officer, 'Cracked screen');

        $this->assertDatabaseHas('asset_movements', [
            'asset_id' => $asset->id,
            'action' => AssetMovement::ACTION_REGISTERED,
            'from_status' => null,
            'to_status' => Asset::STATUS_IN_STORAGE,
        ]);
        $this->assertDatabaseHas('asset_movements', [
            'asset_id' => $asset->id,
            'action' => AssetMovement::ACTION_ASSIGNED,
            'from_status' => Asset::STATUS_IN_STORAGE,
            'to_status' => Asset::STATUS_ASSIGNED,
        ]);
        $this->assertDatabaseHas('asset_movements', [
            'asset_id' => $asset->id,
            'action' => AssetMovement::ACTION_SENT_FOR_REPAIR,
            'from_status' => Asset::STATUS_ASSIGNED,
            'to_status' => Asset::STATUS_IN_REPAIR,
            'notes' => 'Cracked screen',
        ]);
    }

    public function test_editing_details_logs_exactly_which_fields_changed(): void
    {
        $officer = $this->user('security_officer');
        $service = app(AssetService::class);

        $asset = $service->register($officer, $this->baseAssetData(['location_text' => 'Room 1', 'value' => 1000]));
        $service->update($asset, $officer, ['name' => $asset->name, 'location_text' => 'Room 2', 'value' => 2500]);

        $movement = AssetMovement::where('asset_id', $asset->id)
            ->where('action', AssetMovement::ACTION_DETAILS_UPDATED)
            ->firstOrFail();

        $this->assertStringContainsString('Location: Room 1 → Room 2', $movement->notes);
        $this->assertStringContainsString('Value: ₱1,000.00 → ₱2,500.00', $movement->notes);
        $this->assertStringNotContainsString('Name:', $movement->notes);
    }

    public function test_saving_without_changes_does_not_add_a_history_row(): void
    {
        $officer = $this->user('security_officer');
        $service = app(AssetService::class);

        $asset = $service->register($officer, $this->baseAssetData());
        $service->update($asset, $officer, ['name' => $asset->name]);

        $this->assertDatabaseMissing('asset_movements', [
            'asset_id' => $asset->id,
            'action' => AssetMovement::ACTION_DETAILS_UPDATED,
        ]);
    }

    public function test_show_returns_history_newest_first_with_roles_for_everyone_named(): void
    {
        $officer = $this->user('security_officer');
        $custodian = $this->user('student');
        $service = app(AssetService::class);

        $asset = $service->register($officer, $this->baseAssetData(['building_name' => 'Main Building']));
        $service->assign($asset, $custodian, $officer);

        $response = $this->withHeaders($this->authHeaders($officer))
            ->getJson("/api/assets/{$asset->id}")
            ->assertStatus(200)
            ->assertJsonPath('data.building_name', 'Main Building')
            ->assertJsonPath('data.movements.0.action', AssetMovement::ACTION_ASSIGNED)
            ->assertJsonPath('data.movements.0.from_status', Asset::STATUS_IN_STORAGE)
            ->assertJsonPath('data.movements.0.to_status', Asset::STATUS_ASSIGNED)
            ->assertJsonPath('data.movements.0.mover.roles.0.name', 'security_officer')
            ->assertJsonPath('data.movements.0.to_user.roles.0.name', 'student')
            ->assertJsonPath('data.movements.1.action', AssetMovement::ACTION_REGISTERED);
    }
}
