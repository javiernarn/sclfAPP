<?php

return [

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
        ],
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

];
