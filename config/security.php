<?php

return [

    /*
    |--------------------------------------------------------------------------
    | HTTP security headers (App\Http\Middleware\SecurityHeaders)
    |--------------------------------------------------------------------------
    |
    | csp:  'off' | 'report-only' | 'enforce'
    |       Start with report-only: the browser only prints violations in the
    |       DevTools console and nothing breaks. Click through the whole app
    |       (login, QR scanner, uploads, push, printing) with the console open;
    |       when there are no violations, switch to 'enforce'.
    |       The CSP is never sent in the local environment (it would block the
    |       Vite dev server).
    | hsts: only sent on real HTTPS requests. Turn on after confirming HTTPS
    |       works everywhere, because browsers remember it.
    |
    */
    'headers' => [
        'csp' => env('SECURITY_CSP', 'report-only'),
        'hsts' => env('SECURITY_HSTS', false),
        'hsts_max_age' => env('SECURITY_HSTS_MAX_AGE', 31536000),
    ],

    /*
    |--------------------------------------------------------------------------
    | Suspicious-activity alerts (php artisan security:watch)
    |--------------------------------------------------------------------------
    |
    | Run every 10 minutes by the scheduler. When a threshold is crossed inside
    | the look-back window, one email is sent (at most one per hour) and a
    | warning is written to the log. `to` falls back to every Admin account.
    |
    */
    'alerts' => [
        'to' => env('SECURITY_ALERT_EMAIL'),
        'window_minutes' => env('SECURITY_ALERT_WINDOW', 15),
        'failed_logins' => env('SECURITY_ALERT_FAILED_LOGINS', 30),
        'failed_logins_per_ip' => env('SECURITY_ALERT_FAILED_PER_IP', 15),
        'suspicious_requests' => env('SECURITY_ALERT_SUSPICIOUS', 10),
        'denied_requests' => env('SECURITY_ALERT_DENIED', 100), // 401/403/429
        'server_errors' => env('SECURITY_ALERT_SERVER_ERRORS', 5), // 5xx
        'cooldown_minutes' => 60,
    ],
];
