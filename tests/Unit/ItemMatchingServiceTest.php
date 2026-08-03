<?php

namespace Tests\Unit;

use App\Models\FoundItem;
use App\Models\LostItem;
use App\Services\Matching\ItemMatchingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ItemMatchingServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_identical_items_score_very_high(): void
    {
        $lost = LostItem::factory()->create([
            'item_name' => 'Black Wallet',
            'category' => 'Wallets',
            'brand' => 'Fossil',
            'color' => 'Black',
            'location_lost' => 'Library',
            'date_lost' => now()->toDateString(),
            'description' => 'A black leather wallet with a zipper coin pocket',
        ]);

        $found = FoundItem::factory()->create([
            'item_name' => 'Black Wallet',
            'category' => 'Wallets',
            'brand' => 'Fossil',
            'color' => 'Black',
            'location_found' => 'Library',
            'date_found' => now()->toDateString(),
            'description' => 'A black leather wallet with a zipper coin pocket',
        ]);

        $service = new ItemMatchingService();
        [$score, $breakdown] = $service->score($lost, $found);

        $this->assertGreaterThanOrEqual(ItemMatchingService::THRESHOLD_VERY_HIGH, $score);
        $this->assertEquals('very_high', $service->matchLevel($score));
    }

    public function test_unrelated_items_score_low(): void
    {
        $lost = LostItem::factory()->create([
            'item_name' => 'Silver Laptop',
            'category' => 'Electronics',
            'brand' => 'Dell',
            'color' => 'Silver',
            'location_lost' => 'Gymnasium',
            'date_lost' => now()->subMonths(2)->toDateString(),
            'description' => 'A silver laptop with a cracked corner',
        ]);

        $found = FoundItem::factory()->create([
            'item_name' => 'Red Umbrella',
            'category' => 'Accessories',
            'brand' => 'Totes',
            'color' => 'Red',
            'location_found' => 'Cafeteria',
            'date_found' => now()->toDateString(),
            'description' => 'A red compact umbrella',
        ]);

        $service = new ItemMatchingService();
        [$score, $breakdown] = $service->score($lost, $found);

        $this->assertLessThan(ItemMatchingService::THRESHOLD_POSSIBLE, $score);
    }

    public function test_the_engine_never_assigns_ownership_it_only_records_a_candidate(): void
    {
        $lost = LostItem::factory()->create(['item_name' => 'Blue Backpack', 'category' => 'Bags']);
        $found = FoundItem::factory()->create(['item_name' => 'Blue Backpack', 'category' => 'Bags']);

        $service = new ItemMatchingService();
        $matches = $service->runForLostItem($lost);

        foreach ($matches as $match) {
            $this->assertContains($match->status, ['pending', 'notified']);
            $this->assertNotEquals('claimed', $match->status);
        }

        // The found item's status is untouched by matching alone — a human
        // still has to review and approve a claim before anything changes.
        $this->assertEquals(FoundItem::STATUS_STORED, $found->fresh()->status);
    }
}
