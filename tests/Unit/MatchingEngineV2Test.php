<?php

namespace Tests\Unit;

use App\Models\FoundItem;
use App\Models\LostItem;
use App\Services\Matching\ItemMatchingService;
use Tests\TestCase;

/**
 * The v2 engine on in-memory reports (nothing is saved): evidence-based
 * scoring, per-field explanation, and the ceilings for hard conflicts.
 */
class MatchingEngineV2Test extends TestCase
{
    protected ItemMatchingService $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = new ItemMatchingService();
    }

    protected function lost(array $a): LostItem
    {
        return new LostItem($a + ['date_lost' => now()->toDateString()]);
    }

    protected function found(array $a): FoundItem
    {
        return new FoundItem($a + ['date_found' => now()->toDateString()]);
    }

    protected function phone(array $over = []): array
    {
        return $over + [
            'item_name' => 'Smartphone (Android)', 'category' => 'Phones & Gadgets', 'brand' => 'Samsung',
            'model' => 'Galaxy A15', 'color' => 'Black', 'description' => 'black samsung phone',
        ];
    }

    public function test_a_rich_matching_pair_is_very_high_and_every_field_is_explained(): void
    {
        $a = $this->engine->analyze(
            $this->lost($this->phone(['unique_characteristics' => 'Cracked screen, Ring holder', 'details' => ['storage' => '128GB'], 'location_lost' => 'Library'])),
            $this->found($this->phone(['item_name' => 'Smartphone', 'model' => 'A15', 'unique_characteristics' => 'cracked screen, ring holder on back', 'details' => ['storage' => '128 GB'], 'location_found' => 'Library, 2nd floor'])),
        );

        $this->assertGreaterThanOrEqual(ItemMatchingService::THRESHOLD_VERY_HIGH, $a['score']);
        $this->assertSame('very_high', $a['level']);
        $this->assertSame(array_keys(ItemMatchingService::WEIGHTS), array_keys($a['fields']));
        foreach ($a['fields'] as $f) {
            $this->assertArrayHasKey('status', $f);
            $this->assertArrayHasKey('note', $f);
            $this->assertArrayHasKey('weight', $f);
        }
        $this->assertSame('match', $a['fields']['model']['status'], '"Galaxy A15" and "A15" are the same model');
        $this->assertSame('match', $a['fields']['details']['status'], '"128GB" and "128 GB" are the same storage');
    }

    public function test_weights_sum_to_one_hundred(): void
    {
        $this->assertSame(100, array_sum(ItemMatchingService::WEIGHTS));
    }

    public function test_blank_fields_are_unknown_not_penalised(): void
    {
        $a = $this->engine->analyze(
            $this->lost(['item_name' => 'Blue Backpack', 'category' => 'Bags']),
            $this->found(['item_name' => 'Blue Backpack', 'category' => 'Bags']),
        );

        $this->assertSame('unknown', $a['fields']['brand']['status']);
        $this->assertGreaterThanOrEqual(ItemMatchingService::THRESHOLD_HIGH, $a['score']);
        // …but with so little to compare it can't claim certainty.
        $this->assertLessThan(ItemMatchingService::THRESHOLD_VERY_HIGH, $a['score']);
    }

    public function test_android_versus_apple_is_capped_below_possible(): void
    {
        $a = $this->engine->analyze(
            $this->lost($this->phone(['location_lost' => 'Library'])),
            $this->found(['item_name' => 'iPhone (Apple)', 'category' => 'Phones & Gadgets', 'brand' => 'Apple', 'model' => 'iPhone 13', 'color' => 'Black', 'description' => 'black phone', 'location_found' => 'Library']),
        );

        $this->assertLessThan(ItemMatchingService::THRESHOLD_POSSIBLE, $a['score']);
        $this->assertSame(ItemMatchingService::CAP_PLATFORM, $a['cap']);
    }

    public function test_a_different_model_of_the_same_brand_cannot_reach_high(): void
    {
        $a = $this->engine->analyze(
            $this->lost($this->phone(['location_lost' => 'Library'])),
            $this->found($this->phone(['model' => 'Galaxy A14', 'location_found' => 'Library'])),
        );

        $this->assertLessThan(ItemMatchingService::THRESHOLD_HIGH, $a['score']);
        $this->assertSame('different', $a['fields']['model']['status']);
    }

    public function test_same_base_model_but_other_variant_is_only_a_partial_model_match(): void
    {
        $a = $this->engine->analyze(
            $this->lost(['item_name' => 'iPhone', 'category' => 'Phones & Gadgets', 'brand' => 'Apple', 'model' => 'iPhone 13', 'color' => 'Blue']),
            $this->found(['item_name' => 'iPhone', 'category' => 'Phones & Gadgets', 'brand' => 'Apple', 'model' => 'iPhone 13 Pro', 'color' => 'Blue']),
        );

        $this->assertSame('similar', $a['fields']['model']['status']);
        $this->assertLessThan(ItemMatchingService::THRESHOLD_VERY_HIGH, $a['score']);
    }

    public function test_a_laptop_does_not_match_a_laptop_charger(): void
    {
        $a = $this->engine->analyze(
            $this->lost(['item_name' => 'Laptop', 'category' => 'Laptops & Computer Accessories', 'brand' => 'Acer', 'color' => 'Black']),
            $this->found(['item_name' => 'Laptop charger', 'category' => 'Laptops & Computer Accessories', 'brand' => 'Acer', 'color' => 'Black']),
        );

        $this->assertLessThan(ItemMatchingService::THRESHOLD_POSSIBLE, $a['score']);
    }

    public function test_brand_aliases_and_misspellings_still_match(): void
    {
        $a = $this->engine->analyze(
            $this->lost(['item_name' => 'Smartphone', 'brand' => 'Samsong']),
            $this->found(['item_name' => 'Cellphone', 'brand' => 'Samsung']),
        );

        $this->assertSame('match', $a['fields']['brand']['status']);
        $this->assertSame('match', $a['fields']['item_name']['status'], 'smartphone and cellphone are the same kind of item');
    }

    public function test_related_colors_earn_partial_credit_and_opposites_do_not(): void
    {
        $near = $this->engine->analyze($this->lost(['item_name' => 'Bag', 'color' => 'Navy blue']), $this->found(['item_name' => 'Bag', 'color' => 'Sky blue']));
        $far = $this->engine->analyze($this->lost(['item_name' => 'Bag', 'color' => 'Black']), $this->found(['item_name' => 'Bag', 'color' => 'White']));

        $this->assertSame('similar', $near['fields']['color']['status']);
        $this->assertSame('different', $far['fields']['color']['status']);
    }

    public function test_an_item_found_days_before_it_was_lost_is_capped_and_flagged(): void
    {
        $a = $this->engine->analyze(
            $this->lost(['item_name' => 'Black Wallet', 'category' => 'Wallets, Money & Cards', 'color' => 'Black', 'date_lost' => now()->toDateString()]),
            $this->found(['item_name' => 'Black Wallet', 'category' => 'Wallets, Money & Cards', 'color' => 'Black', 'date_found' => now()->subDays(10)->toDateString()]),
        );

        $this->assertLessThan(ItemMatchingService::THRESHOLD_HIGH, $a['score']);
        $this->assertNotEmpty(array_filter($a['flags'], fn ($f) => $f['field'] === 'date'));
    }

    public function test_score_still_returns_the_legacy_score_and_breakdown_pair(): void
    {
        [$score, $breakdown] = $this->engine->score(
            $this->lost(['item_name' => 'Black Wallet', 'color' => 'Black']),
            $this->found(['item_name' => 'Black Wallet', 'color' => 'Black']),
        );

        $this->assertIsInt($score);
        $this->assertSame(array_keys(ItemMatchingService::WEIGHTS), array_keys($breakdown));
    }
}
