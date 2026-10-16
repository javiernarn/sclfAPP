<?php

namespace App\Services\Matching;

use App\Models\FoundItem;
use App\Models\ItemMatch;
use App\Models\LostItem;

/**
 * Matching engine (v2 rules + a machine-learning layer).
 *
 * The rules are deterministic: every point can be traced to a field and a rule
 * below, and `analyze()` returns that trace so a Security Officer / Admin /
 * Staff member can see exactly why two reports were paired — and what
 * disagrees. On top of that, an optional trained model (MatchLearner — logistic
 * regression + TF-IDF text similarity, learned from claim outcomes and "Not a
 * match" decisions) is blended into the score. With no model file, or ML switched
 * off, the score is exactly the rule score. It only ever surfaces "potential
 * matches"; a person always makes the final call through the claim workflow.
 *
 * How the score is built
 * ----------------------
 *  1. Each field is compared and gets a ratio 0..1, or "unknown" (null) when
 *     either side left it blank. Unknown fields are NOT counted against the
 *     pair — a report that only has a name and a colour can still match fully
 *     on those two.
 *  2. raw score   = points earned / points that could be earned on the known
 *     fields, scaled to 0..100.
 *  3. confidence  = 0.80 .. 1.00 depending on how many of the weighted fields
 *     were known on BOTH sides. A pair compared on 3 fields can't reach the same
 *     score as one compared on 9.
 *  4. hard conflicts (different kind of item, iOS vs Android, different brand,
 *     different model…) put a ceiling on the final score so a pair that agrees
 *     on colour and place but is plainly a different object can never look strong.
 */
class ItemMatchingService
{
    // Point weights. Keep them summing to 100.
    public const WEIGHTS = [
        'category' => 10,
        'item_name' => 16,
        'brand' => 13,
        'model' => 13,
        'color' => 10,
        'unique_characteristics' => 10,
        'description' => 8,
        'details' => 8,
        'location' => 6,
        'date' => 6,
    ];

    public const LABELS = [
        'category' => 'Category',
        'item_name' => 'Item name',
        'brand' => 'Brand',
        'model' => 'Model',
        'color' => 'Color',
        'unique_characteristics' => 'Unique marks',
        'description' => 'Description',
        'details' => 'Specs & extras',
        'location' => 'Place',
        'date' => 'Date',
    ];

    public const THRESHOLD_VERY_HIGH = 90;
    public const THRESHOLD_HIGH = 75;
    public const THRESHOLD_POSSIBLE = 60;

    // Below this we don't even persist a match record — too noisy to be useful.
    public const MINIMUM_SCORE_TO_RECORD = 40;

    // The live preview on the report forms shows weaker leads than we persist.
    public const MINIMUM_SCORE_FOR_PREVIEW = 35;

    // Ceilings applied when two reports disagree about something fundamental.
    public const CAP_DIFFERENT_ITEM = 50;
    public const CAP_PLATFORM = 45;
    public const CAP_DIFFERENT_CATEGORY = 55;
    public const CAP_DIFFERENT_BRAND = 74;
    public const CAP_DIFFERENT_MODEL = 74;      // e.g. Galaxy A15 vs A14: a precise identifier disagrees
    public const CAP_DIFFERENT_VARIANT = 84;    // e.g. iPhone 13 vs 13 Pro: same base model, other variant
    public const CAP_FOUND_BEFORE_LOST = 74;    // found days BEFORE the owner says it went missing
    public const CAP_DIFFERENT_COLOR = 89;

    /**
     * Score a single lost/found pair. Returns [score, breakdown] where the
     * breakdown is points per field (kept for older callers) — use analyze()
     * for the full explanation.
     */
    public function score($lost, $found): array
    {
        $a = $this->analyze($lost, $found);

        return [$a['score'], $a['breakdown']];
    }

    public function matchLevel(int $score): string
    {
        return match (true) {
            $score >= self::THRESHOLD_VERY_HIGH => 'very_high',
            $score >= self::THRESHOLD_HIGH => 'high',
            $score >= self::THRESHOLD_POSSIBLE => 'possible',
            default => 'low',
        };
    }

    // ------------------------------------------------------------------
    // The analysis
    // ------------------------------------------------------------------

    /**
     * Full, explainable comparison of one lost report against one found report.
     *
     * @param  bool  $useModel  false = rules only (the trainer must not learn from the model's own output)
     *
     * @return array{
     *   score:int, level:string, raw:float, confidence:float, cap:?int, cap_reason:?string,
     *   breakdown:array<string,int>, fields:array<string,array>, flags:array<int,array>,
     *   matched:array<int,string>, different:array<int,string>, missing:array<int,string>,
     *   summary:string, recommendation:string
     * }
     */
    public function analyze($lost, $found, bool $useModel = true): array
    {
        $fields = [];
        $flags = [];

        $catL = MatchVocabulary::category($this->v($lost, 'category'));
        $catF = MatchVocabulary::category($this->v($found, 'category'));
        $nameL = $this->v($lost, 'item_name');
        $nameF = $this->v($found, 'item_name');
        $groupL = MatchVocabulary::itemGroup($nameL);
        $groupF = MatchVocabulary::itemGroup($nameF);

        $fields['category'] = $this->cmpCategory($lost, $found, $catL, $catF, $groupL, $groupF);
        $fields['item_name'] = $this->cmpItemName($nameL, $nameF, $groupL, $groupF);
        $fields['brand'] = $this->cmpBrand($lost, $found);
        $fields['model'] = $this->cmpModel($lost, $found);
        $fields['color'] = $this->cmpColor($lost, $found);
        $fields['unique_characteristics'] = $this->cmpUnique($lost, $found);
        $fields['description'] = $this->cmpDescription($lost, $found);
        $fields['details'] = $this->cmpDetails($lost, $found);
        $fields['location'] = $this->cmpLocation($this->v($lost, 'location_lost'), $this->v($found, 'location_found'));
        $fields['date'] = $this->cmpDate($lost, $found, $flags);

        // -- weigh it -----------------------------------------------------
        $earned = 0.0;
        $known = 0.0;
        $breakdown = [];
        foreach (self::WEIGHTS as $key => $weight) {
            $f = &$fields[$key];
            $f['key'] = $key;
            $f['label'] = self::LABELS[$key];
            $f['weight'] = $weight;
            if ($f['ratio'] === null) {
                $f['status'] = 'unknown';
                $f['points'] = 0.0;
            } else {
                $f['points'] = round($weight * $f['ratio'], 1);
                $f['status'] = match (true) {
                    $f['ratio'] >= 0.9 => 'match',
                    $f['ratio'] >= 0.4 => 'similar',
                    default => 'different',
                };
                $earned += $weight * $f['ratio'];
                $known += $weight;
            }
            $breakdown[$key] = (int) round($f['points']);
            unset($f);
        }

        $raw = $known > 0 ? 100 * $earned / $known : 0.0;
        $confidence = 0.80 + 0.20 * ($known / 100);
        $score = $raw * $confidence;

        // -- hard conflicts -----------------------------------------------
        [$cap, $capReason] = $this->ceiling($lost, $found, $fields, $groupL, $groupF, $flags);
        if ($cap !== null && $score > $cap) {
            $score = $cap;
        }
        $ruleScore = (int) max(0, min(100, round($score)));

        // -- machine-learning layer ---------------------------------------
        // Blend the rule score with the trained model's probability, then apply the ceiling
        // again: the model can sharpen a score or pull it down, but it can never lift a pair
        // past a hard conflict (different brand, iOS vs Android, different kind of item…).
        $ml = null;
        if ($useModel && MatchLearner::enabled()) {
            $learner = new MatchLearner();
            $model = MatchLearner::model();
            if ($model !== null) {
                $blend = $learner->blend($score, $learner->features($fields, $lost, $found, $model));
                if ($blend !== null) {
                    $score = $blend['score'];
                    $ml = $blend['ml'];
                    if ($cap !== null && $score > $cap) {
                        $score = $cap;
                    }
                }
            }
        }

        $score = (int) max(0, min(100, round($score)));
        $level = $this->matchLevel($score);

        $matched = $different = $missing = [];
        foreach ($fields as $f) {
            match ($f['status']) {
                'match' => $matched[] = $f['label'],
                'similar' => $matched[] = $f['label'] . ' (close)',
                'different' => $different[] = $f['label'],
                default => $missing[] = $f['label'],
            };
        }

        return [
            'score' => $score,
            'level' => $level,
            'raw' => round($raw, 1),
            'confidence' => round($confidence, 3),
            'cap' => $cap,
            'cap_reason' => $capReason,
            'breakdown' => $breakdown,
            'rule_score' => $ruleScore,
            'ml' => $ml,
            'fields' => $fields,
            'flags' => $flags,
            'matched' => $matched,
            'different' => $different,
            'missing' => $missing,
            'summary' => $this->summarise($matched, $different, $missing, $capReason),
            'recommendation' => $this->recommend($level, $flags),
        ];
    }

    /**
     * Compare an unsaved report (what the person has typed so far) with every
     * candidate on the other side. Powers the live score on the report forms.
     *
     * @param  'lost'|'found'  $kind
     * @return array{best:int, level:string, count:int, candidates:array<int,array>}
     */
    public function previewForDraft(string $kind, array $attrs, int $limit = 5): array
    {
        if ($kind === 'lost') {
            $draft = new LostItem($attrs);
            $pool = FoundItem::query()
                ->whereIn('status', FoundItem::MATCHABLE_STATUSES)
                ->where(fn ($q) => $q->whereNull('intake_channel')->orWhere('intake_channel', '!=', FoundItem::CHANNEL_COUNTER_INTAKE))
                ->latest('id')->limit(300)->get();
        } else {
            $draft = new FoundItem($attrs);
            $pool = LostItem::query()
                ->whereIn('status', LostItem::MATCHABLE_STATUSES)
                ->latest('id')->limit(300)->get();
        }

        $rows = [];
        foreach ($pool as $other) {
            $a = $kind === 'lost' ? $this->analyze($draft, $other) : $this->analyze($other, $draft);
            if ($a['score'] < self::MINIMUM_SCORE_FOR_PREVIEW) {
                continue;
            }
            $rows[] = [
                'id' => $other->id,
                'item_name' => $other->item_name,
                'category' => $other->category,
                'place' => $kind === 'lost' ? $other->location_found : $other->location_lost,
                'date' => ($kind === 'lost' ? $other->date_found : $other->date_lost)?->toDateString(),
                'image_url' => $other->image_url,
                'score' => $a['score'],
                'level' => $a['level'],
                'matched' => $a['matched'],
                'different' => $a['different'],
                'fields' => array_map(fn ($f) => [
                    'key' => $f['key'], 'label' => $f['label'], 'status' => $f['status'],
                    'points' => $f['points'], 'weight' => $f['weight'],
                ], array_values($a['fields'])),
            ];
        }
        usort($rows, fn ($x, $y) => $y['score'] <=> $x['score']);
        $best = $rows[0]['score'] ?? 0;

        return [
            'best' => $best,
            'level' => $this->matchLevel($best),
            'count' => count($rows),
            'candidates' => array_slice($rows, 0, $limit),
        ];
    }

    // ------------------------------------------------------------------
    // Running the engine against stored records
    // ------------------------------------------------------------------

    /**
     * Run the engine for one newly-created lost item against all
     * candidate found items. Persists/updates ItemMatch rows and returns
     * the ones worth notifying about.
     */
    public function runForLostItem(LostItem $lost): array
    {
        $candidates = FoundItem::query()
            ->whereIn('status', FoundItem::MATCHABLE_STATUSES)
            ->get();

        return $this->persistMatches($lost, $candidates);
    }

    public function runForFoundItem(FoundItem $found): array
    {
        $candidates = LostItem::query()
            ->whereIn('status', LostItem::MATCHABLE_STATUSES)
            ->get();

        $results = [];
        foreach ($candidates as $lost) {
            $results = array_merge($results, $this->persistMatches($lost, collect([$found])));
        }

        return $results;
    }

    /**
     * Re-score one stored match against the CURRENT state of both reports and
     * save the new numbers. Never touches the match's status (a human may have
     * already notified / claimed / dismissed it).
     *
     * ALWAYS scores the complete reports, fetched fresh here. Several screens load a
     * match with only a handful of columns per report (to avoid leaking a found item's
     * private marks to the person who lost it); re-scoring those half-loaded copies used
     * to overwrite a correct 100 with a much lower number the next time that screen
     * opened — the "score blinks 100 then jumps back" bug.
     *
     * If nothing about the result changed, only `scored_at` is touched (without bumping
     * `updated_at`), so opening a comparison does not look like a change to the live
     * "pulse" every other open page is watching.
     */
    public function refresh(ItemMatch $match): array
    {
        $lost = LostItem::withTrashed()->findOrFail($match->lost_item_id);
        $found = FoundItem::withTrashed()->findOrFail($match->found_item_id);

        $analysis = $this->analyze($lost, $found);
        $this->store($match, $analysis);

        if ($match->isDirty(['score', 'match_level', 'score_breakdown', 'score_details'])) {
            $match->save();
        } else {
            $match->timestamps = false;
            $match->save();
            $match->timestamps = true;
        }

        return $analysis;
    }

    /**
     * Cheap "real-time" guard for list screens: if either report was edited
     * after this match was last scored, re-score it now. Rows scored before
     * v2 (no scored_at) are left alone until opened or `matches:rescore` runs.
     */
    public function refreshIfStale(ItemMatch $match): bool
    {
        if (!$match->scored_at) {
            return false;
        }
        $match->loadMissing('lostItem', 'foundItem');
        if (!$match->lostItem || !$match->foundItem) {
            return false;
        }
        $latest = max(
            $match->lostItem->updated_at?->getTimestamp() ?? 0,
            $match->foundItem->updated_at?->getTimestamp() ?? 0,
        );
        if ($latest <= $match->scored_at->getTimestamp()) {
            return false;
        }
        $this->refresh($match);

        return true;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, FoundItem>  $candidates
     */
    protected function persistMatches(LostItem $lost, $candidates): array
    {
        $created = [];

        foreach ($candidates as $found) {
            $analysis = $this->analyze($lost, $found);

            if ($analysis['score'] < self::MINIMUM_SCORE_TO_RECORD) {
                continue;
            }

            $match = ItemMatch::firstOrNew(
                ['lost_item_id' => $lost->id, 'found_item_id' => $found->id]
            );

            $this->store($match, $analysis);
            // Only a brand-new record gets the default status. Re-scoring an
            // existing match must never clobber a status a human already set
            // (notified/claimed/dismissed).
            if (!$match->exists) {
                $match->status = ItemMatch::STATUS_PENDING;
            }

            $match->save();

            $created[] = $match;
        }

        return $created;
    }

    /** Keep markers other code left in score_details (e.g. `retired`) when a match is re-scored. */
    protected function carriedDetails(ItemMatch $match): array
    {
        $old = $match->score_details;

        return is_array($old) ? array_intersect_key($old, array_flip(['retired', 'retired_at'])) : [];
    }

    protected function store(ItemMatch $match, array $analysis): void
    {
        $match->fill([
            'score' => $analysis['score'],
            'match_level' => $analysis['level'],
            'score_breakdown' => $analysis['breakdown'],
            'score_details' => [
                'version' => 2,
                'raw' => $analysis['raw'],
                'confidence' => $analysis['confidence'],
                'cap' => $analysis['cap'],
                'cap_reason' => $analysis['cap_reason'],
                'fields' => array_values($analysis['fields']),
                'flags' => $analysis['flags'],
                'summary' => $analysis['summary'],
                'recommendation' => $analysis['recommendation'],
                'rule_score' => $analysis['rule_score'],
                'ml' => $analysis['ml'],
            ] + $this->carriedDetails($match),
            'scored_at' => now(),
        ]);
    }

    // ------------------------------------------------------------------
    // Field comparators — each returns ['ratio'=>?float, 'lost'=>?string, 'found'=>?string, 'note'=>string]
    // ------------------------------------------------------------------

    protected function row(?float $ratio, ?string $lost, ?string $found, string $note = ''): array
    {
        return [
            'ratio' => $ratio === null ? null : max(0.0, min(1.0, $ratio)),
            'lost' => $lost !== null && trim($lost) !== '' ? trim($lost) : null,
            'found' => $found !== null && trim($found) !== '' ? trim($found) : null,
            'note' => $note,
        ];
    }

    protected function cmpCategory($lost, $found, string $catL, string $catF, ?string $gL, ?string $gF): array
    {
        $rawL = $this->v($lost, 'category');
        $rawF = $this->v($found, 'category');
        if ($catL === '' || $catF === '') {
            return $this->row(null, $rawL, $rawF, 'One report has no category.');
        }
        if ($catL === $catF) {
            return $this->row(1.0, $rawL, $rawF, 'Same category.');
        }
        if (MatchVocabulary::categoriesRelated($catL, $catF)) {
            return $this->row(0.4, $rawL, $rawF, 'Different but related categories.');
        }
        if ($gL !== null && $gL === $gF) {
            return $this->row(0.6, $rawL, $rawF, 'Categories differ, but the item names describe the same kind of thing.');
        }

        return $this->row(0.0, $rawL, $rawF, 'Different categories.');
    }

    protected function cmpItemName(string $nameL, string $nameF, ?string $gL, ?string $gF): array
    {
        if ($nameL === '' || $nameF === '') {
            return $this->row(null, $nameL, $nameF, 'One report has no item name.');
        }
        $cl = MatchVocabulary::clean($nameL);
        $cf = MatchVocabulary::clean($nameF);
        if ($cl === $cf) {
            return $this->row(1.0, $nameL, $nameF, 'Identical names.');
        }

        $tokenSim = $this->tokenSimilarity(MatchVocabulary::tokens($nameL), MatchVocabulary::tokens($nameF));
        $fuzzy = $this->fuzzy($cl, $cf);

        if ($gL !== null && $gF !== null) {
            if ($gL === $gF) {
                return $this->row(max(0.92, $tokenSim, $fuzzy), $nameL, $nameF, 'Same kind of item (“' . $gL . '”).');
            }
            if (MatchVocabulary::groupsCousins($gL, $gF)) {
                return $this->row(0.5, $nameL, $nameF, 'Similar kinds of item (“' . $gL . '” vs “' . $gF . '”).');
            }

            return $this->row(min(0.2, $tokenSim), $nameL, $nameF, 'Different kinds of item (“' . $gL . '” vs “' . $gF . '”).');
        }

        $ratio = max($tokenSim, $fuzzy);

        return $this->row($ratio, $nameL, $nameF, $ratio >= 0.9 ? 'Names are nearly the same.' : ($ratio >= 0.4 ? 'Names share key words.' : 'Names look different.'));
    }

    protected function cmpBrand($lost, $found): array
    {
        $rawL = $this->v($lost, 'brand');
        $rawF = $this->v($found, 'brand');
        $bL = MatchVocabulary::brand($rawL);
        $bF = MatchVocabulary::brand($rawF);

        if ($bL === '' && $bF === '') {
            return $this->row(null, $rawL, $rawF, 'Neither report gives a brand.');
        }
        if ($bL === '' || $bF === '') {
            // One side left it blank: is the known brand mentioned in the other side's free text?
            $known = $bL !== '' ? $bL : $bF;
            if (!MatchVocabulary::isNoBrand($known)) {
                $other = $bL !== '' ? $found : $lost;
                $text = MatchVocabulary::clean($this->v($other, 'item_name') . ' ' . $this->v($other, 'description') . ' ' . $this->v($other, 'model') . ' ' . $this->v($other, 'unique_characteristics'));
                if (str_contains(' ' . $text . ' ', ' ' . $known . ' ')) {
                    return $this->row(0.85, $rawL, $rawF, 'Brand left blank on one report but it is mentioned in the other’s text.');
                }
            }

            return $this->row(null, $rawL, $rawF, 'One report has no brand.');
        }
        if ($bL === $bF) {
            return MatchVocabulary::isNoBrand($bL)
                ? $this->row(0.6, $rawL, $rawF, 'Both unbranded.')
                : $this->row(1.0, $rawL, $rawF, 'Same brand.');
        }
        if (MatchVocabulary::isNoBrand($bL) || MatchVocabulary::isNoBrand($bF)) {
            return $this->row(0.15, $rawL, $rawF, 'One says unbranded, the other names a brand (a finder may miss a small logo).');
        }
        if (MatchVocabulary::brandsSameFamily($bL, $bF)) {
            return $this->row(0.6, $rawL, $rawF, 'Related brands (same maker / sub-brand).');
        }

        return $this->row(0.0, $rawL, $rawF, 'Different brands.');
    }

    protected function cmpModel($lost, $found): array
    {
        $rawL = $this->v($lost, 'model');
        $rawF = $this->v($found, 'model');
        if ($rawL === '' && $rawF === '') {
            return $this->row(null, $rawL, $rawF, 'Neither report gives a model.');
        }
        if ($rawL === '' || $rawF === '') {
            $known = $rawL !== '' ? $rawL : $rawF;
            $other = $rawL !== '' ? $found : $lost;
            $text = MatchVocabulary::clean($this->v($other, 'item_name') . ' ' . $this->v($other, 'description') . ' ' . $this->v($other, 'unique_characteristics'));
            $text = trim(preg_replace('/(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/', ' ', $text));
            [$base, $variant] = MatchVocabulary::modelParts($known);
            $needle = trim(implode(' ', array_merge($base, $variant)));
            if ($needle !== '' && str_contains(' ' . $text . ' ', ' ' . $needle . ' ')) {
                return $this->row(0.8, $rawL, $rawF, 'Model left blank on one report but it is mentioned in the other’s text.');
            }

            return $this->row(null, $rawL, $rawF, 'One report has no model.');
        }

        [$bl, $vl] = MatchVocabulary::modelParts($rawL);
        [$bf, $vf] = MatchVocabulary::modelParts($rawF);

        if ($bl === [] || $bf === []) {
            return $this->row($this->fuzzy(MatchVocabulary::clean($rawL), MatchVocabulary::clean($rawF)), $rawL, $rawF, 'Compared as text.');
        }
        if ($bl === $bf) {
            return $vl === $vf
                ? $this->row(1.0, $rawL, $rawF, 'Same model.')
                : $this->row(0.4, $rawL, $rawF, 'Same base model, different variant (' . (implode(' ', $vl) ?: 'standard') . ' vs ' . (implode(' ', $vf) ?: 'standard') . ').');
        }
        $overlap = $this->tokenSimilarity($bl, $bf);
        if ($overlap >= 0.5) {
            return $this->row(0.3, $rawL, $rawF, 'Model names partly overlap.');
        }

        return $this->row(0.0, $rawL, $rawF, 'Different models.');
    }

    protected function cmpColor($lost, $found): array
    {
        $rawL = $this->v($lost, 'color');
        $rawF = $this->v($found, 'color');
        if ($rawL === '' || $rawF === '') {
            return $this->row(null, $rawL, $rawF, 'One report has no color.');
        }
        $cl = MatchVocabulary::colors($rawL);
        $cf = MatchVocabulary::colors($rawF);
        if ($cl === [] || $cf === []) {
            return MatchVocabulary::clean($rawL) === MatchVocabulary::clean($rawF)
                ? $this->row(1.0, $rawL, $rawF, 'Same color.')
                : $this->row(null, $rawL, $rawF, 'Color wording not recognised — compare by eye.');
        }

        $dir = fn (array $from, array $to) => array_sum(array_map(function ($c) use ($to) {
            $best = 0.0;
            foreach ($to as $d) {
                $best = max($best, $this->colorPair($c, $d));
            }

            return $best;
        }, $from)) / count($from);

        $ratio = ($dir($cl, $cf) + $dir($cf, $cl)) / 2;
        $note = $ratio >= 0.95 ? 'Same color.' : ($ratio >= 0.6 ? 'Same color family.' : ($ratio >= 0.3 ? 'Neighbouring colors.' : 'Different colors.'));

        return $this->row($ratio, $rawL, $rawF, $note);
    }

    /** @param array{0:string,1:string} $a @param array{0:string,1:string} $b */
    protected function colorPair(array $a, array $b): float
    {
        if ($a[0] === $b[0]) {
            return 1.0;
        }
        if ($a[1] === 'multi' || $b[1] === 'multi') {
            return 0.5;
        }
        if ($a[1] === $b[1]) {
            return 0.7;
        }
        if (MatchVocabulary::familiesNear($a[1], $b[1])) {
            return 0.35;
        }

        return 0.0;
    }

    protected function cmpUnique($lost, $found): array
    {
        $rawL = $this->v($lost, 'unique_characteristics');
        $rawF = $this->v($found, 'unique_characteristics');
        if ($rawL === '' || $rawF === '') {
            return $this->row(null, $rawL, $rawF, 'One report lists no unique marks.');
        }
        $tl = $this->traits($rawL);
        $tf = $this->traits($rawF);
        if ($tl === [] || $tf === []) {
            return $this->row(null, $rawL, $rawF, 'No comparable marks.');
        }

        // Match the shorter list against the longer list + the other report's description.
        [$small, $bigText] = count($tl) <= count($tf)
            ? [$tl, $rawF . ' ' . $this->v($found, 'description')]
            : [$tf, $rawL . ' ' . $this->v($lost, 'description')];
        $pool = MatchVocabulary::tokens($bigText);

        $hits = 0;
        $hitNames = [];
        foreach ($small as $trait) {
            $tt = MatchVocabulary::tokens($trait);
            if ($tt === []) {
                continue;
            }
            $inter = count(array_intersect($tt, $pool));
            if ($inter / count($tt) >= 0.6) {
                $hits++;
                $hitNames[] = $trait;
            }
        }
        $ratio = $hits / max(1, count($small));
        $note = $hits === 0 ? 'None of the listed marks line up.' : "{$hits} of " . count($small) . ' marks line up' . ($hitNames ? ': ' . implode(', ', array_slice($hitNames, 0, 3)) : '') . '.';

        return $this->row($ratio, $rawL, $rawF, $note);
    }

    /** @return array<int,string> */
    protected function traits(string $text): array
    {
        $parts = preg_split('/[,;\n\/]+|\band\b/iu', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_values(array_filter(array_map('trim', $parts), fn ($p) => MatchVocabulary::tokens($p) !== []));
    }

    protected function cmpDescription($lost, $found): array
    {
        $rawL = $this->v($lost, 'description');
        $rawF = $this->v($found, 'description');
        $tl = MatchVocabulary::tokens($rawL);
        $tf = MatchVocabulary::tokens($rawF);
        if ($tl === [] || $tf === []) {
            return $this->row(null, $rawL, $rawF, 'One report has no description.');
        }
        $inter = count(array_intersect($tl, $tf));
        $union = count(array_unique(array_merge($tl, $tf)));
        $overlap = $inter / min(count($tl), count($tf));
        $jaccard = $union > 0 ? $inter / $union : 0;
        $ratio = 0.5 * $overlap + 0.5 * $jaccard;
        $note = $inter === 0 ? 'No shared words.' : "{$inter} shared word" . ($inter === 1 ? '' : 's') . '.';

        return $this->row($ratio, $this->clip($rawL), $this->clip($rawF), $note);
    }

    protected function cmpDetails($lost, $found): array
    {
        $dl = $this->detailsOf($lost);
        $df = $this->detailsOf($found);
        $common = array_intersect_key($dl, $df);
        if ($common === []) {
            return $this->row(null, $this->detailsText($dl), $this->detailsText($df), 'No shared spec fields filled in.');
        }
        $sum = 0.0;
        $same = [];
        $diff = [];
        foreach ($common as $k => $_) {
            if ($this->sameDetail($dl[$k], $df[$k])) {
                $sum += 1;
                $same[] = $k;
            } else {
                $diff[] = $k;
            }
        }
        $ratio = $sum / count($common);
        $note = ($same ? 'Agree on ' . implode(', ', array_map([$this, 'pretty'], $same)) . '. ' : '') . ($diff ? 'Differ on ' . implode(', ', array_map([$this, 'pretty'], $diff)) . '.' : '');

        return $this->row($ratio, $this->detailsText($dl), $this->detailsText($df), trim($note));
    }

    protected function sameDetail(string $a, string $b): bool
    {
        $na = preg_replace('/[^a-z0-9]+/', '', MatchVocabulary::lower($a));
        $nb = preg_replace('/[^a-z0-9]+/', '', MatchVocabulary::lower($b));

        return $na !== '' && $na === $nb;
    }

    /** @return array<string,string> */
    protected function detailsOf($item): array
    {
        $d = $this->raw($item, 'details');
        if (is_string($d)) {
            $d = json_decode($d, true);
        }
        if (!is_array($d)) {
            return [];
        }
        $out = [];
        foreach ($d as $k => $val) {
            if (is_scalar($val) && trim((string) $val) !== '') {
                $out[(string) $k] = trim((string) $val);
            }
        }

        return $out;
    }

    protected function detailsText(array $d): ?string
    {
        if ($d === []) {
            return null;
        }

        return implode(' · ', array_map(fn ($k, $v) => $this->pretty($k) . ': ' . $v, array_keys($d), $d));
    }

    protected function pretty(string $key): string
    {
        return ucfirst(str_replace('_', ' ', $key));
    }

    protected function cmpLocation(string $a, string $b): array
    {
        if ($a === '' || $b === '') {
            return $this->row(null, $a, $b, 'One report has no place.');
        }
        if (MatchVocabulary::clean($a) === MatchVocabulary::clean($b)) {
            return $this->row(1.0, $a, $b, 'Same place.');
        }
        $pa = MatchVocabulary::places($a);
        $pb = MatchVocabulary::places($b);
        if ($pa !== [] && $pb !== []) {
            if (array_intersect_key($pa, $pb) !== []) {
                return $this->row(1.0, $a, $b, 'Same place.');
            }
            if (array_intersect(array_values($pa), array_values($pb)) !== []) {
                return $this->row(0.55, $a, $b, 'Nearby / same area of campus.');
            }

            return $this->row(0.0, $a, $b, 'Different parts of campus.');
        }
        $sim = $this->tokenSimilarity(MatchVocabulary::tokens($a), MatchVocabulary::tokens($b));

        return $this->row($sim, $a, $b, $sim >= 0.5 ? 'Place descriptions overlap.' : 'Places look different.');
    }

    protected function cmpDate($lost, $found, array &$flags): array
    {
        $dl = $this->raw($lost, 'date_lost');
        $df = $this->raw($found, 'date_found');
        if (!($dl instanceof \DateTimeInterface) || !($df instanceof \DateTimeInterface)) {
            return $this->row(null, null, null, 'One report has no date.');
        }
        $a = new \DateTimeImmutable($dl->format('Y-m-d'));
        $b = new \DateTimeImmutable($df->format('Y-m-d'));
        $days = (int) $a->diff($b)->format('%r%a'); // found - lost (negative = found BEFORE lost)
        $lostTxt = $a->format('M j, Y');
        $foundTxt = $b->format('M j, Y');

        if ($days >= 0) {
            $ratio = match (true) {
                $days <= 1 => 1.0,
                $days <= 3 => 0.85,
                $days <= 7 => 0.65,
                $days <= 14 => 0.45,
                $days <= 30 => 0.25,
                $days <= 60 => 0.1,
                default => 0.0,
            };
            $note = $days === 0 ? 'Found the same day it was lost.' : "Found {$days} day" . ($days === 1 ? '' : 's') . ' after it was lost.';

            return $this->row($ratio, $lostTxt, $foundTxt, $note) + ['days' => $days];
        }

        $before = abs($days);
        if ($before <= 1) {
            return $this->row(0.9, $lostTxt, $foundTxt, 'Dates are one day apart (allowing for an approximate lost date).') + ['days' => $days];
        }
        $flags[] = ['type' => 'warning', 'field' => 'date', 'message' => "This item was found {$before} days BEFORE the owner says they lost it."];

        return $this->row($before <= 3 ? 0.35 : 0.0, $lostTxt, $foundTxt, "Found {$before} days before it was reported lost.") + ['days' => $days];
    }

    // ------------------------------------------------------------------
    // Ceilings (hard conflicts)
    // ------------------------------------------------------------------

    /** @return array{0:?int,1:?string} */
    protected function ceiling($lost, $found, array $fields, ?string $gL, ?string $gF, array &$flags): array
    {
        $caps = [];

        // Different kind of thing altogether.
        if ($gL !== null && $gF !== null && $gL !== $gF && !MatchVocabulary::groupsCousins($gL, $gF)) {
            $caps[] = [self::CAP_DIFFERENT_ITEM, 'The item names describe different kinds of things (' . $gL . ' vs ' . $gF . ').'];
            $flags[] = ['type' => 'conflict', 'field' => 'item_name', 'message' => "Lost “{$gL}” vs found “{$gF}” — different kinds of item."];
        } elseif (($fields['category']['ratio'] ?? null) === 0.0) {
            $caps[] = [self::CAP_DIFFERENT_CATEGORY, 'The two reports are in different categories.'];
            $flags[] = ['type' => 'conflict', 'field' => 'category', 'message' => 'Different categories (' . ($this->v($lost, 'category') ?: '—') . ' vs ' . ($this->v($found, 'category') ?: '—') . ').'];
        }

        // iOS vs Android.
        $pl = MatchVocabulary::platform($this->v($lost, 'brand'), $this->v($lost, 'item_name'), $this->v($lost, 'model'));
        $pf = MatchVocabulary::platform($this->v($found, 'brand'), $this->v($found, 'item_name'), $this->v($found, 'model'));
        if ($pl !== null && $pf !== null && $pl !== $pf) {
            $caps[] = [self::CAP_PLATFORM, 'One is an Apple (iOS) device and the other an Android device.'];
            $flags[] = ['type' => 'conflict', 'field' => 'brand', 'message' => 'Platform mismatch: ' . strtoupper($pl) . ' vs ' . strtoupper($pf) . '.'];
        }

        if (($fields['brand']['ratio'] ?? null) !== null && $fields['brand']['ratio'] <= 0.15) {
            $caps[] = [self::CAP_DIFFERENT_BRAND, 'The brands are different.'];
            $flags[] = ['type' => 'conflict', 'field' => 'brand', 'message' => 'Brands differ (' . $fields['brand']['lost'] . ' vs ' . $fields['brand']['found'] . ').'];
        }
        $modelRatio = $fields['model']['ratio'] ?? null;
        if ($modelRatio !== null && $modelRatio <= 0.3) {
            $caps[] = [self::CAP_DIFFERENT_MODEL, 'The models are different.'];
            $flags[] = ['type' => 'conflict', 'field' => 'model', 'message' => 'Models differ (' . $fields['model']['lost'] . ' vs ' . $fields['model']['found'] . ').'];
        } elseif ($modelRatio !== null && $modelRatio < 0.9) {
            $caps[] = [self::CAP_DIFFERENT_VARIANT, 'Same base model but a different variant.'];
            $flags[] = ['type' => 'warning', 'field' => 'model', 'message' => 'Different variants of the model (' . $fields['model']['lost'] . ' vs ' . $fields['model']['found'] . ').'];
        }
        if (($fields['date']['days'] ?? 0) < -3) {
            $caps[] = [self::CAP_FOUND_BEFORE_LOST, 'It was found days before the owner says it was lost.'];
        }
        if (($fields['color']['ratio'] ?? null) !== null && $fields['color']['ratio'] < 0.3) {
            $caps[] = [self::CAP_DIFFERENT_COLOR, 'The colors are different.'];
            $flags[] = ['type' => 'conflict', 'field' => 'color', 'message' => 'Colors differ (' . $fields['color']['lost'] . ' vs ' . $fields['color']['found'] . ').'];
        }

        if ($caps === []) {
            return [null, null];
        }
        usort($caps, fn ($a, $b) => $a[0] <=> $b[0]);

        return [$caps[0][0], $caps[0][1]];
    }

    // ------------------------------------------------------------------
    // Wording
    // ------------------------------------------------------------------

    protected function summarise(array $matched, array $different, array $missing, ?string $capReason): string
    {
        $parts = [];
        if ($matched) {
            $parts[] = 'Agrees on ' . $this->listWords($matched) . '.';
        }
        if ($different) {
            $parts[] = 'Disagrees on ' . $this->listWords($different) . '.';
        }
        if ($missing) {
            $parts[] = 'Not enough information to compare ' . $this->listWords($missing) . '.';
        }
        if ($capReason) {
            $parts[] = 'Score capped: ' . $capReason;
        }

        return implode(' ', $parts) ?: 'Nothing to compare yet.';
    }

    protected function listWords(array $words): string
    {
        $words = array_values(array_map('mb_strtolower', $words));
        $n = count($words);
        if ($n <= 2) {
            return implode(' and ', $words);
        }

        return implode(', ', array_slice($words, 0, $n - 1)) . ' and ' . $words[$n - 1];
    }

    protected function recommend(string $level, array $flags): string
    {
        $hasConflict = (bool) array_filter($flags, fn ($f) => $f['type'] === 'conflict');

        return match (true) {
            $level === 'very_high' => 'Strong match. Notify the owner, then confirm with private details only the real owner would know before releasing anything.',
            $level === 'high' => 'Likely match. Check the highlighted differences, then notify the owner and verify through the claim.',
            $level === 'possible' && $hasConflict => 'Possible, but the reports disagree on key details. Compare photos and ask the owner to describe the item before notifying.',
            $level === 'possible' => 'Possible match. Review the fields below and look at the item itself before notifying the owner.',
            default => 'Unlikely match. Dismiss it unless a photo or the item itself says otherwise.',
        };
    }

    // ------------------------------------------------------------------
    // Small utilities
    // ------------------------------------------------------------------

    /** String attribute, trimmed ('' when absent). Works for Eloquent models and plain objects. */
    protected function v($item, string $key): string
    {
        $val = $this->raw($item, $key);

        return is_scalar($val) ? trim((string) $val) : '';
    }

    protected function raw($item, string $key)
    {
        if ($item === null) {
            return null;
        }

        return $item->$key ?? null;
    }

    protected function clip(string $s, int $n = 160): string
    {
        return mb_strlen($s) > $n ? mb_substr($s, 0, $n - 1) . '…' : $s;
    }

    /** Jaccard blended with containment (so "Black Wallet" inside "Black leather wallet" scores high). */
    protected function tokenSimilarity(array $a, array $b): float
    {
        if ($a === [] || $b === []) {
            return 0.0;
        }
        $inter = count(array_intersect($a, $b));
        $union = count(array_unique(array_merge($a, $b)));
        $jaccard = $union > 0 ? $inter / $union : 0.0;
        $contain = $inter / min(count($a), count($b));

        return 0.5 * $jaccard + 0.5 * $contain;
    }

    /** Typo-tolerant similarity of two short cleaned strings, 0..1. */
    protected function fuzzy(string $a, string $b): float
    {
        if ($a === '' || $b === '') {
            return 0.0;
        }
        $a = substr($a, 0, 60);
        $b = substr($b, 0, 60);
        $max = max(strlen($a), strlen($b));

        return $max === 0 ? 0.0 : max(0.0, 1 - levenshtein($a, $b) / $max);
    }
}
