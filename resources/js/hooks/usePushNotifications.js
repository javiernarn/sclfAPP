import { useCallback, useEffect, useSyncExternalStore } from 'react';
import axios from '../config/axiosConfig';
import {
    disablePush,
    enablePush,
    getCurrentSubscription,
    isPushSupported,
} from '../utils/push';

/**
 * Drives the "Push notifications" toggle wherever it's rendered (the avatar
 * menus in the header and sidebar). Figures out the current on/off state by
 * asking the browser directly (see getCurrentSubscription) rather than
 * trusting anything cached, since permission can be revoked from outside the
 * app (browser site settings) without SCLF ever finding out.
 *
 * The avatar menu only exists while it is open, so this hook is re-mounted
 * every time the menu opens. The last known state therefore lives in a small
 * module-level store: each re-mount starts from what we already knew (instead
 * of flashing "off" until the checks finish) and then quietly re-verifies it.
 * The browser subscription and the server's /push/status are also checked
 * independently, so a slow or failed status request can no longer leave an
 * already-enabled toggle showing "off".
 */
let store = { subscribed: null, vapidPublicKey: null, busy: false }; // null = not checked yet
const listeners = new Set();
const setStore = (patch) => {
    store = { ...store, ...patch };
    listeners.forEach((fn) => fn());
};
const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
const getSnapshot = () => store;

export default function usePushNotifications() {
    const supported = isPushSupported();
    const { subscribed, vapidPublicKey, busy } = useSyncExternalStore(subscribe, getSnapshot);

    useEffect(() => {
        if (!supported) return undefined;
        let alive = true;

        // 1) What the browser says — the source of truth for on/off.
        getCurrentSubscription()
            .then((sub) => { if (alive) setStore({ subscribed: !!sub }); })
            .catch(() => { if (alive && store.subscribed === null) setStore({ subscribed: false }); });

        // 2) The server's public key, needed only to turn push ON. Kept
        //    separate so a failure here never changes the on/off display.
        if (!store.vapidPublicKey) {
            axios.get('/push/status', { silent: true })
                .then(({ data }) => { if (alive) setStore({ vapidPublicKey: data.vapid_public_key }); })
                .catch(() => { /* toggle will report "unconfigured" if used */ });
        }

        return () => { alive = false; };
    }, [supported]);

    const enable = useCallback(async () => {
        let key = store.vapidPublicKey;
        if (!key) {
            try {
                const { data } = await axios.get('/push/status', { silent: true });
                key = data.vapid_public_key;
                setStore({ vapidPublicKey: key });
            } catch { /* handled below */ }
        }
        if (!key) return { status: 'unconfigured' };
        setStore({ busy: true });
        try {
            const result = await enablePush(key, (subscriptionJson) =>
                axios.post('/push/subscribe', subscriptionJson)
            );
            if (result.status === 'subscribed') setStore({ subscribed: true });
            return result;
        } finally {
            setStore({ busy: false });
        }
    }, []);

    const disable = useCallback(async () => {
        setStore({ busy: true });
        try {
            await disablePush((endpoint) => axios.post('/push/unsubscribe', { endpoint }));
            setStore({ subscribed: false });
        } finally {
            setStore({ busy: false });
        }
    }, []);

    return {
        supported,
        loading: supported && subscribed === null, // only before the very first check
        busy,
        subscribed: subscribed === true,
        enable,
        disable,
    };
}
