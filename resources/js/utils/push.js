// Web Push helpers — OS-level notifications outside the browser tab/PWA.
// Kept framework-agnostic (no React here) so it's easy to unit test and
// so the service worker registration can happen once at app startup,
// independent of whichever page later renders the on/off toggle.

export const isPushSupported = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Registers /sw.js if it isn't already. Safe to call repeatedly — the
// browser no-ops a re-registration of the same script. Called once from
// main.jsx on every load (registering costs nothing and doesn't prompt
// for permission), and again defensively before subscribe().
export const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) return null;
    try {
        return await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
        console.error('SCLF: service worker registration failed', err);
        return null;
    }
};

// A subscription already sitting in this browser for this origin, if any
// — the actual source of truth for "is push on right now", since the
// server only knows what we last told it.
export const getCurrentSubscription = async () => {
    if (!isPushSupported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
};

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
};

// Full opt-in flow: prompt for permission (if not already decided),
// subscribe this browser with the push service, and hand the
// subscription to the given async `persist` callback (the caller POSTs
// it to /api/push/subscribe — kept out of this file so it can use the
// app's shared axios instance/auth token instead of a bare fetch()).
// Returns { status } where status is 'subscribed' | 'denied' | 'unsupported'.
export const enablePush = async (vapidPublicKey, persist) => {
    if (!isPushSupported()) return { status: 'unsupported' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { status: 'denied' };

    const reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready);

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
        subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
    }

    await persist(subscription.toJSON());
    return { status: 'subscribed' };
};

// Reverse of enablePush: unsubscribes this browser and, if a `remove`
// callback is given, hands it the (now-stale) endpoint so the caller can
// tell the server to drop its matching row. `remove` is optional — some
// callers (a forced logout after a 401, where the auth token is already
// invalid) only want the browser-side unsubscribe; a stale server row
// left behind in that case self-heals the next time a push is attempted
// against it (see WebPushChannel's 404/410 pruning).
export const disablePush = async (remove) => {
    const subscription = await getCurrentSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    if (remove) {
        try {
            await remove(endpoint);
        } catch {
            // Best-effort — see note above, this self-heals server-side.
        }
    }
};
