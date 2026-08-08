// SCLF service worker — Web Push only. Deliberately minimal: no asset
// caching / offline support here, since the manifest.json + "Add to Home
// Screen" installability is handled separately (PwaManifestController) and
// this app's data is never meant to be viewed stale/offline. This file's
// only job is to receive push events and OS-level notification clicks even
// when no SCLF tab/window is open.

self.addEventListener('install', () => {
    // Activate immediately rather than waiting for old tabs to close —
    // there's no cached content here that an in-flight tab could be
    // relying on, so there's nothing to protect by staying old.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Fired by the browser when a push message arrives from the server —
// this runs even if every SCLF tab is closed, as long as the browser
// itself is installed and (on desktop) running in the background.
self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (e) {
        payload = { title: 'SCLF', body: event.data ? event.data.text() : 'You have a new notification.' };
    }

    const title = payload.title || 'SCLF - Opol Community College';
    const options = {
        body: payload.body || '',
        icon: payload.icon || '/images/site-logo.png',
        badge: payload.badge || '/images/site-logo.png',
        // Same-tag pushes replace each other in the tray instead of
        // stacking — e.g. repeated updates on the same claim collapse
        // into one notification rather than flooding the tray.
        tag: payload.tag || 'sclf-notification',
        data: { url: payload.url || '/app/notifications' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Fired when the person taps/clicks the OS notification itself.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/app/notifications';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
            // If SCLF is already open in some tab, focus it and navigate
            // there instead of opening a second window.
            for (const client of clientsList) {
                if ('focus' in client) {
                    client.postMessage({ type: 'sclf-notification-click', url: targetUrl });
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
