<?php

namespace App\Console\Commands;

use App\Services\Matching\MatchLearner;
use App\Services\Matching\MatchTrainer;
use Illuminate\Console\Command;

/**
 * Trains the machine-learning layer of the matching engine.
 *
 * Learns from (a) matches whose claim was approved / released and matches people
 * dismissed, and (b) synthetic pairs generated from the stored reports. Safe to run
 * any time and as often as you like — it only ever replaces the model file, and does
 * nothing when there isn't enough data. See App\Services\Matching\MatchLearner.
 */
class TrainMatchModel extends Command
{
    protected $signature = 'matches:train
        {--synthetic=1200 : How many synthetic training pairs to generate (0 = real outcomes only)}
        {--min=40 : Minimum labelled pairs required before a model is saved}
        {--seed=42 : Random seed, so a run can be reproduced}
        {--dry-run : Train and report, but do not save the model}
        {--rescore : After saving, re-score every open match with the new model}';

    protected $description = 'Train the machine-learning model that sharpens lost/found match scores';

    public function handle(MatchTrainer $trainer): int
    {
        $result = $trainer->train(
            synthetic: max(0, (int) $this->option('synthetic')),
            dryRun: (bool) $this->option('dry-run'),
            minSamples: max(2, (int) $this->option('min')),
            seed: (int) $this->option('seed'),
        );

        if (!$result['trained']) {
            $this->warn($result['reason']);

            return self::SUCCESS; // not an error: the rules keep working
        }

        $m = $result['model'];
        $s = $m['samples'];
        $this->info(sprintf(
            'Trained on %d pairs — %d real outcomes (%d confirmed, %d rejected) + %d synthetic.',
            $s['total'], $s['real'], $s['real_positive'], $s['real_negative'], $s['synthetic']
        ));
        $this->line(sprintf(
            'Held-out check: accuracy %.1f%% · AUC %.3f · log-loss %.3f   (rules alone: accuracy %.1f%% · AUC %.3f)',
            $m['metrics']['accuracy'] * 100, $m['metrics']['auc'], $m['metrics']['logloss'],
            $m['metrics']['rules_accuracy'] * 100, $m['metrics']['rules_auc']
        ));
        $this->line(sprintf('Model weight in the final score: %d%% (grows with real feedback).', round(MatchLearner::weightFor($m) * 100)));

        $weights = $m['weights'];
        arsort($weights);
        $this->table(['What it looks at', 'Learned weight'], array_map(
            fn ($k, $w) => [MatchLearner::FEATURE_LABELS[$k] ?? $k, number_format($w, 2)],
            array_keys($weights), $weights
        ));

        if ($result['saved']) {
            $this->info('Saved to ' . MatchLearner::path());
            if ($this->option('rescore')) {
                $this->call('matches:rescore');
            } else {
                $this->line('Run `php artisan matches:rescore --all` to apply it to the matches already stored.');
            }
        } else {
            $this->line('(dry run — nothing saved)');
        }

        return self::SUCCESS;
    }
}
