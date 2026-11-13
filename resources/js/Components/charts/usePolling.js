import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import api from '../../config/axiosConfig';

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
    // The request that is running right now, if any.
    const running = useRef(null);
    const paramsKey = JSON.stringify(params || {});

    // `force`: start a new request even if one is running, cancelling the old
    // one. Used when the url/params changed (the old answer is for something the
    // screen no longer shows) and by refresh(). Timer ticks pass false, so a slow
    // request is never piled up on.
    const load = useCallback(async (force = false) => {
        if (running.current && !force) return;
        running.current?.abort();
        const controller = new AbortController();
        running.current = controller;
        try {
            const res = await api.get(url, { params: JSON.parse(paramsKey), silent: true, signal: controller.signal });
            if (controller.signal.aborted) return;
            setData(res.data);
            setError(false);
            setUpdatedAt(new Date());
        } catch (e) {
            if (controller.signal.aborted || axios.isCancel(e)) return; // replaced or unmounted: say nothing
            setError(true);
        } finally {
            if (running.current === controller) {
                running.current = null;
                setLoading(false);
            }
        }
    }, [url, paramsKey]);

    useEffect(() => {
        load(true);
        let timer = setInterval(() => { if (!document.hidden) load(false); }, interval);
        const onVisible = () => { if (!document.hidden) load(false); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
            running.current?.abort(); // leaving the screen / changing url: drop the old request
            running.current = null;
        };
    }, [load, interval]);

    const refresh = useCallback(() => load(true), [load]);

    return { data, loading, error, updatedAt, refresh };
}
