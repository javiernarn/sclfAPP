import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { BASE_URL } from '../config/constant';
import { getStoredToken } from '../config/axiosConfig';

// One shared websocket connection to Laravel Reverb for the whole app.
//
// It is OPTIONAL: if VITE_REVERB_APP_KEY isn't set (or the socket can't connect)
// getEcho() returns null / the state stays "disconnected" and the pages fall
// back to their normal polling. Nothing here may ever throw into the UI.

window.Pusher = Pusher;

let echo = null;
let tried = false;
const stateListeners = new Set();
let state = 'disconnected'; // connecting | connected | disconnected | unavailable

const setState = (next) => {
    if (state === next) return;
    state = next;
    stateListeners.forEach((fn) => fn(state));
};

export const realtimeState = () => state;
export const onRealtimeState = (fn) => { stateListeners.add(fn); return () => stateListeners.delete(fn); };

export const isRealtimeConfigured = () => !!import.meta.env.VITE_REVERB_APP_KEY;

export const getEcho = () => {
    if (echo) return echo;
    if (tried) return null;
    tried = true;

    if (!isRealtimeConfigured()) { setState('unavailable'); return null; }

    try {
        const secure = (import.meta.env.VITE_REVERB_SCHEME || window.location.protocol.replace(':', '')) === 'https';
        echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
            wsPort: Number(import.meta.env.VITE_REVERB_PORT) || (secure ? 443 : 80),
            wssPort: Number(import.meta.env.VITE_REVERB_PORT) || 443,
            forceTLS: secure,
            enabledTransports: ['ws', 'wss'],
            // Private channels: the SPA uses Sanctum bearer tokens, not cookies. The token is read
            // fresh on every (re)subscribe so a refreshed access token is picked up automatically.
            channelAuthorization: {
                endpoint: `${BASE_URL}api/broadcasting/auth`,
                transport: 'ajax',
                headersProvider: () => {
                    const token = getStoredToken();
                    return { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
                },
            },
        });

        const conn = echo.connector?.pusher?.connection;
        if (conn) {
            setState(conn.state === 'connected' ? 'connected' : 'connecting');
            conn.bind('state_change', ({ current }) => {
                setState(current === 'connected' ? 'connected' : current === 'connecting' || current === 'initialized' ? 'connecting' : 'disconnected');
            });
        }
    } catch (e) {
        echo = null;
        setState('unavailable');
    }

    return echo;
};

/** Close the socket (call on sign-out so the next user doesn't inherit the old subscriptions). */
export const disconnectRealtime = () => {
    try { echo?.disconnect(); } catch { /* ignore */ }
    echo = null;
    tried = false;
    setState('disconnected');
};
