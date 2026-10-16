<?php

namespace App\Services\Matching;

/**
 * The machine-learning half of the matching engine (pure PHP — no extra server,
 * no Python, runs fine on XAMPP / shared hosting).
 *
 * What it is
 * ----------
 * A logistic-regression classifier that answers one question for a lost/found pair:
 * "how likely is it that these two reports describe the same physical item?".
 *
 * Inputs (12 numbers, each scaled to -1 … +1, 0 = "no information"):
 *   - the ten per-field agreement ratios from the rule engine (category, name, brand,
 *     model, colour, unique marks, description, specs, place, date), and
 *   - two text-similarity features the rules don't have:
 *       text_similarity  TF-IDF cosine over everything written about the item, so rare,
 *                        telling words ("cracked", "sticker", "A15") count more than common ones
 *       name_similarity  character-trigram overlap of the item names, tolerant of typos
 *
 * How it learns
 * -------------
 * `matches:train` fits the weights by gradient descent on
 *   - real outcomes: matches whose claim was approved / released (positives) and matches a
 *     person ruled out with "Not a match" / "Not mine" (negatives), and
 *   - synthetic pairs generated from the stored reports (a report + a realistically
 *     noisy re-description of it = same item; mismatched brand/model/colour/type = different),
 *     so it works from day one and gets sharper as real outcomes accumulate.
 * The weights are pulled gently toward the hand-tuned rule weights (L2 prior), so a small
 * dataset can never wreck the scoring.
 *
 * How it is used
 * --------------
 * The final score = (1 − w) × rule score + w × model probability, where w grows with the
 * amount of real feedback (never above MAX_WEIGHT). The hard-conflict ceilings in
 * ItemMatchingService still apply afterwards, and a person always makes the final call
 * through the claim workflow. With no trained model, scoring is exactly the rule engine.
 */
class MatchLearner
{
    public const FIELD_FEATURES = [
        'category', 'item_name', 'brand', 'model', 'color',
        'unique_characteristics', 'description', 'details', 'location', 'date',
    ];

    public const TEXT_FEATURES = ['text_similarity', 'name_similarity'];

    public const FEATURE_LABELS = [
        'category' => 'Category', 'item_name' => 'Item name', 'brand' => 'Brand', 'model' => 'Model',
        'color' => 'Color', 'unique_characteristics' => 'Unique marks', 'description' => 'Description',
        'details' => 'Specs & extras', 'location' => 'Place', 'date' => 'Date',
        'text_similarity' => 'Overall wording (TF-IDF)', 'name_similarity' => 'Name spelling',
    ];

    // The model's say in the final score: BASE with synthetic-only training, rising to MAX with real feedback.
    public const BASE_WEIGHT = 0.25;
    public const MAX_WEIGHT = 0.60;
    public const REAL_SAMPLES_FOR_MAX = 150;

    private static ?array $model = null;
    private static ?string $loadedKey = null;

    // ------------------------------------------------------------------
    // Model file
    // ------------------------------------------------------------------

    public static function enabled(): bool
    {
        try {
            return (bool) config('sclf.matching.ml_enabled', true);
        } catch (\Throwable) {
            return false; // no app container (bare unit test): rules only
        }
    }

    public static function path(): string
    {
        try {
            return (string) config('sclf.matching.model_path', storage_path('app/matching/model.json'));
        } catch (\Throwable) {
            return sys_get_temp_dir() . '/sclf-matching-model.json';
        }
    }

    /** The trained model, or null when there is none (or ML is switched off). */
    public static function model(): ?array
    {
        if (!self::enabled()) {
            return null;
        }
        $path = self::path();
        $mtime = @filemtime($path) ?: 0;
        $key = $path . '|' . $mtime;

        if (self::$loadedKey !== $key) {
            self::$loadedKey = $key;
            self::$model = null;
            if ($mtime && is_readable($path)) {
                $data = json_decode((string) file_get_contents($path), true);
                if (is_array($data) && isset($data['weights'], $data['bias'])) {
                    self::$model = $data;
                }
            }
        }

        return self::$model;
    }

    /** Forget the in-memory copy (after training, or when tests swap the model file). */
    public static function flush(): void
    {
        self::$model = null;
        self::$loadedKey = null;
    }

    public static function save(array $model): void
    {
        $path = self::path();
        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0775, true);
        }
        $tmp = $path . '.tmp';
        file_put_contents($tmp, json_encode($model, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
        rename($tmp, $path);
        self::flush();
    }

    // ------------------------------------------------------------------
    // Prior (what the model starts from, and is pulled back toward)
    // ------------------------------------------------------------------

    /** @return array{bias:float, weights:array<string,float>} */
    public static function prior(): array
    {
        $w = [];
        foreach (self::FIELD_FEATURES as $k) {
            $w[$k] = ItemMatchingService::WEIGHTS[$k] * 0.05;
        }
        foreach (self::TEXT_FEATURES as $k) {
            $w[$k] = 0.6;
        }

        return ['bias' => -2.0, 'weights' => $w];
    }

    // ------------------------------------------------------------------
    // Features
    // ------------------------------------------------------------------

    /**
     * The 12 inputs for one pair.
     *
     * @param  array<string,array>  $fields  the rule engine's per-field rows (each with a 'ratio', null = unknown)
     * @param  array|null  $idfModel  something with 'idf' + 'default_idf' (the trained model, or the one being trained)
     * @return array<string,float>
     */
    public function features(array $fields, $lost, $found, ?array $idfModel = null): array
    {
        $x = [];
        foreach (self::FIELD_FEATURES as $k) {
            $ratio = $fields[$k]['ratio'] ?? null;
            $x[$k] = $ratio === null ? 0.0 : 2 * (float) $ratio - 1;
        }

        $textL = $this->text($lost);
        $textF = $this->text($found);
        $x['text_similarity'] = ($textL === [] || $textF === []) ? 0.0
            : 2 * $this->tfidfCosine($textL, $textF, $idfModel['idf'] ?? [], (float) ($idfModel['default_idf'] ?? 1.0)) - 1;

        $nameL = MatchVocabulary::clean($this->val($lost, 'item_name'));
        $nameF = MatchVocabulary::clean($this->val($found, 'item_name'));
        $x['name_similarity'] = ($nameL === '' || $nameF === '') ? 0.0 : 2 * $this->trigramDice($nameL, $nameF) - 1;

        return $x;
    }

    /** All the words written about an item (name, brand, model, colour, marks, description) as stemmed tokens. */
    public function text($item): array
    {
        $parts = [];
        foreach (['item_name', 'brand', 'model', 'color', 'unique_characteristics', 'description'] as $k) {
            $parts[] = $this->val($item, $k);
        }

        return MatchVocabulary::tokens(implode(' ', $parts));
    }

    /** @param array<int,string> $a @param array<int,string> $b @param array<string,float> $idf */
    public function tfidfCosine(array $a, array $b, array $idf, float $default): float
    {
        $w = fn (string $t) => $idf[$t] ?? $default;
        $dot = 0.0;
        $na = 0.0;
        $nb = 0.0;
        $inB = array_flip($b);
        foreach ($a as $t) {
            $x = $w($t) ** 2;
            $na += $x;
            if (isset($inB[$t])) {
                $dot += $x;
            }
        }
        foreach ($b as $t) {
            $nb += $w($t) ** 2;
        }

        return ($na > 0 && $nb > 0) ? min(1.0, $dot / (sqrt($na) * sqrt($nb))) : 0.0;
    }

    public function trigramDice(string $a, string $b): float
    {
        $ga = $this->trigrams($a);
        $gb = $this->trigrams($b);
        if ($ga === [] || $gb === []) {
            return 0.0;
        }
        $inter = count(array_intersect_key($ga, $gb));

        return 2 * $inter / (count($ga) + count($gb));
    }

    /** @return array<string,true> */
    protected function trigrams(string $s): array
    {
        $s = '  ' . preg_replace('/\s+/', ' ', trim($s)) . ' ';
        $out = [];
        $n = mb_strlen($s);
        for ($i = 0; $i + 3 <= $n; $i++) {
            $out[mb_substr($s, $i, 3)] = true;
        }

        return $out;
    }

    protected function val($item, string $key): string
    {
        $v = $item?->$key ?? null;

        return is_scalar($v) ? trim((string) $v) : '';
    }

    // ------------------------------------------------------------------
    // Prediction & blending
    // ------------------------------------------------------------------

    /** Probability (0..1) that the pair is the same item. */
    public function predict(array $features, ?array $model = null): float
    {
        $model ??= self::model() ?? self::prior();

        return $this->sigmoid($this->logit($features, $model));
    }

    protected function logit(array $features, array $model): float
    {
        $z = (float) $model['bias'];
        foreach ($model['weights'] as $k => $w) {
            $z += (float) $w * ($features[$k] ?? 0.0);
        }

        return $z;
    }

    protected function sigmoid(float $z): float
    {
        return 1 / (1 + exp(-max(-30.0, min(30.0, $z))));
    }

    /** How much say the model gets, given how much real feedback it learned from. */
    public static function weightFor(array $model): float
    {
        $real = (int) ($model['samples']['real'] ?? 0);

        return round(self::BASE_WEIGHT + (self::MAX_WEIGHT - self::BASE_WEIGHT) * min(1.0, $real / self::REAL_SAMPLES_FOR_MAX), 3);
    }

    /**
     * Blend the rule score with the model's probability.
     * Returns null when there is no trained model (the caller then keeps the rule score).
     *
     * @return array{score:int, ml:array}|null
     */
    public function blend(float $ruleScore, array $features): ?array
    {
        $model = self::model();
        if ($model === null) {
            return null;
        }

        $p = $this->predict($features, $model);
        $w = self::weightFor($model);
        $mlScore = (int) round(100 * $p);

        return [
            'score' => (int) round((1 - $w) * $ruleScore + $w * $mlScore),
            'ml' => [
                'probability' => round($p, 3),
                'score' => $mlScore,
                'rule_score' => (int) round($ruleScore),
                'weight' => $w,
                'trained_at' => $model['trained_at'] ?? null,
                'samples' => $model['samples']['total'] ?? null,
                'real_samples' => (int) ($model['samples']['real'] ?? 0),
                'top_factors' => $this->explain($features, $model),
            ],
        ];
    }

    /** The few inputs that pushed this pair the most, for display ("Brand agrees +1.4"). */
    public function explain(array $features, array $model, int $top = 4): array
    {
        $rows = [];
        foreach ($model['weights'] as $k => $w) {
            $x = $features[$k] ?? 0.0;
            if ($x == 0.0) {
                continue;
            }
            $rows[] = ['key' => $k, 'label' => self::FEATURE_LABELS[$k] ?? $k, 'effect' => round((float) $w * $x, 2)];
        }
        usort($rows, fn ($a, $b) => abs($b['effect']) <=> abs($a['effect']));

        return array_slice($rows, 0, $top);
    }

    // ------------------------------------------------------------------
    // Training
    // ------------------------------------------------------------------

    /**
     * Fit the weights by batch gradient descent on weighted logistic loss,
     * with an L2 pull toward the prior.
     *
     * @param  array<int,array<string,float>>  $X  feature vectors
     * @param  array<int,int>  $y  1 = same item, 0 = different
     * @param  array<int,float>  $sampleWeight  trust per sample (real outcomes count more than synthetic)
     * @return array{bias:float, weights:array<string,float>}
     */
    public function fit(array $X, array $y, array $sampleWeight, int $epochs = 500, float $lr = 0.6): array
    {
        $prior = self::prior();
        $keys = array_keys($prior['weights']);
        $n = count($X);
        if ($n === 0) {
            return $prior;
        }

        // Balance the classes so a 70/30 sample mix can't bias the intercept.
        $posW = 0.0;
        $negW = 0.0;
        foreach ($y as $i => $label) {
            $label ? $posW += $sampleWeight[$i] : $negW += $sampleWeight[$i];
        }
        $balance = [1 => ($posW > 0 ? 0.5 / $posW : 0.0), 0 => ($negW > 0 ? 0.5 / $negW : 0.0)];

        $lambda = max(0.005, 3.0 / ($n + 30));
        $b = $prior['bias'];
        $w = $prior['weights'];

        for ($e = 0; $e < $epochs; $e++) {
            $gb = 0.0;
            $gw = array_fill_keys($keys, 0.0);
            foreach ($X as $i => $x) {
                $z = $b;
                foreach ($keys as $k) {
                    $z += $w[$k] * ($x[$k] ?? 0.0);
                }
                $err = ($this->sigmoid($z) - $y[$i]) * $sampleWeight[$i] * $balance[$y[$i]];
                $gb += $err;
                foreach ($keys as $k) {
                    $gw[$k] += $err * ($x[$k] ?? 0.0);
                }
            }
            $b -= $lr * $gb;
            foreach ($keys as $k) {
                $w[$k] -= $lr * ($gw[$k] + $lambda * ($w[$k] - $prior['weights'][$k]));
                // Monotonic by design: more agreement on any input can only raise the odds of a match.
                // (Without this, overlapping inputs such as "description" and "overall wording" can learn
                // opposite-signed weights that fit the sample but make no sense.)
                $w[$k] = max(0.0, $w[$k]);
            }
        }

        return ['bias' => round($b, 5), 'weights' => array_map(fn ($v) => round($v, 5), $w)];
    }

    /** @return array{accuracy:float, auc:float, logloss:float, n:int} */
    public function evaluate(array $model, array $X, array $y): array
    {
        $scores = [];
        foreach ($X as $i => $x) {
            $scores[$i] = $this->predict($x, $model);
        }

        return $this->metrics($scores, $y, 0.5);
    }

    /**
     * Accuracy / AUC / log-loss for any scorer that outputs 0..1 (the model, or the rule engine ÷ 100).
     * AUC = chance a random "same item" pair outranks a random "different" pair (ties count half).
     *
     * @param  array<int,float>  $scores
     * @param  array<int,int>  $y
     * @return array{accuracy:float, auc:float, logloss:float, n:int}
     */
    public function metrics(array $scores, array $y, float $threshold): array
    {
        $n = count($scores);
        if ($n === 0) {
            return ['accuracy' => 0.0, 'auc' => 0.0, 'logloss' => 0.0, 'n' => 0];
        }
        $correct = 0;
        $loss = 0.0;
        foreach ($scores as $i => $p) {
            $correct += (($p >= $threshold) === ($y[$i] === 1)) ? 1 : 0;
            $p = min(1 - 1e-6, max(1e-6, $p));
            $loss -= $y[$i] ? log($p) : log(1 - $p);
        }

        $pos = array_keys(array_filter($y, fn ($v) => $v === 1));
        $neg = array_keys(array_filter($y, fn ($v) => $v === 0));
        $auc = 0.0;
        if ($pos && $neg) {
            $wins = 0.0;
            foreach ($pos as $i) {
                foreach ($neg as $j) {
                    $wins += $scores[$i] > $scores[$j] ? 1 : ($scores[$i] == $scores[$j] ? 0.5 : 0);
                }
            }
            $auc = $wins / (count($pos) * count($neg));
        }

        return [
            'accuracy' => round($correct / $n, 4),
            'auc' => round($auc, 4),
            'logloss' => round($loss / $n, 4),
            'n' => $n,
        ];
    }

    /** Inverse-document-frequency table from a corpus of token lists. */
    public function buildIdf(array $documents, int $maxTerms = 5000): array
    {
        $df = [];
        foreach ($documents as $tokens) {
            foreach (array_unique($tokens) as $t) {
                $df[$t] = ($df[$t] ?? 0) + 1;
            }
        }
        $n = max(1, count($documents));
        arsort($df);
        $idf = [];
        foreach (array_slice($df, 0, $maxTerms, true) as $t => $c) {
            $idf[$t] = round(log(($n + 1) / ($c + 1)) + 1, 4);
        }

        return ['idf' => $idf, 'default_idf' => round(log($n + 1) + 1, 4)];
    }
}
