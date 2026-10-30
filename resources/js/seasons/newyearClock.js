import { useSyncExternalStore } from 'react';

/**
 * newyearClock — ONE real-time clock shared by every New Year widget
 * (analog clock, countdown sign, ball-drop tower, midnight finale).
 *
 * It uses the viewer's real local time, ticks once a second, and only runs
 * while something is subscribed. Nothing here is a fake animation: the hands
 * show the actual time, the sign counts down to the next 1 January 00:00:00,
 * and during the final 60 seconds of 31 December the ball really drops.
 *
 * Preview any moment without waiting for December:
 *     ?nydate=2026-12-31T23:59:20      (ball drop + midnight finale)
 *     ?nydate=2027-01-01T00:10:00      (Happy New Year mode)
 */

const offset = (() => {
    try {
        const q = new URLSearchParams(window.location.search).get('nydate');
        if (!q) return 0;
        const t = new Date(q).getTime();
        return Number.isNaN(t) ? 0 : t - Date.now();
    } catch (e) {
        return 0;
    }
})();

const compute = () => {
    const now = new Date(Date.now() + offset);
    const y = now.getFullYear();
    const celebrating = now.getMonth() === 0 && now.getDate() === 1; // all of 1 January
    const year = celebrating ? y : y + 1;
    const total = celebrating ? 0 : Math.max(0, Math.floor((new Date(year, 0, 1) - now) / 1000));
    const epochSec = Math.floor(now.getTime() / 1000);
    return {
        year,
        celebrating,
        total,
        d: Math.floor(total / 86400),
        h: Math.floor((total % 86400) / 3600),
        m: Math.floor((total % 3600) / 60),
        s: total % 60,
        // 0 -> ball at the top of the pole, 1 -> ball has landed (last 60 s of 31 Dec)
        dropP: celebrating ? 1 : total <= 60 ? (60 - total) / 60 : 0,
        // seconds since local midnight-aligned epoch: drives the clock hands without wrap-around jumps
        localSec: epochSec - now.getTimezoneOffset() * 60,
    };
};

let snap = compute();
const subs = new Set();
let timer = null;

const tick = () => {
    snap = compute();
    subs.forEach((fn) => fn());
};

const subscribe = (fn) => {
    subs.add(fn);
    if (!timer) {
        snap = compute();
        timer = setInterval(tick, 1000);
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', tick);
    }
    return () => {
        subs.delete(fn);
        if (!subs.size && timer) {
            clearInterval(timer);
            timer = null;
            if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', tick);
        }
    };
};

export default function useNewYearClock() {
    return useSyncExternalStore(subscribe, () => snap, () => snap);
}
