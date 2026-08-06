<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Notification;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Delivers a notification as a real OS-level push — it shows up outside
 * the browser/PWA (in the system notification tray) as long as the
 * device's browser has a live push subscription, even with SCLF closed.
 * Registered against the 'webpush' channel name in AppServiceProvider.
 *
 * A notification class opts in by implementing toWebPush($notifiable) and
 * returning an array shaped like:
 *   ['title' => ..., 'body' => ..., 'url' => ..., 'icon' => (optional)]
 * public/sw.js reads that same shape out of the push payload.
 */
class WebPushChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        if (!method_exists($notification, 'toWebPush')) {
            return;
        }

        $payload = $notification->toWebPush($notifiable);
        if (!$payload) {
            return;
        }

        $subscriptions = $notifiable->pushSubscriptions()->get();
        if ($subscriptions->isEmpty()) {
            return;
        }

        if (!config('webpush.vapid.public_key') || !config('webpush.vapid.private_key')) {
            // No keys configured yet (fresh install before `php artisan
            // webpush:vapid` has been run) — skip quietly rather than
            // throwing, database/mail channels still deliver fine.
            return;
        }

        // Push is a best-effort, non-critical delivery channel — a failure
        // here (bad VAPID keys, EC/OpenSSL misconfiguration, an expired
        // subscription payload, a network hiccup to the push service) must
        // never be allowed to bubble up and fail the request that
        // triggered the notification. Notifications are typically fired
        // from inside a business-critical DB transaction (e.g. checking an
        // item in/out), and an uncaught exception here would roll that
        // whole operation back even though it had nothing to do with push.
        try {
            $webPush = new WebPush([
                'VAPID' => [
                    'subject' => config('webpush.vapid.subject'),
                    'publicKey' => config('webpush.vapid.public_key'),
                    'privateKey' => config('webpush.vapid.private_key'),
                ],
            ]);

            foreach ($subscriptions as $sub) {
                $webPush->queueNotification(
                    Subscription::create([
                        'endpoint' => $sub->endpoint,
                        'publicKey' => $sub->public_key,
                        'authToken' => $sub->auth_token,
                        'contentEncoding' => $sub->content_encoding,
                    ]),
                    json_encode($payload)
                );
            }

            foreach ($webPush->flush() as $report) {
                if ($report->isSuccess()) {
                    continue;
                }

                // 404/410 = the push service has permanently discarded this
                // subscription (uninstalled, permission revoked, browser
                // data cleared) — stop trying it. Any other failure
                // (network hiccup, 429, etc.) is left in place to retry
                // next time.
                $statusCode = $report->getResponse()?->getStatusCode();
                if (in_array($statusCode, [404, 410], true)) {
                    $endpoint = $report->getRequest()->getUri()->__toString();
                    $notifiable->pushSubscriptions()
                        ->where('endpoint_hash', hash('sha256', $endpoint))
                        ->delete();
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }
}