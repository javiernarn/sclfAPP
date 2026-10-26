// Phones / tablets: no pinch-zoom and no double-tap zoom, so the app keeps its
// native, fixed-scale feel. The viewport meta tag (maximum-scale=1,
// user-scalable=no) covers Android Chrome, but iOS Safari / the iOS installed
// app ignore it for pinch gestures, so block those here as well.
//
// Desktop browser zoom (Ctrl +/-) is not touched — usePreventInspect handles it.
// Custom pinch handling that uses pointer events (e.g. the image viewer) keeps
// working: it never relied on the browser's own zoom.

if (typeof document !== 'undefined') {
    const stop = (e) => e.preventDefault();

    // iOS Safari pinch gestures.
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
        document.addEventListener(type, stop, { passive: false });
    });

    // Chrome / Android / iPadOS: a two-finger touchmove is a pinch.
    document.addEventListener(
        'touchmove',
        (e) => {
            if (e.touches && e.touches.length > 1) e.preventDefault();
        },
        { passive: false }
    );

    // Double-tap zoom on iOS: two quick touchends on the same screen.
    let lastTouchEnd = 0;
    document.addEventListener(
        'touchend',
        (e) => {
            const now = Date.now();
            const t = e.target;
            // Let real text fields keep normal double-tap (select a word).
            const isField = t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
            if (!isField && now - lastTouchEnd <= 300) e.preventDefault();
            lastTouchEnd = now;
        },
        { passive: false }
    );
}
