<?php

namespace Tests\Feature;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\LostItem;
use App\Models\User;
use App\Services\Claims\ClaimService;
use App\Services\Claims\FraudDetectionService;
use App\Services\Release\ItemReleaseService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ClaimLifecycleAndReleaseTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    public function test_a_finder_cannot_claim_the_item_they_themselves_reported(): void
    {
        $finder = $this->makeUser('student');
        $foundItem = FoundItem::factory()->create(['user_id' => $finder->id]);

        $response = $this->actingAs($finder)->postJson("/api/found-items/{$foundItem->id}/claims", []);

        $response->assertStatus(422)->assertJsonValidationErrors('found_item');
    }

    public function test_a_counter_intake_item_cannot_be_claimed_by_anyone(): void
    {
        $claimant = $this->makeUser('student');
        $foundItem = FoundItem::factory()->create([
            'intake_channel' => FoundItem::CHANNEL_COUNTER_INTAKE,
        ]);

        $response = $this->actingAs($claimant)->postJson("/api/found-items/{$foundItem->id}/claims", []);

        $response->assertStatus(422)->assertJsonValidationErrors('found_item');
    }

    public function test_only_one_active_claim_per_claimant_per_item(): void
    {
        $claimant = $this->makeUser('student');
        $foundItem = FoundItem::factory()->create();

        $this->actingAs($claimant)->postJson("/api/found-items/{$foundItem->id}/claims", [])
            ->assertStatus(201);

        $response = $this->actingAs($claimant)->postJson("/api/found-items/{$foundItem->id}/claims", []);

        $response->assertStatus(422)->assertJsonValidationErrors('found_item');
    }

    public function test_a_non_student_instructor_cannot_submit_a_claim(): void
    {
        $officer = $this->makeUser('security_officer');
        $foundItem = FoundItem::factory()->create();

        $response = $this->actingAs($officer)->postJson("/api/found-items/{$foundItem->id}/claims", []);

        $response->assertStatus(403);
    }

    public function test_submitting_a_claim_creates_it_pending_with_a_computed_risk_score(): void
    {
        $claimant = $this->makeUser('student');
        $foundItem = FoundItem::factory()->create();

        $response = $this->actingAs($claimant)->postJson("/api/found-items/{$foundItem->id}/claims", []);

        $response->assertStatus(201);
        $this->assertDatabaseHas('claims', [
            'found_item_id' => $foundItem->id,
            'claimant_id' => $claimant->id,
            'status' => Claim::STATUS_PENDING,
        ]);
    }

    public function test_fraud_score_flags_a_claimant_with_multiple_recent_rejections(): void
    {
        $claimant = $this->makeUser('student');

        for ($i = 0; $i < 2; $i++) {
            Claim::create([
                'found_item_id' => FoundItem::factory()->create()->id,
                'claimant_id' => $claimant->id,
                'status' => Claim::STATUS_REJECTED,
                'created_at' => now()->subDays(5),
            ]);
        }

        [$score, $flags] = app(FraudDetectionService::class)->assess($claimant);

        $this->assertGreaterThanOrEqual(30, $score);
        $this->assertNotEmpty($flags);
    }

    public function test_fraud_score_is_zero_for_a_claimant_with_no_history(): void
    {
        $claimant = $this->makeUser('student');

        [$score, $flags] = app(FraudDetectionService::class)->assess($claimant);

        $this->assertEquals(0, $score);
        $this->assertEmpty($flags);
    }

    public function test_evidence_submitted_while_more_evidence_is_required_reopens_the_claim(): void
    {
        $claimant = $this->makeUser('student');
        $officer = $this->makeUser('security_officer');
        $foundItem = FoundItem::factory()->create();

        $claim = Claim::create([
            'found_item_id' => $foundItem->id,
            'claimant_id' => $claimant->id,
            'status' => Claim::STATUS_MORE_EVIDENCE_REQUIRED,
        ]);

        $response = $this->actingAs($claimant)->postJson("/api/claims/{$claim->id}/evidence", [
            'type' => 'description',
            'content' => 'It has a small scratch on the back left corner.',
        ]);

        $response->assertStatus(201);
        $this->assertEquals(Claim::STATUS_UNDER_REVIEW, $claim->fresh()->status);
    }

    public function test_only_the_claimant_can_add_evidence_to_their_own_claim(): void
    {
        $claimant = $this->makeUser('student');
        $otherStudent = $this->makeUser('student');
        $foundItem = FoundItem::factory()->create();

        $claim = Claim::create([
            'found_item_id' => $foundItem->id,
            'claimant_id' => $claimant->id,
            'status' => Claim::STATUS_PENDING,
        ]);

        $response = $this->actingAs($otherStudent)->postJson("/api/claims/{$claim->id}/evidence", [
            'type' => 'description',
            'content' => 'Trying to add evidence to someone else\'s claim.',
        ]);

        $response->assertStatus(403);
    }

    protected function approvedClaim(): Claim
    {
        $claimant = $this->makeUser('student');
        $foundItem = FoundItem::factory()->create();

        return Claim::create([
            'found_item_id' => $foundItem->id,
            'claimant_id' => $claimant->id,
            'status' => Claim::STATUS_APPROVED,
        ]);
    }

    public function test_generate_release_moves_an_approved_claim_to_release_pending(): void
    {
        $officer = $this->makeUser('security_officer');
        $claim = $this->approvedClaim();

        $response = $this->actingAs($officer)->postJson("/api/claims/{$claim->id}/generate-release");

        $response->assertStatus(201)->assertJsonStructure(['data' => ['public_code', 'token', 'qr_payload', 'expires_at']]);
        $this->assertEquals(Claim::STATUS_RELEASE_PENDING, $claim->fresh()->status);
    }

    public function test_generate_release_cannot_be_called_by_a_student(): void
    {
        $claim = $this->approvedClaim();
        $claimant = User::find($claim->claimant_id);

        $response = $this->actingAs($claimant)->postJson("/api/claims/{$claim->id}/generate-release");

        $response->assertStatus(403);
    }

    public function test_generate_release_fails_for_a_claim_that_is_not_approved(): void
    {
        $officer = $this->makeUser('security_officer');
        $claimant = $this->makeUser('student');
        $foundItem = FoundItem::factory()->create();

        $claim = Claim::create([
            'found_item_id' => $foundItem->id,
            'claimant_id' => $claimant->id,
            'status' => Claim::STATUS_PENDING,
        ]);

        $this->expectException(ValidationException::class);
        app(ItemReleaseService::class)->generate($claim, $officer);
    }

    public function test_manual_release_requires_a_reason_and_marks_the_claim_released(): void
    {
        $officer = $this->makeUser('security_officer');
        $claim = $this->approvedClaim();
        app(ItemReleaseService::class)->generate($claim, $officer);

        $response = $this->actingAs($officer)->postJson("/api/claims/{$claim->id}/manual-release", []);
        $response->assertStatus(422)->assertJsonValidationErrors('reason');

        $withReason = $this->actingAs($officer)->postJson("/api/claims/{$claim->id}/manual-release", [
            'reason' => 'Claimant lost their phone and could not present the QR code.',
        ]);

        $withReason->assertStatus(200);
        $this->assertEquals(Claim::STATUS_RELEASED, $claim->fresh()->status);
    }

    public function test_manual_release_closes_the_linked_lost_item(): void
    {
        $officer = $this->makeUser('security_officer');
        $claimant = $this->makeUser('student');
        $foundItem = FoundItem::factory()->create();
        $lostItem = LostItem::factory()->create(['user_id' => $claimant->id, 'status' => LostItem::STATUS_MATCHED]);

        $claim = Claim::create([
            'found_item_id' => $foundItem->id,
            'lost_item_id' => $lostItem->id,
            'claimant_id' => $claimant->id,
            'status' => Claim::STATUS_APPROVED,
        ]);
        app(ItemReleaseService::class)->generate($claim, $officer);

        app(ItemReleaseService::class)->manualRelease($claim->fresh(), $officer, 'QR unavailable.');

        $this->assertEquals(LostItem::STATUS_CLOSED, $lostItem->fresh()->status);
    }

    public function test_scan_and_release_creates_an_inventory_movement_and_closes_the_claim(): void
    {
        $officer = $this->makeUser('security_officer');
        $claim = $this->approvedClaim();
        $result = app(ItemReleaseService::class)->generate($claim, $officer);

        app(ItemReleaseService::class)->scanAndRelease($result['public_code'], $result['raw_token'], $officer);

        $this->assertEquals(Claim::STATUS_RELEASED, $claim->fresh()->status);
        $this->assertDatabaseHas('inventory_movements', [
            'found_item_id' => $claim->found_item_id,
            'action' => 'released',
        ]);
    }

    public function test_only_the_claimant_can_download_their_own_release_qr(): void
    {
        $officer = $this->makeUser('security_officer');
        $claim = $this->approvedClaim();
        app(ItemReleaseService::class)->generate($claim, $officer);

        $otherStudent = $this->makeUser('student');

        $response = $this->actingAs($otherStudent)->postJson("/api/claims/{$claim->id}/download-release");

        $response->assertStatus(403);
    }

    public function test_claimant_can_download_their_own_release_qr_once_release_pending(): void
    {
        $officer = $this->makeUser('security_officer');
        $claim = $this->approvedClaim();
        app(ItemReleaseService::class)->generate($claim, $officer);
        $claimant = User::find($claim->claimant_id);

        $response = $this->actingAs($claimant)->postJson("/api/claims/{$claim->id}/download-release");

        $response->assertStatus(201)->assertJsonStructure(['data' => ['public_code', 'qr_payload', 'expires_at']]);
    }

    public function test_regenerate_release_invalidates_the_previous_token(): void
    {
        $officer = $this->makeUser('security_officer');
        $claim = $this->approvedClaim();
        $first = app(ItemReleaseService::class)->generate($claim, $officer);

        $response = $this->actingAs($officer)->postJson("/api/claims/{$claim->id}/regenerate-release");
        $response->assertStatus(201);
        $newToken = $response->json('data.token');

        $this->assertNotEquals($first['raw_token'], $newToken);

        $this->expectException(ValidationException::class);
        app(ItemReleaseService::class)->scanAndRelease($first['public_code'], $first['raw_token'], $officer);
    }

    public function test_a_claim_cannot_be_cancelled_once_released(): void
    {
        $officer = $this->makeUser('security_officer');
        $claim = $this->approvedClaim();
        $result = app(ItemReleaseService::class)->generate($claim, $officer);
        app(ItemReleaseService::class)->scanAndRelease($result['public_code'], $result['raw_token'], $officer);

        $claimant = User::find($claim->claimant_id);
        $response = $this->actingAs($claimant)->postJson("/api/claims/{$claim->id}/cancel");

        $response->assertStatus(422);
    }

    public function test_admin_can_bulk_delete_a_users_cancelled_claims(): void
    {
        $admin = $this->makeUser('admin');
        $student = $this->makeUser('student');

        for ($i = 0; $i < 3; $i++) {
            Claim::create([
                'found_item_id' => FoundItem::factory()->create()->id,
                'claimant_id' => $student->id,
                'status' => Claim::STATUS_CANCELLED,
            ]);
        }
        Claim::create([
            'found_item_id' => FoundItem::factory()->create()->id,
            'claimant_id' => $student->id,
            'status' => Claim::STATUS_PENDING,
        ]);

        $deleted = app(ClaimService::class)->deleteCancelledForUser($student);

        $this->assertEquals(3, $deleted);
        $this->assertEquals(1, Claim::where('claimant_id', $student->id)->count());
    }
}
