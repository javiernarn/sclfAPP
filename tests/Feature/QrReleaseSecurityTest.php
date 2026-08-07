<?php

namespace Tests\Feature;

use App\Models\Claim;
use App\Models\FoundItem;
// use App\Models\QrRelease;
use App\Models\User;
use App\Services\Release\ItemReleaseService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class QrReleaseSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function officer(): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $officer */
        $officer = User::factory()->create(['is_active' => true]);
        $officer->assignRole('security_officer');

        return $officer;
    }

    protected function approvedClaim(): Claim
    {
        /** @var FoundItem $found */
        $found = FoundItem::factory()->create();

        /** @var User $claimant */
        $claimant = User::factory()->create();

        return Claim::create([
            'found_item_id' => $found->id,
            'claimant_id' => $claimant->id,
            'status' => Claim::STATUS_APPROVED,
        ]);
    }

    public function test_a_used_release_code_cannot_be_scanned_again(): void
    {
        $officer = $this->officer();
        $claim = $this->approvedClaim();
        $service = app(ItemReleaseService::class);

        $result = $service->generate($claim, $officer);

        $service->scanAndRelease($result['public_code'], $result['raw_token'], $officer);

        $this->expectException(ValidationException::class);
        $service->scanAndRelease($result['public_code'], $result['raw_token'], $officer);
    }

    public function test_an_expired_release_code_is_rejected(): void
    {
        $officer = $this->officer();
        $claim = $this->approvedClaim();
        $service = app(ItemReleaseService::class);

        $result = $service->generate($claim, $officer);
        $result['qr_release']->update(['expires_at' => now()->subDay()]);

        $this->expectException(ValidationException::class);
        $service->scanAndRelease($result['public_code'], $result['raw_token'], $officer);
    }

    public function test_a_wrong_token_for_a_valid_code_is_rejected(): void
    {
        $officer = $this->officer();
        $claim = $this->approvedClaim();
        $service = app(ItemReleaseService::class);

        $result = $service->generate($claim, $officer);

        $this->expectException(ValidationException::class);
        $service->scanAndRelease($result['public_code'], 'totally-wrong-token', $officer);
    }

    public function test_only_a_security_officer_or_admin_can_hit_the_scan_endpoint(): void
    {
        $this->seed(RoleSeeder::class);

        /** @var User $student */
        $student = User::factory()->create(['is_active' => true]);
        $student->assignRole('student');

        $response = $this->actingAs($student)->postJson('/api/qr/scan', [
            'public_code' => 'SCLF-ITEM-000001',
            'token' => 'anything',
        ]);

        $response->assertStatus(403);
    }
}