# Violations (sensitive uploads)

**Manual flow (always on).** Admin, staff and security see each report photo/video with buttons:
- *Mark as violation* — confirmed at once, recorded against the uploader.
- *Confirm violation* / *Not a violation* — for files the scanner flagged (blood/accident photos → "Not a violation").
- Flagged and confirmed files are blurred for reviewers (tap to reveal) and replaced by "File removed" for everyone else, including the uploader.
- Only the Administrator can undo a confirmed violation.
- Confirmed violations print on the student/instructor dashboard; a clean record prints "No violations".

**Scanner (optional, off by default).** Set `SCLF_MODERATION_ENABLED=true` and `SCLF_MODERATION_API_KEY` (Google Vision).
New photos are queued (`ScanAttachmentJob`); nudity (`adult`/`racy`) opens a *pending* violation. Blood/violence never flags on its own.
Videos and HEIC/large photos are skipped (manual review only). Optional OCR word list: `SCLF_MODERATION_BLOCKED_WORDS=word1,word2`.

**Hostinger.** Run migrations (`php artisan migrate`), then add a cron job every minute:
`php /path/to/artisan queue:work --stop-when-empty` (queue is `database`).
