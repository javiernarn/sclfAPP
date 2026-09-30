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


// Fired by axiosConfig.js when the server answers 403 { code: 'approval_required' }
// — i.e. a staff account tried a write the admin hasn't approved yet.
// ApprovalRequestModal listens and offers to send the admin a request.
export const approvalBus = createBus();
export const requestApproval = (info) => approvalBus.emit(info);
