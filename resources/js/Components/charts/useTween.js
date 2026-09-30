import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Smoothly animates an array of numbers toward `target`.
 * First render eases up from zero (the "grow in" effect); every later change
 * (e.g. a live poll returning new data) eases from wherever the values
 * currently are, so charts morph instead of jumping.
 */
export function useTween(target, duration = 800) {
    const key = target.join(',');
    const [values, setValues] = useState(() => target.map(() => 0));
    const current = useRef(values);
    const raf = useRef(0);

    useEffect(() => {
        if (prefersReducedMotion()) {
            current.current = target;
            setValues(target);
            return undefined;
        }
        const from = target.map((_, i) => current.current[i] ?? 0);
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const e = easeOutCubic(t);
            const next = target.map((v, i) => from[i] + (v - from[i]) * e);
            current.current = next;
            setValues(next);
            if (t < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, duration]);

    // While target length changed but the effect hasn't run yet, avoid NaN.
    return values.length === target.length ? values : target.map((_, i) => values[i] ?? 0);
}
