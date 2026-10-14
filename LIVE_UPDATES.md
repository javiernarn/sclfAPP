# Live updates (no websockets needed)

Works locally and on Hostinger shared hosting — no extra processes, no ports, nothing to keep running.

* **Security / Admin / Staff — Matches page:** every 8 seconds the page calls `GET /api/matches/pulse`.
  That request runs three aggregate queries and returns one short stamp. Only when the stamp changes
  (a match was created, re-scored or actioned, or either report was edited) does the page re-fetch the list
  and the open "Compare details" panel. The tab pauses polling while hidden and checks again the moment you return to it.
* **Owner — "Potential matches" page for one report:** re-fetches every 20 seconds while visible.
* **Report forms:** the live score runs ~0.7 s after you stop typing (`POST /api/matches/preview`, throttled to 90/min).
* **Scores stay right:** when a report is edited, the next list load re-scores the affected matches, and
  `matches:rescore` runs hourly if the scheduler is on.

## Hostinger notes
* Shared hosting runs PHP with a limited number of workers. The pulse is deliberately tiny; if you ever see
  slowness with many people on the Matches page at once, raise `PULSE_MS` in `SecurityMatches.jsx` (8000 → 15000).
* Cron: add `* * * * * php /home/USER/domains/YOURSITE/public_html/artisan schedule:run` in hPanel → Cron Jobs
  to enable the hourly re-score (and your existing disposition sweep).
* After uploading: `php artisan migrate`, `php artisan matches:rescore --all`, `npm run build` (build locally, upload `public/build`).
