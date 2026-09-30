import { useEffect } from 'react';

// Touch screens have no "mouse leave", so a tooltip opened by a tap would
// otherwise stay forever (or vanish the instant the finger lifts). This
// closes it when the user taps/clicks anywhere outside the chart wrapper.
export default function useDismiss(ref, active, onDismiss) {
    useEffect(() => {
        if (!active) return undefined;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onDismiss();
        };
        document.addEventListener('pointerdown', handler, true);
        return () => document.removeEventListener('pointerdown', handler, true);
    }, [ref, active, onDismiss]);
}

// Mouse/pen leave should hide the tooltip; touch "leave" (fired when the
// finger lifts) must NOT, so the value stays readable after a tap.
export const isTouch = (e) => e.pointerType === 'touch';
