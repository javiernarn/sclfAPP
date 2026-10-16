# Matching v2 — what changed

1. Run `php artisan migrate` (adds `details` to lost/found items, `score_details` + `scored_at` to item_matches).
2. Run `php artisan matches:rescore --all` once so existing matches get the full comparison.
3. `npm run build` to rebuild the front end.

* Engine: `app/Services/Matching/ItemMatchingService.php` + `MatchVocabulary.php` (brand aliases, item synonyms, colour families, campus zones, model parsing).
* New endpoints: `POST /api/matches/preview` (live score for an unsaved report), `GET /api/matches/{id}` (handlers: live side-by-side comparison).
* Catalog: `resources/js/config/deviceModels.js` (~3,700 models / 117 brands) + `lostFoundCatalog.js` (Android vs iPhone split, spec fields, 2 new categories).
* Tests: `tests/Unit/MatchingEngineV2Test.php`, `tests/Feature/MatchLiveScoringTest.php`.

## Fix: leftover matches + the score that "blinks 100 then goes back" + machine learning

**Leftover matches.** The Needs-review / Owner-notified tabs now list only leads that can still go somewhere
(`ItemMatch::scopeLive`): found item on hand, lost report still open. Leads whose found item was claimed,
waiting for release, released, disposed, rejected or deleted — or whose lost report already has an approved
claim / was closed — disappear. When an item is released / disposed / rejected or a report is closed / deleted,
the other leads are *retired* (`MatchReconciler`); the hourly `matches:rescore` also sweeps old data.
Owner / found-item candidate lists hide them too, and "Notify owner" is refused for them.

**Score blink.** Some screens loaded a match with only a few columns per report and re-scored *that*, saving a
lower number over the correct 100. `ItemMatchingService::refresh()` now always scores the full reports, only
bumps `updated_at` when the result really changed, and the Matches page ignores out-of-order responses and
updates the card with the comparison's number.

**Machine learning** (`MatchLearner` / `MatchTrainer`): logistic regression + TF-IDF + typo-tolerant name
similarity, blended into the rule score (25% → 60% as real outcomes accumulate), never above the hard-conflict
ceilings. Learns from approved/released claims (matches) and people's "Not a match" (non-matches).

    php artisan matches:train --rescore      # train on your real data + synthetic pairs, then re-score open leads
    php artisan matches:train --dry-run      # just show accuracy
    SCLF_MATCH_ML=false                      # in .env: back to rules only

Scheduled weekly (Mon 03:00). `GET /api/matches/model` reports status; the Matches page shows an "AI" badge.
