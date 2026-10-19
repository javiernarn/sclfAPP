import secureLocalStorage from 'react-secure-storage';

// "Keep me signed in" also remembers the email + password so the Login form
// can prefill itself — but ONLY for this browser tab (sessionStorage).
//
// Why not localStorage: anything in localStorage stays on the device forever
// and is readable by any script on the page, so a saved password there
// outlives the session and is exposed to a single XSS bug or a shared
// computer. sessionStorage is wiped by the browser as soon as the tab or
// window is closed, and it is never shared with other tabs.
//
// Students who want the form prefilled on later visits can let their
// browser's own password manager do it: the Login inputs already carry the
// standard autocomplete="email" / "current-password" attributes, and the
// browser stores that in its encrypted vault instead of in this app.
const KEY = 'sclf_remembered_credentials';

// Older versions kept this in localStorage (via react-secure-storage). Delete
// that copy the first time we run, so nobody's password stays behind there.
function purgeLegacyStorage() {
    try {
        secureLocalStorage.removeItem(KEY);
    } catch (e) {
        // ignore
    }
    try {
        window.localStorage.removeItem(KEY);
    } catch (e) {
        // ignore
    }
}

export function loadRememberedCredentials() {
    purgeLegacyStorage();
    try {
        const raw = window.sessionStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

export function saveRememberedCredentials(email, password) {
    purgeLegacyStorage();
    try {
        window.sessionStorage.setItem(KEY, JSON.stringify({ email, password }));
    } catch (e) {
        // Storage can fail in private/incognito modes — fail silently,
        // it's a convenience feature, not a required one.
    }
}

export function clearRememberedCredentials() {
    purgeLegacyStorage();
    try {
        window.sessionStorage.removeItem(KEY);
    } catch (e) {
        // ignore
    }
}
