import { useEffect, useRef, useState } from 'react';
import { getEcho, onRealtimeState, realtimeState } from '../utils/realtime';

/**
 * Listen to one event on one private channel.
 *
 *   const { connected } = useRealtimeEvent('lost-found.handlers', 'match.updated', (e) => reload());
 *
 * `connected` is true while the websocket is up. Pages use it to slow their
 * polling right down (the socket does the real-time work) and speed it back up
 * if the socket drops — so the data stays fresh either way.
 *
 * Bursts are coalesced: several events within `debounceMs` call the handler once.
 */
export default function useRealtimeEvent(channel, event, handler, { debounceMs = 350 } = {}) {
    const [connected, setConnected] = useState(realtimeState() === 'connected');
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        if (!channel) return undefined;
        const echo = getEcho();
        setConnected(realtimeState() === 'connected');
        const off = onRealtimeState((s) => setConnected(s === 'connected'));
        if (!echo) return off;

        let timer = null;
        let last = null;
        try {
            echo.private(channel).listen(`.${event}`, (payload) => {
                last = payload;
                clearTimeout(timer);
                timer = setTimeout(() => handlerRef.current?.(last), debounceMs);
            });
        } catch { /* a failed subscribe just means we keep polling */ }

        return () => {
            clearTimeout(timer);
            off();
            try { echo.leave(channel); } catch { /* ignore */ }
        };
    }, [channel, event, debounceMs]);

    return { connected };
}
