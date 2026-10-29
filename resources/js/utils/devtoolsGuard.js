// ============================================================
// devtoolsGuard.js
// SCLF - hide the whole app while browser DevTools is open.
//
// Imported FIRST in main.jsx, so it runs before React mounts.
// That means it also works when DevTools was already open on
// another site and the person then typed our URL: the very first
// check happens at load, before any UI is shown, and it keeps
// checking every second after that.
//
// While DevTools is open the page is plain white and shows the
// same text as the <noscript> fallback. Close DevTools and the
// app comes back (no reload needed).
//
// Switch with VITE_ENABLE_INSPECT_PROTECTION in .env (true|false).
// Desktop only. This is a deterrent: it cannot stop a proxy or
// direct API calls - real security stays on the server.
// ============================================================

const ENABLED =
    String(import.meta.env?.VITE_ENABLE_INSPECT_PROTECTION ?? 'true')
        .trim()
        .toLowerCase() !== 'false';

const DESKTOP_MIN_WIDTH = 992;

const COVER_HTML =
    '<h1>SCLF - Opol Community College</h1>' +
    '<p>Smart Campus Lost &amp; Found system for Opol Community College.</p>' +
    '<p>What a boring  inspect developer HAHAHHAHAHAHA</p>' +
    '<p>JavaScript is required to use SCLF. Please enable JavaScript in your ' +
    'browser, then reload this page.</p>';

function startGuard() {
    if (!ENABLED || typeof window === 'undefined') return;
    // Desktop check uses the SCREEN size, not the page size: with DevTools
    // already open the page area can be narrower than 992px, which would
    // wrongly skip the guard exactly when it is needed.
    const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (isTouch || Math.max(window.screen.width, window.screen.height) < DESKTOP_MIN_WIDTH) return;

    const baseDPR = window.devicePixelRatio || 1;
    let cover = null;
    let hider = null;

    const show = () => {
        // (Re)create both pieces every time, so deleting them from the
        // Elements panel does nothing - the next check puts them back.
        if (!hider || !hider.isConnected) {
            hider = document.createElement('style');
            hider.textContent = '#app{display:none !important}';
            document.head.appendChild(hider);
        }
        if (!cover || !cover.isConnected) {
            cover = document.createElement('div');
            cover.style.cssText =
                'position:fixed;inset:0;z-index:2147483647;background:#fff;' +
                'color:#111;font-family:Arial,Helvetica,sans-serif;padding:24px;';
            cover.innerHTML = COVER_HTML;
            document.body.appendChild(cover);
        }
    };

    const hide = () => {
        if (cover) { cover.remove(); cover = null; }
        if (hider) { hider.remove(); hider = null; }
    };

    // 1) Docked DevTools: outer window gets bigger than the page area.
    //    Normalised by zoom so browser zoom alone does not trigger it.
    const dockedOpen = () => {
        const zoom = (window.devicePixelRatio || 1) / baseDPR;
        return (
            window.outerWidth - window.innerWidth * zoom > 160 ||
            window.outerHeight - window.innerHeight * zoom > 160
        );
    };

    // 2) Console open (docked or separate window): the id getter only
    //    runs when DevTools actually renders the logged element.
    let consoleHit = false;
    const probe = new Image();
    Object.defineProperty(probe, 'id', {
        get() { consoleHit = true; return ''; },
    });
    const consoleOpen = () => {
        consoleHit = false;
        // eslint-disable-next-line no-console
        console.log(probe); // must be .log: .debug is hidden by default in DevTools
        return consoleHit;
    };

    // 3) A `debugger` statement only pauses while DevTools is open, so
    //    the time it takes reveals DevTools - even when it was opened on
    //    another site first and kept open.
    const debuggerOpen = () => {
        const t = performance.now();
        // eslint-disable-next-line no-new-func
        new Function('debugger')();
        return performance.now() - t > 100;
    };

    const check = () => {
        if (dockedOpen() || consoleOpen() || debuggerOpen()) show();
        else hide();
    };

    check(); // before React mounts, so nothing is ever shown
    window.setInterval(check, 1000);
    window.addEventListener('resize', check);
}

startGuard();
