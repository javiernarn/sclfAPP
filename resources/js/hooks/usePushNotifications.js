import { useCallback, useEffect, useState } from 'react';
import axios from '../config/axiosConfig';
import {
    disablePush,
    enablePush,
    getCurrentSubscription,
    isPushSupported,
} from '../utils/push';

/**
 * Drives the "Push notifications" toggle wherever it's rendered
 * (ProfilePage). Figures out the current on/off state by asking the
 * browser directly (see getCurrentSubscription) rather than trusting
 * anything cached, since permission can be revoked from outside the app
 * (browser site settings) without SCLF ever finding out.
 */
export default function usePushNotifications() {
    const supported = isPushSupported();
    const [loading, setLoading] = useState(true);
    const [subscribed, setSubscribed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [vapidPublicKey, setVapidPublicKey] = useState(null);

    useEffect(() => {
        if (!supported) {
            setLoading(false);
            return;
        }

        (async () => {
            try {
                const [{ data }, sub] = await Promise.all([
                    axios.get('/push/status', { silent: true }),
                    getCurrentSubscription(),
                ]);
                setVapidPublicKey(data.vapid_public_key);
                setSubscribed(!!sub);
            } catch {
                // Silently leave "off" — the toggle will just offer to
                // turn notifications on, which re-checks everything.
            } finally {
                setLoading(false);
            }
        })();
    }, [supported]);

    const enable = useCallback(async () => {
        if (!vapidPublicKey) return { status: 'unconfigured' };
        setBusy(true);
        try {
            const result = await enablePush(vapidPublicKey, (subscriptionJson) =>
                axios.post('/push/subscribe', subscriptionJson)
            );
            if (result.status === 'subscribed') setSubscribed(true);
            return result;
        } finally {
            setBusy(false);
        }
    }, [vapidPublicKey]);

    const disable = useCallback(async () => {
        setBusy(true);
        try {
            await disablePush((endpoint) => axios.post('/push/unsubscribe', { endpoint }));
            setSubscribed(false);
        } finally {
            setBusy(false);
        }
    }, []);

    return { supported, loading, busy, subscribed, enable, disable };
}
