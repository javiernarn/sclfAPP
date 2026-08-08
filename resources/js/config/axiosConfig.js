import axios from 'axios';
import secureLocalStorage from 'react-secure-storage';
import { BASE_URL } from './constant';
import { showToast } from '../utils/eventBus';
import { humanizeValidationErrors } from '../utils/validators';
import { disablePush } from '../utils/push';

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

const hardLogout = () => {
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

        if (error.config?.silent) {
            return Promise.reject(error);
        }

        // Silent refresh path — never on 403 (that's a real permissions
        // problem, not an expired token) and never for a request that's
        // already been retried once or is itself hitting an auth endpoint
        // (avoids an infinite loop if refresh itself starts 401ing).
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
                hardLogout();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        if (statusCode === 401 && !originalRequest?.skipAuthRedirect) {
            hardLogout();
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
