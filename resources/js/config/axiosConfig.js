import axios from 'axios';
import secureLocalStorage from 'react-secure-storage';
import { BASE_URL } from './constant';
import { showToast, requestApproval, notifySessionDisplaced } from '../utils/eventBus';
import { humanizeValidationErrors } from '../utils/validators';
import { disablePush } from '../utils/push';
import { clearRememberedCredentials } from '../hooks/useRememberedCredentials';
import { preloadFromApiData } from '../utils/imageCache';

const SESSION_KEY = 'sclf_token_pair';
const LOCAL_KEY = 'token_pair';

// The long-lived REFRESH token no longer lives in this app at all: the server
// keeps it in an HttpOnly cookie that JavaScript cannot read (see
// App\Support\RefreshCookie). What the browser keeps here is only:
//   - the short-lived (15 min) access token, in sessionStorage, and
//   - a harmless hint saying a refresh cookie probably exists
//     ('persistent' = "Keep me signed in", 'session' = until the browser
//     closes). The hint is NOT a credential; it only stops us from calling
//     /token/refresh for visitors who were never signed in.
// If the server runs with SCLF_REFRESH_COOKIE=false it sends the refresh
// token in the JSON body instead, and the older storage below is used.
const HINT_KEY = 'sclf_session_hint';

const readHint = () => {
    try { return window.localStorage.getItem(HINT_KEY); } catch { return null; }
};
const writeHint = (value) => {
    try {
        if (value) window.localStorage.setItem(HINT_KEY, value);
        else window.localStorage.removeItem(HINT_KEY);
    } catch { /* storage unavailable */ }
};
export const hasSessionHint = () => !!readHint();
const isRemembered = () => secureLocalStorage.getItem(LOCAL_KEY) != null || readHint() === 'persistent';

// Never show framework internals ("No query results for model [App\\Models\\X] 3")
// to a person — swap them for something they can understand.
const readableMessage = (message) => {
    if (!message) return '';
    if (/No query results for model|App\\Models\\/i.test(message)) {
        return 'We couldn’t find that record. It may have been deleted or you may not have access to it.';
    }
    return message;
};

const instance = axios.create({
    baseURL: BASE_URL + 'api/',
    timeout: 15000,
});

// "Keep me signed in" checked -> pair persists in secureLocalStorage
// (survives closing the browser). Left unchecked -> pair only lives in
// this tab's sessionStorage, so it's gone once the tab/browser closes.
// Stored together (not as two separate keys) since they're always read
// and written as a unit.
export const getStoredPair = () => {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) {
        try { return JSON.parse(raw); } catch { /* fall through */ }
    }
    const stored = secureLocalStorage.getItem(LOCAL_KEY);
    return stored && typeof stored === 'object' ? stored : null;
};

export const getStoredToken = () => getStoredPair()?.access_token || null;
const getStoredRefreshToken = () => getStoredPair()?.refresh_token || null;

// ---- "Last loaded" copy of data, for when there is no connection ----------
// Every successful GET reply is saved on this device (Cache API). If the same
// request later fails because there is NO connection, the saved copy is shown
// instead, so screens the person already opened still show what they last saw.
// Nothing new can load offline, and the whole store is wiped with the session
// (logout, expiry, signed in elsewhere, a different person signing in).
const DATA_CACHE = 'sclf-data-v1';
const NO_OFFLINE_COPY = ['/login', '/logout', '/register', '/token', '/2fa', '/push', '/password', '/email/verify'];
const cacheKeyFor = (config) => {
    try { return new Request('https://sclf-offline.local/' + encodeURIComponent(instance.getUri(config))); } catch { return null; }
};
const copyAllowed = (config) =>
    config && String(config.method || 'get').toLowerCase() === 'get' &&
    config.responseType !== 'blob' && config.responseType !== 'arraybuffer' &&
    typeof window !== 'undefined' && 'caches' in window &&
    !NO_OFFLINE_COPY.some((p) => String(config.url || '').includes(p));

const saveOfflineCopy = async (config, data) => {
    try {
        if (!copyAllowed(config) || data === undefined) return;
        const key = cacheKeyFor(config);
        if (!key) return;
        const cache = await window.caches.open(DATA_CACHE);
        await cache.put(key, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
    } catch { /* storage full/unavailable: skip */ }
};

const readOfflineCopy = async (config) => {
    try {
        if (!copyAllowed(config)) return null;
        const key = cacheKeyFor(config);
        if (!key) return null;
        const cache = await window.caches.open(DATA_CACHE);
        const hit = await cache.match(key);
        return hit ? await hit.json() : null;
    } catch { return null; }
};

export const clearOfflineData = () => {
    try { if (typeof window !== 'undefined' && 'caches' in window) window.caches.delete(DATA_CACHE); } catch { /* ignore */ }
};

// Last known profile (user + roles), kept ONLY so the installed app can still
// draw its screens when the phone has no connection. It holds no data lists and
// is wiped with the session (logout, expiry, signed in elsewhere).
const ME_KEY = 'sclf_me_cache';

export const readMeCache = () => {
    try {
        const raw = window.sessionStorage.getItem(ME_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* fall through */ }
    try {
        const stored = secureLocalStorage.getItem(ME_KEY);
        return stored && typeof stored === 'object' ? stored : null;
    } catch { return null; }
};

export const writeMeCache = (user, roles) => {
    if (!user) return;
    const value = { user, roles: roles || [] };
    try { window.sessionStorage.setItem(ME_KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
    try {
        if (isRemembered()) secureLocalStorage.setItem(ME_KEY, value);
        else secureLocalStorage.removeItem(ME_KEY);
    } catch { /* storage unavailable */ }
};

export const clearStoredToken = (keepMeCache = false) => {
    window.sessionStorage.removeItem(SESSION_KEY);
    secureLocalStorage.removeItem(LOCAL_KEY);
    writeHint(null);
    if (!keepMeCache) {
        clearOfflineData();
        try { window.sessionStorage.removeItem(ME_KEY); } catch { /* storage unavailable */ }
        try { secureLocalStorage.removeItem(ME_KEY); } catch { /* storage unavailable */ }
    }
    // A saved deep link (?redirect=) was meant for the account that just ended.
    try {
        window.sessionStorage.removeItem('sclf-post-login-redirect');
        window.sessionStorage.removeItem('sclf-post-login-uid');
    } catch { /* storage unavailable */ }
};

// pair: { access_token, refresh_token, expires_in }
export const storeTokenPair = (pair, remember = true) => {
    sessionDisplaced = false;
    loggingOut = false;
    clearStoredToken(true); // keep the offline profile cache: this also runs on every silent token refresh
    if (!remember) { try { secureLocalStorage.removeItem(ME_KEY); } catch { /* storage unavailable */ } }
    // Remember WHEN the access token dies so we can swap it for a fresh one
    // just before that, instead of waiting for a 401 (see request interceptor).
    const expiresAt = pair.expires_in ? Date.now() + pair.expires_in * 1000 : null;
    if (!pair.refresh_token) {
        // Cookie mode: only the access token is kept, always per tab.
        window.sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ access_token: pair.access_token, expires_in: pair.expires_in, expires_at: expiresAt })
        );
        writeHint(remember ? 'persistent' : 'session');
    } else if (remember) {
        secureLocalStorage.setItem(LOCAL_KEY, { ...pair, expires_at: expiresAt });
    } else {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...pair, expires_at: expiresAt }));
    }
};

// Refresh this many ms before the access token expires.
const REFRESH_AHEAD_MS = 60 * 1000;

// ONE refresh at a time, shared by everyone who needs it (proactive refresh
// and 401 recovery). Refresh tokens are single-use/rotating, so two parallel
// calls would make the second look like token reuse and kill the session.
let refreshPromise = null;
const refreshOnce = () => {
    if (!refreshPromise) {
        const remember = isRemembered();
        const refreshToken = getStoredRefreshToken();
        refreshPromise = instance
            .post(
                '/token/refresh',
                refreshToken ? { refresh_token: refreshToken, remember } : { remember },
                { silent: true, skipAuthRedirect: true }
            )
            .then((res) => {
                storeTokenPair(res.data, remember);
                return res.data.access_token;
            })
            .finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
};

const isAuthUrl = (url) => ['/login', '/logout', '/token/refresh', '/2fa/login-verify'].some((p) => url?.includes(p));

// Called once when the app opens in a tab that has no access token (new tab,
// browser restarted with "Keep me signed in"): trade the refresh cookie for a
// fresh access token. Returns true when a session was restored.
let restoreFailedOffline = false;
// True when the last restoreSession() failed only because there was no
// connection / the server was unreachable (the session itself may be fine).
export const restoreWasOffline = () => restoreFailedOffline;

export const restoreSession = async () => {
    restoreFailedOffline = false;
    if (getStoredToken() || !hasSessionHint()) return false;
    const remember = isRemembered();
    try {
        const res = await instance.post('/token/refresh', { remember }, { silent: true, skipAuthRedirect: true });
        storeTokenPair(res.data, remember);
        return true;
    } catch (err) {
        if (!err.response || err.response.status >= 500) {
            // No connection (e.g. the installed app opened offline): the session
            // is NOT dead. Keep it so the app can still open and sign back in
            // by itself once the connection returns.
            restoreFailedOffline = true;
            return false;
        }
        clearStoredToken();
        return false;
    }
};

// Always read the current token fresh per-request (rather than setting
// instance.defaults.headers.common once) so a token swapped in mid-session
// by the refresh flow below applies immediately, including to requests
// that were queued waiting on that same refresh.
instance.interceptors.request.use(async (config) => {
    // Quietly renew the access token shortly BEFORE it expires so the person
    // never sees a failed request, a "session expired" toast or a surprise
    // redirect. If this fails we just carry on: the 401 handler below is the
    // safety net and decides whether the session is really over.
    const pair = getStoredPair();
    if (
        pair?.access_token && pair.expires_at && !sessionDisplaced && !isAuthUrl(config.url) &&
        pair.expires_at - Date.now() < REFRESH_AHEAD_MS &&
        (pair.refresh_token || hasSessionHint())
    ) {
        try { await refreshOnce(); } catch { /* fall through to the 401 safety net */ }
    }
    const token = getStoredToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Set once the server tells us this account signed in on another device.
// From then on every straggling request (polls, retries) is rejected
// quietly instead of each one triggering its own redirect/toast while the
// alert is on screen.
let sessionDisplaced = false;

const handleDisplaced = (device) => {
    if (sessionDisplaced) return;
    sessionDisplaced = true;
    // This device lost the account to a newer login: drop the saved
    // session AND the remembered email/password ("Keep this session open")
    // so nobody can get back in from here with one tap. Only this browser's
    // storage is touched — the device that just signed in is unaffected.
    clearStoredToken();
    try { clearRememberedCredentials(); } catch { /* storage unavailable */ }
    disablePush().catch(() => {});
    notifySessionDisplaced({ device: device || null });
};

// A brand-new login in this tab re-arms the check (see storeTokenPair).
let loggingOut = false;
const hardLogout = () => {
    // Once is enough: several requests failing together must not stack toasts.
    if (sessionDisplaced || loggingOut) return;
    loggingOut = true;
    clearStoredToken();
    disablePush().catch(() => {});
    showToast({ type: 'warning', title: 'Session expired', message: 'Please sign in again to continue.' });
    window.location.href = `/login?type=session-expired`;
};

// ---- Inactivity sign-out for sessions WITHOUT "Keep this session open" ----
// Ticked  -> never signed out for being idle (the access token keeps renewing
//            itself, and the server keeps the long refresh token sliding).
// Unticked -> after IDLE_LIMIT_MS with no mouse / keyboard / touch / scroll the
//            person is signed out. Background polling does NOT count as
//            activity, only real input does. Keep the value equal to
//            SCLF_SESSION_IDLE_MINUTES on the server (the server also expires
//            the refresh token a few minutes after that as a backstop).
const IDLE_LIMIT_MS = (Number(import.meta.env?.VITE_SESSION_IDLE_MINUTES) || 15) * 60 * 1000;
let lastActivityAt = Date.now();
let idleSigningOut = false;

const markActive = () => { lastActivityAt = Date.now(); };
['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove'].forEach((evt) => {
    window.addEventListener(evt, markActive, { passive: true, capture: true });
});

const idleSignOut = async () => {
    if (idleSigningOut) return;
    idleSigningOut = true;
    // Tell the server so the refresh token dies now; if the access token has
    // already expired this simply fails and the server-side expiry covers it.
    try { await instance.post('/logout', null, { silent: true, skipAuthRedirect: true, timeout: 4000 }); } catch { /* ignore */ }
    hardLogout();
};

const idleCheck = () => {
    if (idleSigningOut || sessionDisplaced || loggingOut) return;
    if (isRemembered()) return;                           // "Keep this session open" -> never idle out
    if (!getStoredToken() && !hasSessionHint()) return;   // nobody is signed in on this tab
    if (Date.now() - lastActivityAt < IDLE_LIMIT_MS) return;
    idleSignOut();
};

setInterval(idleCheck, 30 * 1000);
// Browsers slow timers in background tabs: check right away when the person comes back.
document.addEventListener('visibilitychange', () => { if (!document.hidden) idleCheck(); });

instance.interceptors.response.use(
    (response) => {
        // Start downloading any photos in this reply right away, so they are
        // already loaded (or loading) by the time the page draws them.
        if (response.config?.responseType !== 'blob') {
            try { preloadFromApiData(response.data); } catch { /* never block a reply */ }
        }
        saveOfflineCopy(response.config, response.data); // fire and forget
        return response;
    },
    async (error) => {
        // A request the app cancelled on purpose (AbortController: a newer search
        // keystroke, a page that closed). Not a failure: no offline copy, no
        // toast, no session handling. Without this, the check below would treat
        // it as "server unreachable" and answer with an old saved copy.
        if (axios.isCancel(error)) {
            return Promise.reject(error);
        }

        const statusCode = error.response?.status || null;
        const originalRequest = error.config;

        // No connection at all (no reply from the server): show what was last
        // loaded for this same request instead of an empty/error screen.
        // (A host that is down/restarting often answers 502/503/504 instead of
        // refusing the connection: treat those the same way.)
        const serverUnreachable = !error.response || [502, 503, 504].includes(error.response.status);
        if (serverUnreachable && originalRequest) {
            const copy = await readOfflineCopy(originalRequest);
            if (copy !== null) {
                return {
                    data: copy, status: 200, statusText: 'OK (saved copy)', headers: {},
                    config: originalRequest, request: null, offlineCopy: true,
                };
            }
        }

        // Already signed out because of a login elsewhere — don't spam
        // toasts or redirects for requests still in flight.
        if (sessionDisplaced && statusCode === 401) {
            return Promise.reject(error);
        }

        // Explicit "displaced" answer on any endpoint.
        if (statusCode === 401 && error.response?.data?.code === 'session_displaced') {
            handleDisplaced(error.response.data.device);
            return Promise.reject(error);
        }

        // Silent refresh path — never on 403 (that's a real permissions
        // problem, not an expired token) and never for a request that's
        // already been retried once or is itself hitting an auth endpoint
        // (avoids an infinite loop if refresh itself starts 401ing).
        //
        // Deliberately runs even for `silent: true` requests (background
        // polls like the notification badge). `silent` means "don't pop a
        // toast for this one" — it never meant "don't ever recover from
        // this or log out when the session is actually dead." A silent
        // request that skipped this block entirely used to just 401
        // forever on every poll once the token went stale, with no way
        // to self-heal or ever redirect to login.
        const isAuthEndpoint = isAuthUrl(originalRequest?.url);

        if (statusCode === 401 && !originalRequest?.skipAuthRedirect && !originalRequest?._retried && !isAuthEndpoint) {
            // Cookie mode has no token in JS; the session hint says a cookie may exist.
            if (!getStoredRefreshToken() && !hasSessionHint()) {
                hardLogout();
                return Promise.reject(error);
            }

            originalRequest._retried = true;

            try {
                // Shared with every other caller: concurrent 401s (and a
                // proactive refresh already under way) all wait on ONE call.
                const newAccessToken = await refreshOnce();
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return instance(originalRequest);
            } catch (refreshError) {
                if (refreshError.response?.data?.code === 'session_displaced') {
                    handleDisplaced(refreshError.response.data.device);
                } else if (!refreshError.response || refreshError.response.status >= 500) {
                    // Server/network hiccup, not a dead session: don't sign
                    // the person out for it — the next poll simply retries.
                    return Promise.reject(error);
                } else {
                    hardLogout();
                }
                return Promise.reject(refreshError);
            }
        }

        if (statusCode === 401 && !originalRequest?.skipAuthRedirect) {
            hardLogout();
            return Promise.reject(error);
        }

        if (statusCode === 403 && error.response?.data?.code === 'approval_required') {
            // Staff account: not an error to shout about — offer to ask the admin.
            let payload = null;
            try {
                const raw = originalRequest?.data;
                if (typeof raw === 'string') payload = JSON.parse(raw);
                else if (typeof FormData !== 'undefined' && raw instanceof FormData) {
                    payload = {};
                    raw.forEach((v, k) => { if (typeof v === 'string') payload[k] = v; });
                }
            } catch { /* body wasn't JSON — the admin just won't get a preview */ }

            // Multipart edits are sent as POST with a spoofed _method=PUT/PATCH/DELETE;
            // the server routes on the spoofed verb, so the request must record that one.
            const spoofed = payload && typeof payload._method === 'string' ? payload._method.toUpperCase() : null;
            if (payload) delete payload._method;

            requestApproval({
                method: spoofed || (originalRequest?.method || 'post').toUpperCase(),
                path: 'api/' + String(originalRequest?.url || '').replace(/^\/+/, '').split('?')[0],
                payload,
            });
            error.approvalHandled = true;
            return Promise.reject(error);
        }

        // Everything below this line is toast-popup noise, not session
        // recovery — this is the one place `silent` is meant to apply.
        if (error.config?.silent) {
            return Promise.reject(error);
        }

        if (statusCode === 422) {
            const rawErrors = error.response?.data?.errors;
            const messages = rawErrors ? humanizeValidationErrors(rawErrors) : [error.response?.data?.message || 'Validation error.'];
            showToast({
                type: 'error',
                title: messages.length > 1 ? 'Please check the highlighted fields' : 'Something needs your attention',
                message: messages.join('\n'),
            });
            return Promise.reject(error);
        }

        if (statusCode === 403) {
            const message = error.response?.data?.message || "You don't have permission to do that.";
            showToast({ type: 'error', title: 'Access denied', message });
            return Promise.reject(error);
        }

        // A record that was deleted ("... was deleted on <date> by an Administrator")
        // or can't be found — the server already wrote a readable sentence.
        if (statusCode === 410 || statusCode === 404) {
            const data = error.response?.data || {};
            showToast({
                type: 'warning',
                title: data.code === 'record_deleted' ? 'This was deleted' : 'Not found',
                message: readableMessage(data.message) || 'We couldn’t find what you were looking for. It may have been removed.',
            });
            return Promise.reject(error);
        }

        if (statusCode === 429) {
            showToast({ type: 'warning', title: 'Slow down', message: 'Too many attempts. Please wait a moment and try again.' });
            return Promise.reject(error);
        }

        if (statusCode >= 500) {
            showToast({ type: 'error', title: 'Server error', message: 'Something went wrong on our end. Please try again shortly.' });
            return Promise.reject(error);
        }

        const errorMessage =
            error.code === 'ECONNABORTED'
                ? 'The request timed out. Please try again.'
                : !error.response
                ? 'Could not reach the server. Please check your internet connection.'
                : readableMessage(error.response?.data?.message) || 'An unexpected error occurred.';

        showToast({ type: 'error', title: 'Something went wrong', message: errorMessage });
        return Promise.reject(error);
    }
);

export default instance;
