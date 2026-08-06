import axios from 'axios';
import secureLocalStorage from 'react-secure-storage';
import { BASE_URL } from './constant';
import { showToast } from '../utils/eventBus';
import { humanizeValidationErrors } from '../utils/validators';
import { disablePush } from '../utils/push';

const SESSION_KEY = 'sclf_access_token';

const instance = axios.create({
    baseURL: BASE_URL + 'api/',
    timeout: 15000,
});

instance.interceptors.response.use(
    (response) => response,
    (error) => {
        const statusCode = error.response?.status || null;

        if (error.config?.silent) {
            return Promise.reject(error);
        }

        if (statusCode === 401 && !error.config?.skipAuthRedirect) {
            clearStoredToken();
            // Browser-side only (no server call — the token that would
            // authenticate a /push/unsubscribe request is exactly what
            // just got rejected). Covers a session that simply expires
            // on a shared device without anyone explicitly logging out;
            // the leftover server-side row still self-heals via
            // WebPushChannel's 404/410 pruning, or gets reconciled the
            // moment someone next logs in on this browser.
            disablePush().catch(() => {});
            showToast({ type: 'warning', title: 'Session expired', message: 'Please sign in again to continue.' });
            window.location.href = `/login?type=session-expired`;
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

// "Keep me signed in" checked -> token persists in secureLocalStorage
// (survives closing the browser). Left unchecked -> token only lives in
// this tab's sessionStorage, so it's gone once the tab/browser closes.
export const getStoredToken = () => {
    const sessionToken = window.sessionStorage.getItem(SESSION_KEY);
    if (sessionToken) return sessionToken;
    return secureLocalStorage.getItem('access_token') || null;
};

export const clearStoredToken = () => {
    window.sessionStorage.removeItem(SESSION_KEY);
    secureLocalStorage.removeItem('access_token');
};

const updateAuthToken = () => {
    const token = getStoredToken();
    if (token) {
        instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete instance.defaults.headers.common['Authorization'];
    }
};

updateAuthToken();

export const refreshAuthToken = (newToken, remember = true) => {
    clearStoredToken();
    if (remember) {
        secureLocalStorage.setItem('access_token', newToken);
    } else {
        window.sessionStorage.setItem(SESSION_KEY, newToken);
    }
    updateAuthToken();
};

export default instance;