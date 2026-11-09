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

// Seasonal scenes pause (CSS: animation-play-state) instead of resetting. The
// few that are driven from JS (Web Animations API, e.g. the Halloween skeleton
// runner) are paused / resumed here so they also stop and continue in place.
const SCENE = '.hw-scene, .xm-scene, .ny-scene';
const setSceneMotion = (on) => {
    if (typeof document === 'undefined' || typeof document.getAnimations !== 'function') return;
    try {
        document.getAnimations().forEach((a) => {
            const css = (typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation) ||
                (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition);
            if (css) return; // handled by CSS
            const el = a.effect && a.effect.target;
            if (!el || !el.closest || !el.closest(SCENE)) return;
            if (on) { if (a.playState === 'paused') a.play(); } else if (a.playState === 'running') a.pause();
        });
    } catch {
        // older browsers — scene simply keeps its CSS pause
    }
};

const apply = (on) => {
    if (typeof document === 'undefined') return;
    if (on) document.documentElement.removeAttribute('data-animations');
    else document.documentElement.setAttribute('data-animations', 'off');
    setSceneMotion(on);
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
