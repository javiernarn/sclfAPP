<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class PushController extends Controller
{
    /**
     * Register (or refresh) this browser's push subscription for the
     * signed-in user. Keyed on endpoint_hash so re-subscribing the same
     * device — e.g. the browser rotated its subscription, which does
     * happen periodically — updates the existing row instead of piling
     * up duplicates that would each get pushed to.
     */
    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'endpoint' => 'required|string',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
        ]);

        $request->user()->pushSubscriptions()->updateOrCreate(
            ['endpoint_hash' => hash('sha256', $validated['endpoint'])],
            [
                'endpoint' => $validated['endpoint'],
                'public_key' => $validated['keys']['p256dh'],
                'auth_token' => $validated['keys']['auth'],
                'content_encoding' => 'aesgcm',
            ]
        );

        return response()->json(['success' => true]);
    }

    /**
     * Drop this device's subscription — called when the user toggles
     * notifications off, or the frontend detects the browser's own
     * subscription was revoked and wants the server record cleaned up
     * to match.
     */
    public function unsubscribe(Request $request)
    {
        $validated = $request->validate(['endpoint' => 'required|string']);

        $request->user()->pushSubscriptions()
            ->where('endpoint_hash', hash('sha256', $validated['endpoint']))
            ->delete();

        return response()->json(['success' => true]);
    }

    /**
     * The VAPID public key the frontend needs to call
     * pushManager.subscribe(). Whether *this specific browser* already
     * has a live subscription is answered locally, by asking the service
     * worker's PushManager directly — that's the source of truth, not
     * this server (a user signed in on two devices would otherwise look
     * "subscribed" on a laptop that's never granted permission).
     *
     * Optionally accepts `endpoint` — the browser's current subscription
     * endpoint, if it has one — and reports whether that specific
     * endpoint is registered to *this* signed-in account. AuthContext
     * uses this right after login/register to detect a shared-device
     * handoff: a subscription left behind by whoever used this browser
     * before, on an account that isn't the one now signed in.
     */
    public function status(Request $request)
    {
        $ownedByCurrentUser = null;

        if ($request->filled('endpoint')) {
            $ownedByCurrentUser = $request->user()->pushSubscriptions()
                ->where('endpoint_hash', hash('sha256', $request->query('endpoint')))
                ->exists();
        }

        return response()->json([
            'configured' => (bool) config('webpush.vapid.public_key'),
            'vapid_public_key' => config('webpush.vapid.public_key'),
            'owned_by_current_user' => $ownedByCurrentUser,
        ]);
    }
}
