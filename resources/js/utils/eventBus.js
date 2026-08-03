// Minimal pub/sub. axiosConfig.js runs outside the React tree (it's a
// plain module, not a component), but we still want its errors to show up
// as the same styled toast every page uses instead of a native alert().
// ToastProvider subscribes to 'toast:show' once, near the root of the app.
function createBus() {
    const listeners = new Set();
    return {
        emit(payload) {
            listeners.forEach((fn) => {
                try {
                    fn(payload);
                } catch (e) {
                    // A broken listener should never break the caller.
                    console.error(e);
                }
            });
        },
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
}

export const toastBus = createBus();

export const showToast = (toast) => toastBus.emit(toast);
