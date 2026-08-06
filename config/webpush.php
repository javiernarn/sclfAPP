<?php

return [

    /*
    |--------------------------------------------------------------------------
    | VAPID keys
    |--------------------------------------------------------------------------
    |
    | Identify this server to push services (Chrome/FCM, Firefox/Mozilla,
    | etc.) so they'll accept push requests from it. Generate a pair with
    | `php artisan webpush:vapid` — it writes both values into .env for you.
    | Never commit real keys; each environment (local/staging/prod) should
    | mint its own pair, since subscriptions are tied to the public key
    | that was active when the browser subscribed.
    |
    */

    'vapid' => [
        'subject' => env('VAPID_SUBJECT', env('MAIL_FROM_ADDRESS', 'mailto:admin@example.com')),
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
    ],

];
