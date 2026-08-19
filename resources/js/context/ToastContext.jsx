import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from '../Components/icons';
import { toastBus } from '../utils/eventBus';
import { useAppTheme } from '../hooks/useAppTheme';
import '../Components/shared/Toast.css';

const ToastContext = createContext(null);

const ICONS = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const DEFAULT_DURATION = {
    success: 4000,
    info: 4500,
    warning: 6000,
    error: 7000,
};

let uid = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef({});
    // Plain, colorless card — its only visual variant is light/dark, same
    // as every other surface in the app (dashboard shell, ledger auth
    // pages) — plus a per-type outline color (see Toast.css), so an
    // error toast and a success toast are otherwise styled identically.
    const { theme } = useAppTheme();
    const isDark = theme === 'black';

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        if (timers.current[id]) {
            clearTimeout(timers.current[id]);
            delete timers.current[id];
        }
    }, []);

    const show = useCallback((toast) => {
        const type = toast.type && ICONS[toast.type] ? toast.type : 'info';
        const id = toast.id || `toast-${++uid}`;
        const duration = toast.duration ?? DEFAULT_DURATION[type];

        setToasts((prev) => {
            // Same message already showing (e.g. duplicate network errors
            // firing off two requests at once) — don't stack duplicates.
            if (prev.some((t) => t.message === toast.message && t.type === type)) {
                return prev;
            }
            return [...prev, { id, type, title: toast.title, message: toast.message }];
        });

        if (duration && duration > 0) {
            timers.current[id] = setTimeout(() => dismiss(id), duration);
        }
        return id;
    }, [dismiss]);

    useEffect(() => toastBus.subscribe(show), [show]);

    useEffect(() => () => {
        Object.values(timers.current).forEach(clearTimeout);
    }, []);

    const api = {
        show,
        success: (message, opts) => show({ type: 'success', message, ...opts }),
        error: (message, opts) => show({ type: 'error', message, ...opts }),
        warning: (message, opts) => show({ type: 'warning', message, ...opts }),
        info: (message, opts) => show({ type: 'info', message, ...opts }),
        dismiss,
    };

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className={`sclf-toast-viewport ${isDark ? 'dark' : 'light'}`} role="region" aria-label="Notifications">
                {toasts.map((t) => {
                    const Icon = ICONS[t.type];
                    return (
                        <div key={t.id} className={`sclf-toast sclf-toast-${t.type}`} role="alert">
                            <span className="sclf-toast-icon"><Icon size={18} strokeWidth={2.25} /></span>
                            <div className="sclf-toast-body">
                                {t.title && <div className="sclf-toast-title">{t.title}</div>}
                                <div className="sclf-toast-message">{t.message}</div>
                            </div>
                            <button
                                type="button"
                                className="sclf-toast-close"
                                onClick={() => dismiss(t.id)}
                                aria-label="Dismiss notification"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        // Falls back to the event bus so a component that forgets the
        // provider (or code running very early) still degrades gracefully
        // instead of throwing.
        return {
            show: (t) => toastBus.emit(t),
            success: (message) => toastBus.emit({ type: 'success', message }),
            error: (message) => toastBus.emit({ type: 'error', message }),
            warning: (message) => toastBus.emit({ type: 'warning', message }),
            info: (message) => toastBus.emit({ type: 'info', message }),
            dismiss: () => {},
        };
    }
    return ctx;
};
