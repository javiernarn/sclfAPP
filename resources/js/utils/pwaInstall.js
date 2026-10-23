// Install-app state for THIS device + browser.
//
// Why not the IP address? An IP says nothing about whether the app is
// installed on a particular phone: a whole campus shares a few Wi-Fi
// addresses, mobile data changes IP constantly, and one phone moves between
// networks all day. The browser itself knows the real answer, so we ask it:
//
//   1. running as an installed app      display-mode: standalone (iOS: navigator.standalone)
//   2. the browser says "installed"     `appinstalled` event + getInstalledRelatedApps()
//   3. this device remembered it        localStorage flag, set the moment 1 or 2 is true
//   4. "Not now" was tapped recently    snoozed for SNOOZE_DAYS, then asked again
//
// Imported once, early (main.jsx), because Chrome can fire
// `beforeinstallprompt` before React has mounted.

const INSTALLED_KEY = 'sclf.pwa.installed';
const SNOOZE_KEY = 'sclf.pwa.snoozedUntil';
export const SNOOZE_DAYS = 7;

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

const read = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* private mode: still works for this visit */ } };

export const isStandalone = () =>
    (typeof window.matchMedia === 'function' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: minimal-ui)').matches)) ||
    window.navigator.standalone === true;

// iPhone / iPad (iPadOS reports itself as a Mac with a touch screen).
export const isIos = () => {
    const ua = window.navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
};

// Browsers that really cannot add to the home screen from the page
// (Facebook/Messenger/Instagram/Line in-app browsers).
export const isInAppBrowser = () => /FBAN|FBAV|Instagram|Line\/|Messenger|MicroMessenger/i.test(navigator.userAgent || '');

export const isInstalled = () => {
    if (isStandalone()) { write(INSTALLED_KEY, '1'); return true; }
    return read(INSTALLED_KEY) === '1';
};

export const markInstalled = () => {
    write(INSTALLED_KEY, '1');
    deferredPrompt = null;
    notify();
};

export const isSnoozed = () => Number(read(SNOOZE_KEY) || 0) > Date.now();

export const snooze = (days = SNOOZE_DAYS) => {
    write(SNOOZE_KEY, String(Date.now() + days * 86400000));
    notify();
};

export const canNativePrompt = () => !!deferredPrompt;

// Opens the browser's own install dialog. Resolves 'accepted' | 'dismissed' | 'unavailable'.
export const promptInstall = async () => {
    if (!deferredPrompt) return 'unavailable';
    const evt = deferredPrompt;
    deferredPrompt = null;          // a prompt event can only be used once
    notify();
    try {
        await evt.prompt();
        const { outcome } = await evt.userChoice;
        if (outcome === 'accepted') markInstalled();
        else snooze();
        return outcome;
    } catch {
        return 'unavailable';
    }
};

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();         // we show our own button instead of the browser's mini-bar
        deferredPrompt = e;
        notify();
    });
    window.addEventListener('appinstalled', markInstalled);

    // Installed earlier, now browsing in a normal tab? Chrome/Edge on Android
    // and desktop can tell us (needs `related_applications` in the manifest).
    if (typeof navigator.getInstalledRelatedApps === 'function') {
        navigator.getInstalledRelatedApps()
            .then((apps) => { if (apps && apps.length) markInstalled(); })
            .catch(() => { /* not supported here: the other checks still apply */ });
    }
}
