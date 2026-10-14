# Matching v2 — what changed

1. Run `php artisan migrate` (adds `details` to lost/found items, `score_details` + `scored_at` to item_matches).
2. Run `php artisan matches:rescore --all` once so existing matches get the full comparison.
3. `npm run build` to rebuild the front end.

* Engine: `app/Services/Matching/ItemMatchingService.php` + `MatchVocabulary.php` (brand aliases, item synonyms, colour families, campus zones, model parsing).
* New endpoints: `POST /api/matches/preview` (live score for an unsaved report), `GET /api/matches/{id}` (handlers: live side-by-side comparison).
* Catalog: `resources/js/config/deviceModels.js` (~3,700 models / 117 brands) + `lostFoundCatalog.js` (Android vs iPhone split, spec fields, 2 new categories).
* Tests: `tests/Unit/MatchingEngineV2Test.php`, `tests/Feature/MatchLiveScoringTest.php`.
