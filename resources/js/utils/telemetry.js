// Browser -> server crash reporting (POST /api/client-errors).
//
// Why not the axios instance? A failing axios layer reporting through axios
// could loop, and its interceptors toast, refresh tokens and redirect. This
// file uses sendBeacon / fetch directly, never throws, and never blocks.
//
// The server (App\Support\ClientTelemetry) is the authority on removing
// personal data. This side only keeps the payload small and cuts the noise.

const ENDPOINT = '/api/client-errors';
const MAX_REPORTS_PER_PAGE_LOAD = 5; // a render loop must not become a request loop
const MAX_PAYLOAD_CHARS = 12000; // the server refuses bodies over 16 KB

// Not bugs in our code: stale page files after a deploy / being offline (the
// error screen already explains these), browser quirks, and extension errors.
const NOISE = [
    /dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically|Failed to fetch/i,
    /ResizeObserver loop/i,
    /^Script error\.?$/i,
    /Non-Error promise rejection/i,
];
const EXTENSION_FILE = /^(chrome|moz|safari|safari-web)-extension:/i;

const sentFingerprints = new Set();
let sentCount = 0;

export function isNoise(message, filename = '') {
    return NOISE.some((re) => re.test(String(message || ''))) || EXTENSION_FILE.test(String(filename || ''));
}

/** Fire-and-forget POST. Returns true if the browser accepted it for sending. */
export function sendTelemetry(payload) {
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
        const body = JSON.stringify(payload);
        if (body.length > MAX_PAYLOAD_CHARS) return false;

        if (typeof navigator.sendBeacon === 'function'
            && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) {
            return true;
        }
        fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
            credentials: 'omit',
        }).catch(() => {});
        return true;
    } catch {
        return false; // reporting must never cause a second error
    }
}

/**
 * Report a crash. `type`: 'error' (window.onerror), 'rejection'
 * (unhandledrejection) or 'boundary' (React render error).
 */
export function reportClientError({ type = 'error', error, message, filename, componentStack } = {}) {
    try {
        const msg = String(message ?? error?.message ?? error ?? '');
        if (!msg || isNoise(msg, filename)) return;
        // Every failed API call is already handled (toast / retry / server log).
        if (error?.isAxiosError || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
        if (sentCount >= MAX_REPORTS_PER_PAGE_LOAD) return;

        const stack = String(error?.stack || '');
        const fingerprint = `${type}|${msg.slice(0, 120)}|${stack.split('\n')[1] || ''}`;
        if (sentFingerprints.has(fingerprint)) return;
        sentFingerprints.add(fingerprint);
        sentCount += 1;

        sendTelemetry({
            type,
            message: msg.slice(0, 300),
            stack: stack.slice(0, 3000),
            component_stack: componentStack ? String(componentStack).slice(0, 1200) : undefined,
            url: window.location.pathname, // path only: no query string or #fragment
        });
    } catch { /* never throw from the reporter */ }
}

let installed = false;

/** Call once, before React mounts, so crashes during startup are caught too. */
export function installGlobalErrorReporting() {
    if (installed || typeof window === 'undefined') return;
    installed = true;

    window.addEventListener('error', (event) => {
        // Resource-load failures (images, scripts) do not bubble here; only script errors do.
        reportClientError({ type: 'error', error: event.error, message: event.message, filename: event.filename });
    });
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        reportClientError({
            type: 'rejection',
            error: reason instanceof Error ? reason : undefined,
            message: reason instanceof Error ? reason.message : String(reason ?? ''),
        });
    });
}
