import { useCallback, useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';

/**
 * Real-time-ish data: fetches immediately, then every `interval` ms while the
 * tab is visible. Pauses when the tab is hidden and refreshes the moment it
 * becomes visible again. Errors never toast (silent) — the previous data stays
 * on screen and `error` flips so the UI can show "Reconnecting…".
 */
export default function usePolling(url, { interval = 15000, params } = {}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [updatedAt, setUpdatedAt] = useState(null);
    const inFlight = useRef(false);
    const paramsKey = JSON.stringify(params || {});

    const load = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        try {
            const res = await axios.get(url, { params: JSON.parse(paramsKey), silent: true });
            setData(res.data);
            setError(false);
            setUpdatedAt(new Date());
        } catch {
            setError(true);
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }, [url, paramsKey]);

    useEffect(() => {
        load();
        let timer = setInterval(() => { if (!document.hidden) load(); }, interval);
        const onVisible = () => { if (!document.hidden) load(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [load, interval]);

    return { data, loading, error, updatedAt, refresh: load };
}
