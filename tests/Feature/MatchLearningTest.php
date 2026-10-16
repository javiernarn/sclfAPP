<?php

namespace Tests\Feature;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;
use App\Models\User;
use App\Services\Matching\ItemMatchingService;
use App\Services\Matching\MatchLearner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The machine-learning layer: trains from outcomes + synthetic pairs, is blended into
 * scores, never overrides the hard-conflict ceilings, and is optional.
 */
class MatchLearningTest extends TestCase
{
    use RefreshDatabase;

    private string $modelPath;

    protected function setUp(): void
    {
        parent::setUp();
        $this->modelPath = sys_get_temp_dir() . '/sclf-model-' . uniqid() . '.json';
        config(['sclf.matching.ml_enabled' => true, 'sclf.matching.model_path' => $this->modelPath]);
        MatchLearner::flush();
    }

    protected function tearDown(): void
    {
        @unlink($this->modelPath);
        MatchLearner::flush();
        parent::tearDown();
    }

    protected function phone(array $over = []): array
    {
        return $over + [
            'item_name' => 'Smartphone', 'category' => 'Phones & Gadgets', 'brand' => 'Samsung', 'model' => 'Galaxy A15',
            'color' => 'Black', 'description' => 'Black Samsung phone with a cracked screen', 'unique_characteristics' => 'Cracked screen, ring holder',
        ];
    }

    protected function pair(array $lostOver = [], array $foundOver = []): array
    {
        $lost = new LostItem($lostOver + $this->phone() + ['location_lost' => 'Library', 'date_lost' => now()->toDateString()]);
        $found = new FoundItem($foundOver + $this->phone() + ['location_found' => 'Library', 'date_found' => now()->toDateString()]);

        return [$lost, $found];
    }

    public function test_it_trains_from_the_built_in_catalog_on_a_fresh_install_and_beats_nothing(): void
    {
        $this->artisan('matches:train')->assertSuccessful();

        $this->assertFileExists($this->modelPath);
        $model = json_decode(file_get_contents($this->modelPath), true);
        $this->assertGreaterThanOrEqual(1000, $model['samples']['total']);
        $this->assertSame(0, $model['samples']['real']);
        $this->assertGreaterThan(0.90, $model['metrics']['accuracy']);
        $this->assertGreaterThan(0.95, $model['metrics']['auc']);
        // It learned that a brand / model agreement is strong evidence.
        $this->assertGreaterThan(0.5, $model['weights']['brand']);
    }

    public function test_a_trained_model_is_blended_into_the_score_and_explained(): void
    {
        $engine = new ItemMatchingService();
        [$lost, $found] = $this->pair();

        $this->assertNull($engine->analyze($lost, $found)['ml'], 'no model yet: rules only');

        $this->artisan('matches:train')->assertSuccessful();

        $same = $engine->analyze($lost, $found);
        $this->assertNotNull($same['ml']);
        $this->assertGreaterThan(0.9, $same['ml']['probability']);
        $this->assertGreaterThanOrEqual(ItemMatchingService::THRESHOLD_HIGH, $same['score']);
        $this->assertNotEmpty($same['ml']['top_factors']);

        [$lostB, $foundB] = $this->pair([], ['item_name' => 'Wallet', 'category' => 'Wallets, Money & Cards', 'brand' => null, 'model' => null,
            'description' => 'Brown leather wallet', 'unique_characteristics' => 'torn stitching', 'color' => 'Brown']);
        $different = $engine->analyze($lostB, $foundB);
        $this->assertLessThan(0.2, $different['ml']['probability']);
        $this->assertLessThan(ItemMatchingService::THRESHOLD_POSSIBLE, $different['score']);
    }

    public function test_the_model_cannot_lift_a_pair_past_a_hard_conflict_ceiling(): void
    {
        $this->artisan('matches:train')->assertSuccessful();
        $engine = new ItemMatchingService();

        // Everything agrees except it's an Apple phone vs a Samsung phone.
        [$lost, $found] = $this->pair([], ['brand' => 'Apple', 'model' => 'iPhone 13']);
        $a = $engine->analyze($lost, $found);

        $this->assertLessThanOrEqual(ItemMatchingService::CAP_PLATFORM, $a['score']);
    }

    public function test_it_is_a_typo_tolerant_text_matcher_where_the_rules_alone_are_blunt(): void
    {
        $learner = new MatchLearner();
        [$a, $b] = $this->pair(['item_name' => 'Smarthpone'], []);

        $this->assertGreaterThan(0.6, $learner->trigramDice('smarthpone', 'smartphone'));
        $this->assertGreaterThan(
            $learner->tfidfCosine($learner->text($a), $learner->text(new FoundItem($this->phone(['description' => 'Red umbrella', 'item_name' => 'Umbrella']))), [], 1.0),
            $learner->tfidfCosine($learner->text($a), $learner->text($b), [], 1.0)
        );
    }

    public function test_real_outcomes_are_learned_from_and_raise_the_models_say(): void
    {
        $owner = User::factory()->create();
        $positives = [];
        for ($i = 0; $i < 3; $i++) {
            $lost = LostItem::factory()->create($this->phone(['user_id' => $owner->id, 'model' => "Galaxy A1{$i}", 'status' => LostItem::STATUS_CLAIMED]));
            $found = FoundItem::factory()->create($this->phone(['model' => "Galaxy A1{$i}", 'status' => FoundItem::STATUS_CLAIMED]));
            $match = ItemMatch::create(['lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 90, 'match_level' => 'very_high', 'status' => ItemMatch::STATUS_CLAIMED]);
            Claim::create(['found_item_id' => $found->id, 'lost_item_id' => $lost->id, 'item_match_id' => $match->id, 'claimant_id' => $owner->id, 'status' => Claim::STATUS_APPROVED]);
            $positives[] = $match;
        }
        // Two leads a person ruled out…
        for ($i = 0; $i < 2; $i++) {
            $lost = LostItem::factory()->create($this->phone(['user_id' => $owner->id, 'color' => 'Pink']));
            $found = FoundItem::factory()->create($this->phone(['model' => 'Galaxy S21', 'color' => 'Gold']));
            ItemMatch::create(['lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 55, 'match_level' => 'low', 'status' => ItemMatch::STATUS_DISMISSED]);
        }
        // …and one the SYSTEM retired because the item left — must not count as "not a match".
        $lost = LostItem::factory()->create($this->phone(['user_id' => $owner->id]));
        $found = FoundItem::factory()->create($this->phone());
        $retired = ItemMatch::create(['lost_item_id' => $lost->id, 'found_item_id' => $found->id, 'score' => 95, 'match_level' => 'very_high', 'status' => ItemMatch::STATUS_PENDING]);
        $retired->retire('found_item_released');

        $this->artisan('matches:train')->assertSuccessful();
        $model = json_decode(file_get_contents($this->modelPath), true);

        $this->assertSame(5, $model['samples']['real']);
        $this->assertSame(3, $model['samples']['real_positive']);
        $this->assertSame(2, $model['samples']['real_negative']);
        $this->assertGreaterThan(MatchLearner::BASE_WEIGHT, MatchLearner::weightFor($model));
    }

    public function test_it_does_not_train_without_enough_data_and_leaves_the_rules_in_charge(): void
    {
        $this->artisan('matches:train', ['--synthetic' => 0])->assertSuccessful();

        $this->assertFileDoesNotExist($this->modelPath);
        [$lost, $found] = $this->pair();
        $this->assertNull((new ItemMatchingService())->analyze($lost, $found)['ml']);
    }

    public function test_switching_ml_off_restores_pure_rule_scores(): void
    {
        $engine = new ItemMatchingService();
        [$lost, $found] = $this->pair(['model' => 'A15'], ['unique_characteristics' => null]);
        $rules = $engine->analyze($lost, $found)['score'];

        $this->artisan('matches:train')->assertSuccessful();
        config(['sclf.matching.ml_enabled' => false]);

        $this->assertSame($rules, $engine->analyze($lost, $found)['score']);
        $this->assertNull($engine->analyze($lost, $found)['ml']);
    }

    public function test_the_status_endpoint_reports_the_model_to_handlers(): void
    {
        $this->seed(\Database\Seeders\RoleSeeder::class);
        $officer = User::factory()->create(['is_active' => true]);
        $officer->assignRole('security_officer');

        $this->actingAs($officer)->getJson('/api/matches/model')->assertOk()->assertJson(['enabled' => true, 'trained' => false]);

        $this->artisan('matches:train')->assertSuccessful();

        $this->actingAs($officer)->getJson('/api/matches/model')->assertOk()
            ->assertJson(['trained' => true])->assertJsonStructure(['metrics' => ['accuracy', 'auc'], 'samples' => ['total', 'real']]);
    }
}
