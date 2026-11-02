// touchFocusGuard.js
// iPhone / iPad (Safari and the installed PWA) only open the keyboard when a
// text field is focused as a direct result of a tap. A field focused by code
// on page load (React's autoFocus) gets a caret but NO keyboard, and tapping it
// again does not open the keyboard either — the field looks "dead".
//
// On touch devices we therefore ignore .focus() calls on text fields unless
// the person touched / clicked / typed within the last second. Taps that open
// a form or a search box still focus normally; page-load autoFocus is skipped,
// so the first real tap on the field opens the keyboard. Desktop is untouched.

if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    let lastGesture = 0;
    const mark = () => { lastGesture = Date.now(); };
    ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click', 'keydown'].forEach((type) => {
        window.addEventListener(type, mark, { capture: true, passive: true });
    });

    const originalFocus = HTMLElement.prototype.focus;
    const isTextField = (el) =>
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLInputElement &&
            !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image'].includes(el.type));

    HTMLElement.prototype.focus = function focus(...args) {
        if (isTextField(this) && Date.now() - lastGesture > 1000) return;
        return originalFocus.apply(this, args);
    };
}
