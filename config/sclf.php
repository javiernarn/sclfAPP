<?php

return [

    // Refresh token in an HttpOnly cookie (see App\Support\RefreshCookie and
    // SECURITY_PHASES/PHASE_6.md). Turn off with SCLF_REFRESH_COOKIE=false to
    // return to the old mode without rebuilding the frontend.
    'refresh_cookie' => [
        'enabled' => env('SCLF_REFRESH_COOKIE', true),
        // Also accept a refresh token sent in the request body while cookie
        // mode is on (only for clients that cannot use cookies). Keep false.
        'allow_body' => env('SCLF_REFRESH_ALLOW_BODY', false),
    ],


    /*
    |--------------------------------------------------------------------------
    | One report per day (per account, per report type)
    |--------------------------------------------------------------------------
    |
    | SCLF_ONE_REPORT_PER_DAY=true  -> each student account may submit `limit`
    |                                  lost report, found report, incident
    |                                  report and service request per day
    |                                  (each type counted separately).
    | SCLF_ONE_REPORT_PER_DAY=false -> no limit.
    | Only the listed roles are limited; staff/security/admin are not.
    | See App\Http\Middleware\OneReportPerDay.
    |
    */
    'daily_report_limit' => [
        'enabled' => env('SCLF_ONE_REPORT_PER_DAY', true),
        'limit' => env('SCLF_REPORTS_PER_DAY', 1),
        'roles' => array_filter(array_map('trim', explode(',', env('SCLF_REPORT_LIMIT_ROLES', 'student')))),
    ],

    /*
    |--------------------------------------------------------------------------
    | Unclaimed item retention period
    |--------------------------------------------------------------------------
    |
    | Days a found item is held in storage before it becomes eligible to be
    | flagged unclaimed (see DispositionService). Set on the item at the
    | moment it's assigned storage — InventoryService::assignStorage() only
    | fills it in when the item doesn't already have one, so an officer can
    | still override it per item (e.g. a laptop held longer than a water
    | bottle) without this default fighting them.
    |
    */
    'retention_days' => env('SCLF_RETENTION_DAYS', 90),

    /*
    |--------------------------------------------------------------------------
    | Single-device login
    |--------------------------------------------------------------------------
    |
    | When true, signing in on a new device ends every other active session
    | for that account (the older device gets an alert and is logged out).
    | Protects people who forgot to sign out on a friend's/shared device.
    |
    */
    'single_device_login' => env('SCLF_SINGLE_DEVICE_LOGIN', true),

    /*
    |--------------------------------------------------------------------------
    | User activity tracking (device / IP / spam monitoring)
    |--------------------------------------------------------------------------
    |
    | Backs App\Http\Middleware\TrackUserActivity and the Admin > User
    | Activity screen. `exclude_paths` keeps high-frequency polling routes
    | (unread notification counts, etc.) out of the log — they'd otherwise
    | drown out everything else and trip the burst thresholds for every
    | active user. Paths are matched with Request::is(), so no leading
    | slash and wildcards ('*') are supported.
    |
    */
    'activity' => [
        'enabled' => env('SCLF_TRACK_ACTIVITY', true),
        'burst_window_seconds' => env('SCLF_ACTIVITY_BURST_WINDOW', 60),
        'burst_limit' => env('SCLF_ACTIVITY_BURST_LIMIT', 40),
        'same_endpoint_limit' => env('SCLF_ACTIVITY_SAME_ENDPOINT_LIMIT', 20),
        'retention_days' => env('SCLF_ACTIVITY_RETENTION_DAYS', 90),
        'exclude_paths' => [
            'api/notifications/unread-count',
            'api/notifications',
            'api/counter/queue/mine',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Lost & found matching — machine-learning layer
    |--------------------------------------------------------------------------
    |
    | `ml_enabled` switches the trained model (App\Services\Matching\MatchLearner)
    | on or off. With it off — or before `php artisan matches:train` has been run —
    | scores are exactly the rule engine's. `model_path` is where the trained model
    | (a small JSON file of weights) is stored.
    |
    */
    'matching' => [
        'ml_enabled' => env('SCLF_MATCH_ML', true),
        'model_path' => env('SCLF_MATCH_MODEL_PATH', storage_path('app/matching/model.json')),
    ],

    /*
    |--------------------------------------------------------------------------
    | Staff approval workflow
    |--------------------------------------------------------------------------
    |
    | Accounts with the `staff` role can view everything an admin can, but any
    | write request (POST / PUT / PATCH / DELETE) is refused until the admin
    | has approved a matching request — see StaffApprovalService and the
    | RequireStaffApproval middleware. An approval is single-use and lapses
    | after `ttl_hours`.
    |
    | `exempt_paths` are writes staff may always do without approval (their own
    | login/session, password, 2FA, profile, notification bell, and the
    | approval-request endpoints themselves). Matched with Request::is().
    | Add a path here if some routine action (e.g. 'api/qr/scan') should not
    | need a request every time.
    |
    */
    'staff_approval' => [
        // Master switch (.env: SCLF_STAFF_REQUIRES_APPROVAL).
        //   true  = staff writes need the admin's approval (the rules below apply).
        //   false = staff act directly, with no approval and no restriction from the admin.
        'required' => (bool) env('SCLF_STAFF_REQUIRES_APPROVAL', true),

        'ttl_hours' => env('SCLF_STAFF_APPROVAL_TTL_HOURS', 24),

        // Request fields that are frozen at approval time. The admin approves
        // "create an Instructor", so the staff member can only create an
        // Instructor with that approval - not a Security Officer. Keyed by
        // "METHOD route-uri"; the value is the list of input fields whose
        // value must equal what was in the request the admin approved.
        'locked_fields' => [
            'POST api/admin/users' => ['role'],
            'PUT api/admin/users/{user}' => ['role'],
        ],
        'exempt_paths' => [
            'api/logout',
            'api/change-password',
            'api/2fa/*',
            'api/profile/*',
            'api/notifications/*',
            'api/push/*',
            'api/action-requests',
            'api/action-requests/*',
            // Staff handle the Matches queue themselves, just like the admin:
            // confirm a match (notify the owner) or reject it (dismiss).
            'api/matches/*/notify-owner',
            'api/matches/*/dismiss',
            // Read-only: scores an unsaved draft report, stores nothing.
            'api/matches/preview',
            // Reviewing sensitive photos/videos: staff, like security, can mark,
            // confirm or dismiss a violation without a per-action approval.
            'api/violations/*',
            'api/report-attachments/*/violation',
            // Approving a lost report (queues the alert emails): staff do this
            // themselves, same as security/admin, no per-action admin approval.
            'api/lost-items/*/approve',
        ],
    ],


    /*
    |--------------------------------------------------------------------------
    | Visitor portal (the page opened by scanning a visitor badge)
    |--------------------------------------------------------------------------
    |
    | Texts shown on /visitor/{token}. Edit freely — they are only wording.
    | `security_office` completes the sentence "...return it to ___".
    |
    */
    'visitor_portal' => [
        'college' => 'Opol Community College',
        'intro' => 'Opol Community College is a local college in Opol, Misamis Oriental, committed to providing accessible, quality higher education to the community. We are glad to have you on our campus.',
        'security_office' => env('SCLF_SECURITY_OFFICE', 'the Security Office at the main gate'),
        'conduct' => [
            'Wear this badge where it can be seen at all times while you are on campus.',
            'Stay in the areas related to your visit and follow the instructions of Security Officers.',
            'Photography or recording of students, offices and facilities needs permission from the school.',
            'The badge is non-transferable. Report a lost badge to Security right away.',
        ],
        'privacy' => 'We collected your name, ID details, contact number and purpose of visit for campus safety and security under the Data Privacy Act of 2012 (RA 10173). They are used only to manage your visit and keep the campus secure, are visible only to authorized school personnel, and are kept only as long as school policy requires. You may ask the Security Office about your record.',
    ],

    /*
    |--------------------------------------------------------------------------
    | Visitor badge pool
    |--------------------------------------------------------------------------
    |
    | Physical visitor badges are numbered 1..size and the letter changes with
    | the day of the week (Monday = M-01..M-200, Tuesday = T-01..T-200, ...). Within
    | a day, a badge that was issued and returned is NOT handed out again
    | until every badge in the pool has been issued once (the "round" ends),
    | then numbering starts again from the lowest free badge.
    |
    | Keys of `prefixes` are Carbon dayOfWeek values (0 = Sunday ... 6 = Saturday).
    |
    */
    'visitor_badges' => [
        'size' => env('SCLF_VISITOR_BADGE_SIZE', 200),
        'prefixes' => [
            1 => 'M', // Monday
            2 => 'T', // Tuesday
            3 => 'W', // Wednesday
            4 => 'H', // Thursday
            5 => 'F', // Friday
            6 => 'S', // Saturday
            0 => 'U', // Sunday
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Private photos (profile pictures, found/lost item photos)
    |--------------------------------------------------------------------------
    |
    | These live on the private disk and are shown through signed /media links.
    | A link stays valid for between 1x and 2x this many hours; the same photo
    | keeps the same link inside that window so browsers can cache it. Shorter
    | = a leaked link dies sooner; longer = fewer refreshes for people who keep
    | a tab open all day.
    |
    */
    'media' => [
        'url_ttl_hours' => (int) env('SCLF_MEDIA_URL_TTL_HOURS', 24),
    ],

    /*
    |--------------------------------------------------------------------------
    | Violations / sensitive-upload scanner
    |--------------------------------------------------------------------------
    |
    | The manual flow (reviewers press "Mark as violation") needs none of this.
    | With `enabled` true, every new report photo is sent to a moderation API
    | by App\Jobs\ScanAttachmentJob (queue worker / Hostinger cron). A hit
    | holds the file for review; it never counts against anyone until a
    | reviewer confirms it. Provider: Google Vision SafeSearch.
    |
    | Scanning only runs when `enabled` is true AND `api_key` is non-empty
    | (see ImageModerator::isActive()); enabled-without-a-key is treated as off.
    |
    */
    'moderation' => [
        'enabled' => env('SCLF_MODERATION_ENABLED', false),
        'provider' => env('SCLF_MODERATION_PROVIDER', 'google_vision'),
        'api_key' => env('SCLF_MODERATION_API_KEY'),
        // Likelihood at or above which a category is a hit:
        // VERY_UNLIKELY < UNLIKELY < POSSIBLE < LIKELY < VERY_LIKELY
        'threshold' => env('SCLF_MODERATION_THRESHOLD', 'LIKELY'),
        'timeout' => env('SCLF_MODERATION_TIMEOUT', 20),
        // Optional: comma-separated words that flag a photo when the OCR text
        // in it contains one. Empty = text is not checked.
        'blocked_words' => env('SCLF_MODERATION_BLOCKED_WORDS', ''),
    ],

    // Master switch for the "classmate lost an item" email to all students and
    // instructors when a lost report is approved. Keep false while on a mail
    // plan with a daily cap (Gmail ~500/day). Approval itself works either way.
    'broadcast_lost_item_emails' => env('SCLF_BROADCAST_LOST_ITEM_EMAILS', false),

    // Recipients per BCC email (max 100; Gmail's per-message limit).
    'broadcast_batch_size' => env('SCLF_BROADCAST_BATCH_SIZE', 50),

];
