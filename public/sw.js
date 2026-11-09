// SCLF service worker — Web Push + offline app shell.
//
// Offline behaviour (installed PWA / any browser):
//   - The app SHELL (the page HTML, scripts, styles, fonts, images, icons) is
//     cached, so the interface still opens and every screen still draws with
//     no connection.
//   - DATA is never cached: anything under /api/ (and uploaded photos under
//     /storage/) always goes to the network. Offline, lists/records simply do
//     not load; nothing stale or private is ever shown from here.
//   - Push events and notification clicks work as before.

const VERSION = 'v2'; // v2: drops any page saved from the Vite dev server (it would show a blank screen offline)
const SHELL_CACHE = `sclf-shell-${VERSION}`;   // page HTML only (no user data)
const ASSET_CACHE = `sclf-assets-${VERSION}`;   // /build/assets, /images, face models
const FONT_CACHE = `sclf-fonts-${VERSION}`;     // Google Fonts
const KEEP = [SHELL_CACHE, ASSET_CACHE, FONT_CACHE];

const EXTRA_ASSETS = [
    '/images/site-logo.png', '/images/icon-192.png', '/images/icon-512.png',
    '/images/icon-maskable-512.png', '/images/apple-touch-icon.png',
    '/images/favicon-32.png', '/images/favicon-16.png', '/favicon.ico',
];

// Every file the production build produced (read from Vite's manifest), so even
// pages the person has never opened are already on the device.
async function buildFileList() {
    try {
        const res = await fetch('/build/manifest.json', { cache: 'no-cache' });
        if (!res.ok) return [];
        const manifest = await res.json();
        const urls = new Set();
        Object.values(manifest).forEach((e) => {
            if (e.file) urls.add('/build/' + e.file);
            (e.css || []).forEach((c) => urls.add('/build/' + c));
            (e.assets || []).forEach((a) => urls.add('/build/' + a));
        });
        return [...urls];
    } catch (e) {
        return []; // dev server / no build: nothing to precache
    }
}

// A page produced while `npm run dev` is running points at the Vite dev server
// for its scripts; saved, it would show a blank screen once that server is off.
// Only pages from a real build (public/build) are worth saving.
async function saveShell(cache, key, res) {
    try {
        if (!res || !res.ok || res.redirected || res.type !== 'basic') return;
        const text = await res.clone().text();
        if (text.includes('@vite/client') || text.includes('/@react-refresh')) return;
        // SCLF_SYSTEM_MODE screen (maintenance / error / on): never keep it as the offline page.
        if (text.includes('data-system-mode=')) return;
        await cache.put(key, res.clone());
    } catch (e) { /* best effort */ }
}

async function precache() {
    const shell = await caches.open(SHELL_CACHE);
    const assets = await caches.open(ASSET_CACHE);
    const files = [...(await buildFileList()), ...EXTRA_ASSETS];
    await Promise.allSettled([
        fetch('/login', { credentials: 'same-origin' }).then((r) => saveShell(shell, new Request(self.location.origin + '/login'), r)).catch(() => {}),
        ...files.map((u) => assets.add(u).catch(() => {})),
    ]);
}

// Drop old cache versions and build files that no longer exist.
async function cleanup() {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('sclf-') && !KEEP.includes(n)).map((n) => caches.delete(n)));
    try {
        const keep = new Set((await buildFileList()).concat(EXTRA_ASSETS));
        if (keep.size <= EXTRA_ASSETS.length) return; // no manifest: don't prune blindly
        const assets = await caches.open(ASSET_CACHE);
        for (const req of await assets.keys()) {
            const path = new URL(req.url).pathname;
            if (path.startsWith('/build/assets/') && !keep.has(path)) await assets.delete(req);
        }
    } catch (e) { /* best effort */ }
}

self.addEventListener('install', (event) => {
    // No automatic skipWaiting any more: a new version waits until the person
    // taps "Update now" in the app (see UpdateNotice), so the page they are using
    // is never swapped underneath them. A very first install still activates at once.
    event.waitUntil(precache());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(Promise.all([cleanup(), self.clients.claim()]));
});

const shellKey = (req) => {
    const u = new URL(req.url);
    return new Request(u.origin + u.pathname);
};

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

// Page loads: network first (always the freshest page when online), falling
// back to the saved shell when offline or the connection is too slow.
async function handleNavigation(request) {
    const cache = await caches.open(SHELL_CACHE);
    try {
        const res = await Promise.race([fetch(request), timeout(10000)]);
        // Host is down/restarting (gateway error): use the saved shell instead.
        if ([502, 503, 504].includes(res.status)) throw new Error('server down');
        saveShell(cache, shellKey(request), res.clone());
        return res;
    } catch (e) {
        const hit =
            (await cache.match(shellKey(request))) ||
            (await cache.match('/login')) ||
            (await cache.match((await cache.keys())[0] || '/login'));
        if (hit) return hit;
        return new Response(
            '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>SCLF</title><body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px">' +
            '<div><h1>You\'re offline</h1><p>Open SCLF once while connected so it can be used without a connection.</p>' +
            '<button onclick="location.reload()" style="padding:10px 22px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:700">Try again</button></div>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    if (hit) return hit;
    const res = await fetch(request);
    if (res && res.status === 200 && res.type === 'basic') cache.put(request, res.clone());
    return res;
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    const refresh = fetch(request)
        .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
            return res;
        })
        .catch(() => null);
    return hit || (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (url.origin === self.location.origin) {
        const p = url.pathname;
        // DATA is never cached or intercepted.
        if (p.startsWith('/api/') || p.startsWith('/storage/') || p.startsWith('/broadcasting') ||
            p.startsWith('/sanctum') || p === '/sw.js' || p === '/manifest.json') return;

        if (req.mode === 'navigate') {
            event.respondWith(handleNavigation(req));
            return;
        }
        if (p.startsWith('/build/assets/') || p.startsWith('/images/') || p.startsWith('/face-models/') || p === '/favicon.ico') {
            event.respondWith(cacheFirst(req, ASSET_CACHE));
        }
        return;
    }

    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    }
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
