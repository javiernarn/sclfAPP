import { useCallback, useEffect, useState } from 'react';

/**
 * Animations on/off — one switch for the whole app.
 *
 * Stored per device (localStorage), not on the account, so it also works on
 * the login and register pages where nobody is signed in yet. Default is ON.
 *
 * When OFF, <html data-animations="off"> is set and crossPlatform.css stops
 * every CSS animation / transition. Canvas / JS animations (chart count-up,
 * QR build-up, seasonal characters) read animationsOn() themselves.
 */
const KEY = 'sclf-animations';
const EVENT = 'sclf-animations-change';

export const animationsOn = () => {
    try {
        return localStorage.getItem(KEY) !== 'off';
    } catch {
        return true;
    }
};

const apply = (on) => {
    if (typeof document === 'undefined') return;
    if (on) document.documentElement.removeAttribute('data-animations');
    else document.documentElement.setAttribute('data-animations', 'off');
};

export const setAnimationsOn = (on) => {
    try {
        if (on) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, 'off');
    } catch {
        // storage blocked — the switch still works until the page reloads
    }
    apply(on);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
};

// Runs once, before React mounts, so the first paint already respects it.
apply(animationsOn());

export function useAnimationsPref() {
    const [on, setOn] = useState(() => animationsOn());

    useEffect(() => {
        const sync = () => setOn(animationsOn());
        const onStorage = (e) => {
            if (e.key === KEY || e.key === null) {
                apply(animationsOn());
                sync();
            }
        };
        window.addEventListener(EVENT, sync);
        window.addEventListener('storage', onStorage); // other tabs
        return () => {
            window.removeEventListener(EVENT, sync);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    const toggle = useCallback(() => setAnimationsOn(!animationsOn()), []);
    return { animations: on, setAnimations: setAnimationsOn, toggleAnimations: toggle };
}
