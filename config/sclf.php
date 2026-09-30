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
        'exempt_paths' => [
            'api/logout',
            'api/change-password',
            'api/2fa/*',
            'api/profile/*',
            'api/notifications/*',
            'api/push/*',
            'api/action-requests',
            'api/action-requests/*',
        ],
    ],

];
