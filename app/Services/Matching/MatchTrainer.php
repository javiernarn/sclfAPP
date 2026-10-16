<?php

namespace App\Services\Matching;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;

/**
 * Collects training data and fits the MatchLearner. See MatchLearner for the big picture.
 *
 * Real labels (what people actually decided) are the most valuable data:
 *   positive  a match whose claim was approved / awaiting release / released
 *             (or a claim that tied a lost report to a found item directly)
 *   negative  a match a person dismissed ("Not a match" / "Not mine").
 *             Leads the system itself retired because the item left are NOT used —
 *             "the item went to someone else" says nothing about this pair's similarity.
 *
 * Synthetic labels give the model a sensible start and cover rare conflicts:
 *   positive  a report plus a noisy re-description of the same item (typos, dropped
 *             fields, shorter text, a day or two apart, a slightly different place)
 *   negative  two different items, or the same item with brand/model/colour of another
 */
class MatchTrainer
{
    /** Item blueprints used to pad out the pool when there are few real reports (so a fresh install can train). */
    private const CATALOG = [
        ['Smartphone', 'Phones & Gadgets', 'Samsung', 'Galaxy A15', 'Black', 'Black Samsung phone with a clear case', ['cracked screen', 'ring holder']],
        ['Smartphone', 'Phones & Gadgets', 'Apple', 'iPhone 13', 'Blue', 'Blue iPhone with a scratched back', ['scratch on back', 'blue case']],
        ['Smartphone', 'Phones & Gadgets', 'Xiaomi', 'Redmi Note 12', 'Gray', 'Gray Xiaomi phone with tempered glass', ['sticker on back']],
        ['Smartphone', 'Phones & Gadgets', 'Oppo', 'A57', 'Green', 'Green Oppo phone with a lanyard', ['green lanyard']],
        ['Earbuds', 'Phones & Gadgets', 'Apple', 'AirPods Pro', 'White', 'White wireless earbuds in a charging case', ['initials on case']],
        ['Power bank', 'Phones & Gadgets', 'Anker', 'PowerCore 10000', 'Black', 'Black 10000mAh power bank with a short cable', ['scratched side']],
        ['Laptop', 'Laptops & Computer Accessories', 'Acer', 'Aspire 5', 'Silver', 'Silver laptop with a sticker on the cover', ['school sticker', 'dent on corner']],
        ['Laptop', 'Laptops & Computer Accessories', 'Lenovo', 'IdeaPad 3', 'Gray', 'Gray Lenovo laptop in a black sleeve', ['black sleeve']],
        ['Flash drive', 'Phones & Gadgets', 'Kingston', 'DataTraveler 32GB', 'Red', 'Red flash drive on a keychain', ['keychain']],
        ['Wallet', 'Wallets, Money & Cards', null, null, 'Black', 'Black leather wallet with some cards inside', ['worn corner', 'student ID inside']],
        ['Wallet', 'Wallets, Money & Cards', 'Bifold', null, 'Brown', 'Brown bifold wallet', ['torn stitching']],
        ['ID card', 'IDs & Documents', null, null, 'White', 'Student ID with a blue lanyard', ['blue lanyard']],
        ['Umbrella', 'Umbrellas & Rain Gear', null, null, 'Blue', 'Blue folding umbrella with a wooden handle', ['wooden handle']],
        ['Water bottle', 'Water Bottles & Food Containers', 'Hydro Flask', null, 'Teal', 'Teal insulated bottle with stickers', ['dent at the bottom', 'stickers']],
        ['Tumbler', 'Water Bottles & Food Containers', null, null, 'Pink', 'Pink tumbler with a straw', ['name label']],
        ['Backpack', 'Bags', 'Jansport', null, 'Black', 'Black backpack with a broken zipper', ['broken zipper', 'keychain']],
        ['Keys', 'Keys', null, null, 'Silver', 'Bunch of keys on a ring', ['red tag', 'three keys']],
        ['Eyeglasses', 'Accessories & Jewelry', null, null, 'Black', 'Black-framed eyeglasses in a case', ['thick frame']],
        ['Calculator', 'School Supplies', 'Casio', 'fx-991ES', 'Gray', 'Gray scientific calculator', ['name written at the back']],
        ['Notebook', 'Books & Notebooks', null, null, 'Green', 'Green notebook with handwritten notes', ['doodles on cover']],
        ['Jacket', 'Uniforms & Clothing', 'Nike', null, 'Navy', 'Navy blue jacket with a hood', ['torn pocket']],
        ['Sneakers', 'Footwear', 'Adidas', null, 'White', 'White sneakers size 42', ['size 42']],
        ['Wristwatch', 'Accessories & Jewelry', 'Casio', 'F-91W', 'Black', 'Black digital wristwatch', ['scratched strap']],
        ['Headphones', 'Phones & Gadgets', 'JBL', 'Tune 510BT', 'Black', 'Black wireless headphones', ['left ear pad worn']],
    ];

    private const PLACES = ['Library', 'Cafeteria', 'Gymnasium', 'Main Building', 'Computer Laboratory', 'Covered Court', 'Admin Office', 'Classroom 101'];

    private MatchLearner $learner;

    private ItemMatchingService $engine;

    public function __construct(?MatchLearner $learner = null, ?ItemMatchingService $engine = null)
    {
        $this->learner = $learner ?? new MatchLearner();
        $this->engine = $engine ?? new ItemMatchingService();
    }

    /**
     * Train and (unless $dryRun) save a model.
     *
     * @return array{trained:bool, reason?:string, model?:array, saved:bool}
     */
    public function train(int $synthetic = 1200, bool $dryRun = false, int $minSamples = 40, int $seed = 42): array
    {
        mt_srand($seed);

        $pool = $this->pool();
        $real = $this->realSamples();

        // IDF comes from every report we know about, so "common" is measured on your own campus's vocabulary.
        $idfModel = $this->learner->buildIdf(array_map(fn ($bp) => $this->learner->text($this->asLost($bp)), $pool));

        $samples = [];
        foreach ($real as [$lost, $found, $label]) {
            $samples[] = $this->sample($lost, $found, $label, 3.0, 'real', $idfModel);
        }
        $nReal = count($samples);
        $nRealPos = count(array_filter($samples, fn ($s) => $s['y'] === 1));

        if ($synthetic > 0 && count($pool) >= 2) {
            foreach ($this->syntheticPairs($pool, $synthetic) as [$lost, $found, $label]) {
                $samples[] = $this->sample($lost, $found, $label, 1.0, 'synthetic', $idfModel);
            }
        }

        $samples = array_values(array_filter($samples));
        $labels = array_count_values(array_column($samples, 'y'));
        if (count($samples) < $minSamples || count($labels) < 2) {
            return ['trained' => false, 'saved' => false, 'reason' => 'Not enough labelled pairs yet (' . count($samples) . ', need ' . $minSamples . ' with both kinds). Keep using the rules; try again after more reports or outcomes.'];
        }

        // Hold out a fifth for an honest accuracy figure, then fit on everything.
        [$train, $test] = $this->split($samples);
        $check = $this->learner->fit(array_column($train, 'x'), array_column($train, 'y'), array_column($train, 'w'));
        $metrics = $this->learner->evaluate($check, array_column($test, 'x'), array_column($test, 'y'));
        // The honest baseline: the rule engine on its own, judged "same item" from the "possible" threshold up.
        $rulesOnly = $this->learner->metrics(
            array_map(fn ($s) => $s['rule'] / 100, $test),
            array_column($test, 'y'),
            ItemMatchingService::THRESHOLD_POSSIBLE / 100,
        );

        $fit = $this->learner->fit(array_column($samples, 'x'), array_column($samples, 'y'), array_column($samples, 'w'));

        $model = [
            'version' => 1,
            'trained_at' => now()->toIso8601String(),
            'bias' => $fit['bias'],
            'weights' => $fit['weights'],
            'idf' => $idfModel['idf'],
            'default_idf' => $idfModel['default_idf'],
            'samples' => [
                'total' => count($samples),
                'real' => $nReal,
                'real_positive' => $nRealPos,
                'real_negative' => $nReal - $nRealPos,
                'synthetic' => count($samples) - $nReal,
            ],
            'metrics' => $metrics + ['rules_accuracy' => $rulesOnly['accuracy'], 'rules_auc' => $rulesOnly['auc']],
        ];

        if (!$dryRun) {
            MatchLearner::save($model);
        }

        return ['trained' => true, 'saved' => !$dryRun, 'model' => $model];
    }

    // ------------------------------------------------------------------
    // Samples
    // ------------------------------------------------------------------

    /** @return array{x:array,y:int,w:float,kind:string}|null */
    protected function sample($lost, $found, int $label, float $weight, string $kind, array $idfModel): ?array
    {
        // Rule analysis only (no model): the learner must not learn from its own output.
        $a = $this->engine->analyze($lost, $found, false);

        return [
            'x' => $this->learner->features($a['fields'], $lost, $found, $idfModel),
            'rule' => $a['score'],
            'y' => $label,
            'w' => $weight,
            'kind' => $kind,
        ];
    }

    /** Deterministic 80/20 split that keeps both classes in each part. */
    protected function split(array $samples): array
    {
        $train = [];
        $test = [];
        $seen = [0 => 0, 1 => 0];
        foreach ($samples as $s) {
            $seen[$s['y']]++;
            if ($seen[$s['y']] % 5 === 0) {
                $test[] = $s;
            } else {
                $train[] = $s;
            }
        }

        return [$train, $test];
    }

    /** @return array<int,array{0:LostItem,1:FoundItem,2:int}> */
    protected function realSamples(): array
    {
        $pairs = [];

        // Positives: claims that got as far as approval.
        $okClaims = [Claim::STATUS_APPROVED, Claim::STATUS_RELEASE_PENDING, Claim::STATUS_RELEASED];
        Claim::query()->whereIn('status', $okClaims)->whereNotNull('lost_item_id')
            ->with(['lostItem', 'foundItem'])->get()
            ->each(function (Claim $c) use (&$pairs) {
                if ($c->lostItem && $c->foundItem) {
                    $pairs[$c->lost_item_id . ':' . $c->found_item_id] = [$c->lostItem, $c->foundItem, 1];
                }
            });

        // Negatives: leads a person ruled out (never the ones the system retired).
        ItemMatch::query()->where('status', ItemMatch::STATUS_DISMISSED)
            ->with(['lostItem', 'foundItem'])->get()
            ->each(function (ItemMatch $m) use (&$pairs) {
                $key = $m->lost_item_id . ':' . $m->found_item_id;
                if (!$m->lostItem || !$m->foundItem || isset($pairs[$key]) || !empty($m->score_details['retired'])) {
                    return;
                }
                $pairs[$key] = [$m->lostItem, $m->foundItem, 0];
            });

        return array_values($pairs);
    }

    // ------------------------------------------------------------------
    // Synthetic data
    // ------------------------------------------------------------------

    /**
     * Plain-array "blueprints" of items: every real report plus a built-in catalog (so a
     * fresh install, or one with a handful of reports, still has variety to learn from).
     *
     * @return array<int,array<string,mixed>>
     */
    protected function pool(): array
    {
        $pool = [];
        foreach (LostItem::query()->latest('id')->limit(600)->get() as $r) {
            $pool[] = $this->blueprint($r, 'location_lost', 'date_lost');
        }
        foreach (FoundItem::query()->latest('id')->limit(600)->get() as $r) {
            $pool[] = $this->blueprint($r, 'location_found', 'date_found');
        }
        foreach (self::CATALOG as [$name, $cat, $brand, $model, $color, $desc, $traits]) {
            $pool[] = [
                'item_name' => $name, 'category' => $cat, 'brand' => $brand, 'model' => $model, 'color' => $color,
                'description' => $desc, 'unique_characteristics' => implode(', ', $traits), 'details' => [],
                'place' => self::PLACES[array_rand(self::PLACES)], 'date' => now()->subDays(mt_rand(0, 40))->toDateString(),
            ];
        }

        // Keep only items that say something specific enough to describe twice.
        return array_values(array_filter($pool, fn ($bp) => ($bp['item_name'] ?? '') !== '' && ($bp['category'] ?? '') !== ''));
    }

    protected function blueprint($r, string $placeKey, string $dateKey): array
    {
        return [
            'item_name' => (string) $r->item_name, 'category' => (string) $r->category, 'brand' => $r->brand, 'model' => $r->model,
            'color' => $r->color, 'description' => $r->description, 'unique_characteristics' => $r->unique_characteristics,
            'details' => is_array($r->details) ? $r->details : [],
            'place' => $r->$placeKey, 'date' => $r->$dateKey?->toDateString(),
        ];
    }

    /** @return \Generator<int,array{0:LostItem,1:FoundItem,2:int}> */
    protected function syntheticPairs(array $pool, int $count): \Generator
    {
        $half = intdiv($count, 2);
        $n = count($pool);

        // Positives: the same item described twice.
        for ($i = 0; $i < $half; $i++) {
            $bp = $pool[mt_rand(0, $n - 1)];
            $twin = $this->noisyTwin($bp);
            [$lostBp, $foundBp] = mt_rand(0, 1) ? [$bp, $twin] : [$twin, $bp];
            if (!empty($lostBp['date']) && !empty($foundBp['date']) && $foundBp['date'] < $lostBp['date']) {
                [$lostBp['date'], $foundBp['date']] = [$foundBp['date'], $lostBp['date']];
            }
            yield [$this->asLost($lostBp), $this->asFound($foundBp, $lostBp), 1];
        }

        // Negatives: 40% two different items, 60% "almost" the same item but a key identifier belongs to another.
        for ($i = 0; $i < $count - $half; $i++) {
            $x = $pool[mt_rand(0, $n - 1)];
            $y = $pool[mt_rand(0, $n - 1)];
            if ($this->sameIdentity($x, $y)) {
                $y = $pool[($i * 7 + 3) % $n];
                if ($this->sameIdentity($x, $y)) {
                    continue;
                }
            }

            if (mt_rand(1, 100) <= 40) {
                $lostBp = $this->noisyTwin($x, light: true);
                $foundBp = $y;
                if (mt_rand(0, 1)) {
                    $foundBp['place'] = $lostBp['place'] ?? $y['place']; // a different item can well turn up in the same place
                }
            } else {
                $lostBp = $this->noisyTwin($x);
                // A negative must differ in a way the two reports can actually show: another brand /
                // model / colour is only a real conflict when BOTH sides state that field. (Stamping
                // "Samsung" on a wallet whose twin has no brand is a difference nobody could ever see,
                // and labelling it "different" just teaches the model noise.)
                $visible = false;
                foreach (['brand', 'model', 'color'] as $key) {
                    if (mt_rand(0, 1) && ($y[$key] ?? null) && ($x[$key] ?? null) && ($lostBp[$key] ?? null)
                        && mb_strtolower((string) $y[$key]) !== mb_strtolower((string) $x[$key])) {
                        $lostBp[$key] = $y[$key];
                        $visible = true;
                    }
                }
                if (mt_rand(0, 3) === 0) {
                    $lostBp['item_name'] = $y['item_name'];
                    $lostBp['category'] = $y['category'];
                    $visible = $visible || !$this->sameIdentity(['item_name' => $x['item_name'], 'category' => $x['category']], ['item_name' => $y['item_name'], 'category' => $y['category']]);
                }
                if (!$visible || $this->sameIdentity($x, $lostBp)) {
                    continue; // nothing actually differed
                }
                $foundBp = $x;
            }

            // Dates behave exactly as in the positives (found 0–10 days after lost, sometimes longer), so
            // "dates line up" is never what separates the classes.
            if (!empty($lostBp['date'])) {
                $foundBp['date'] = \Carbon\Carbon::parse($lostBp['date'])->addDays(mt_rand(0, 100) <= 90 ? mt_rand(0, 10) : mt_rand(11, 40))->toDateString();
            }
            $lost = $this->asLost($lostBp);
            $found = $this->asFound($foundBp, $lostBp);

            // Skip pairs so alike a person could not tell them apart: probably the same item twice, not a true negative.
            if ($this->engine->analyze($lost, $found, false)['score'] >= 92) {
                continue;
            }
            yield [$lost, $found, 0];
        }
    }

    protected function sameIdentity(array $a, array $b): bool
    {
        $k = fn (array $x) => mb_strtolower(trim(($x['item_name'] ?? '') . '|' . ($x['brand'] ?? '') . '|' . ($x['model'] ?? '') . '|' . ($x['color'] ?? '')));

        return $k($a) === $k($b);
    }

    /** A second, imperfect description of the same item — the way a finder differs from an owner. */
    protected function noisyTwin(array $bp, bool $light = false): array
    {
        $t = $bp;
        $drop = fn (int $pct) => !$light && mt_rand(1, 100) <= $pct;

        $r = mt_rand(1, 100);
        if ($r <= 20) {
            $t['item_name'] = $this->typo($bp['item_name']);
        } elseif ($r <= 40 && !empty($bp['color'])) {
            $t['item_name'] = trim($bp['color'] . ' ' . $bp['item_name']);
        } elseif ($r <= 50) {
            $t['item_name'] = mb_strtolower($bp['item_name']);
        }

        if ($drop(20)) {
            $t['brand'] = null;
        }
        if ($drop(30)) {
            $t['model'] = null;
        }
        if ($drop(15)) {
            $t['color'] = null;
        }
        if ($drop(40)) {
            $t['unique_characteristics'] = null;
        } elseif (!empty($bp['unique_characteristics']) && mt_rand(0, 2) === 0) {
            $traits = array_map('trim', explode(',', $bp['unique_characteristics']));
            $t['unique_characteristics'] = $traits[array_rand($traits)];
        }
        if ($drop(30)) {
            $t['description'] = null;
        } elseif (!empty($bp['description']) && mt_rand(0, 1)) {
            $words = preg_split('/\s+/', $bp['description']);
            $t['description'] = implode(' ', array_slice($words, 0, max(2, (int) ceil(count($words) * 0.6))));
        }
        if ($drop(40)) {
            $t['details'] = [];
        }
        if ($drop(20)) {
            $t['place'] = null;
        } elseif (mt_rand(1, 100) <= 25) {
            $t['place'] = self::PLACES[array_rand(self::PLACES)];
        }
        if (!empty($bp['date'])) {
            $t['date'] = \Carbon\Carbon::parse($bp['date'])->addDays(mt_rand(0, 100) <= 90 ? mt_rand(0, 10) : mt_rand(11, 40))->toDateString();
        }

        return $t;
    }

    protected function typo(string $s): string
    {
        $n = mb_strlen($s);
        if ($n < 4) {
            return $s;
        }
        $i = mt_rand(1, $n - 2);

        return match (mt_rand(0, 2)) {
            0 => mb_substr($s, 0, $i) . mb_substr($s, $i + 1),                                          // dropped letter
            1 => mb_substr($s, 0, $i) . mb_substr($s, $i, 1) . mb_substr($s, $i, 1) . mb_substr($s, $i + 1), // doubled letter
            default => mb_substr($s, 0, $i) . mb_substr($s, $i + 1, 1) . mb_substr($s, $i, 1) . mb_substr($s, $i + 2), // swapped
        };
    }

    protected function asLost(array $bp): LostItem
    {
        return new LostItem($this->common($bp) + ['location_lost' => $bp['place'] ?? null, 'date_lost' => $bp['date'] ?? null]);
    }

    /** @param array $lostSide the other half of the pair: a found date is never put before its lost date by accident */
    protected function asFound(array $bp, array $lostSide): FoundItem
    {
        $date = $bp['date'] ?? null;
        // A found date earlier than the lost date is rare and capped by the engine; keep generated pairs realistic.
        if ($date && !empty($lostSide['date']) && $date < $lostSide['date'] && $bp !== $lostSide) {
            $date = $lostSide['date'];
        }

        return new FoundItem($this->common($bp) + ['location_found' => $bp['place'] ?? null, 'date_found' => $date]);
    }

    protected function common(array $bp): array
    {
        return [
            'item_name' => $bp['item_name'] ?? null, 'category' => $bp['category'] ?? null, 'brand' => $bp['brand'] ?? null,
            'model' => $bp['model'] ?? null, 'color' => $bp['color'] ?? null, 'description' => $bp['description'] ?? null,
            'unique_characteristics' => $bp['unique_characteristics'] ?? null, 'details' => $bp['details'] ?? [],
        ];
    }
}
