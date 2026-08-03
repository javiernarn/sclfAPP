import secureLocalStorage from 'react-secure-storage';

// Separate from the *session token* remember-me in axiosConfig.js (which
// controls whether you stay logged in) — this one remembers the actual
// email/password so the Login form can prefill itself on the next visit.
//
// Security note: secureLocalStorage encrypts what it stores, but the
// decryption key ships inside the frontend JS bundle, so this is
// obfuscation, not real protection — anyone with access to the browser/
// device (or DevTools) can still recover a saved password. That's an
// inherent limitation of storing a password in the browser at all, not
// something this hook can fully close. It's only ever written when the
// person explicitly checks "Keep me signed in", and it's the person's own
// device/browser storage.
const KEY = 'sclf_remembered_credentials';

export function loadRememberedCredentials() {
    try {
        const raw = secureLocalStorage.getItem(KEY);
        if (!raw) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
        return null;
    }
}

export function saveRememberedCredentials(email, password) {
    try {
        secureLocalStorage.setItem(KEY, JSON.stringify({ email, password }));
    } catch (e) {
        // Storage can fail in private/incognito modes — fail silently,
        // it's a convenience feature, not a required one.
    }
}

export function clearRememberedCredentials() {
    try {
        secureLocalStorage.removeItem(KEY);
    } catch (e) {
        // ignore
    }
}
