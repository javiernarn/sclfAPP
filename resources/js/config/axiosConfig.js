import axios from 'axios';
import secureLocalStorage from 'react-secure-storage';
import { BASE_URL } from './constant';
import { showToast, requestApproval, notifySessionDisplaced } from '../utils/eventBus';
import { humanizeValidationErrors } from '../utils/validators';
import { disablePush } from '../utils/push';
import { clearRememberedCredentials } from '../hooks/useRememberedCredentials';

const SESSION_KEY = 'sclf_token_pair';
const LOCAL_KEY = 'token_pair';

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

export const clearStoredToken = () => {
    window.sessionStorage.removeItem(SESSION_KEY);
    secureLocalStorage.removeItem(LOCAL_KEY);
};

// pair: { access_token, refresh_token, expires_in }
export const storeTokenPair = (pair, remember = true) => {
    sessionDisplaced = false;
    clearStoredToken();
    if (remember) {
        secureLocalStorage.setItem(LOCAL_KEY, pair);
    } else {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(pair));
    }
};

// Kept for any other call sites expecting the old single-token helper
// name; now just updates the access token half of whichever pair is
// already stored, preserving "remember me" placement.
export const refreshAuthToken = (accessToken, remember = true) => {
    const existing = getStoredPair() || {};
    storeTokenPair({ ...existing, access_token: accessToken }, remember);
};

// Always read the current token fresh per-request (rather than setting
// instance.defaults.headers.common once) so a token swapped in mid-session
// by the refresh flow below applies immediately, including to requests
// that were queued waiting on that same refresh.
instance.interceptors.request.use((config) => {
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
const hardLogout = () => {
    if (sessionDisplaced) return;
    clearStoredToken();
    disablePush().catch(() => {});
    showToast({ type: 'warning', title: 'Session expired', message: 'Please sign in again to continue.' });
    window.location.href = `/login?type=session-expired`;
};

// Concurrent-request handling: while one 401 is triggering a refresh,
// every other request that also 401s queues its retry instead of each
// firing its own POST /token/refresh (which would race and, since refresh
// tokens are single-use/rotating, cause all but one of them to fail with
// a false reuse-detection trip).
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, accessToken = null) => {
    refreshQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(accessToken);
    });
    refreshQueue = [];
};

instance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const statusCode = error.response?.status || null;
        const originalRequest = error.config;

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
        const isAuthEndpoint = ['/login', '/token/refresh', '/2fa/login-verify'].some((p) =>
            originalRequest?.url?.includes(p)
        );

        if (statusCode === 401 && !originalRequest?.skipAuthRedirect && !originalRequest?._retried && !isAuthEndpoint) {
            const refreshToken = getStoredRefreshToken();
            if (!refreshToken) {
                hardLogout();
                return Promise.reject(error);
            }

            originalRequest._retried = true;

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    refreshQueue.push({ resolve, reject });
                }).then((newAccessToken) => {
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return instance(originalRequest);
                });
            }

            isRefreshing = true;

            try {
                const rememberDevice = secureLocalStorage.getItem(LOCAL_KEY) != null;
                const res = await instance.post(
                    '/token/refresh',
                    { refresh_token: refreshToken },
                    { silent: true }
                );
                storeTokenPair(res.data, rememberDevice);
                processQueue(null, res.data.access_token);
                originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
                return instance(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError);
                if (refreshError.response?.data?.code === 'session_displaced') {
                    handleDisplaced(refreshError.response.data.device);
                } else {
                    hardLogout();
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
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
                : error.response?.data?.message || 'An unexpected error occurred.';

        showToast({ type: 'error', title: 'Something went wrong', message: errorMessage });
        return Promise.reject(error);
    }
);

export default instance;
