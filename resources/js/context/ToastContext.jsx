import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X, RotateCcw } from '../Components/icons';
import { toastBus, approvalBus } from '../utils/eventBus';
import { useAppTheme, isDarkTheme } from '../hooks/useAppTheme';
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

export const UNDO_SECONDS = 15;

// Live "12s" countdown for an undo toast. Computed from the start time (not by
// counting ticks) so it stays right even if the tab was in the background.
function UndoRing({ startedAt, seconds }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const i = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(i);
    }, []);
    const left = Math.max(0, Math.ceil((startedAt + seconds * 1000 - now) / 1000));
    return (
        <span className="sclf-undo-ring" style={{ '--undo-s': `${seconds}s` }} aria-hidden="true">
            <svg viewBox="0 0 36 36" width="38" height="38">
                <circle className="sclf-undo-ring-track" cx="18" cy="18" r="15.5" />
                <circle className="sclf-undo-ring-fill" cx="18" cy="18" r="15.5" pathLength="100" />
            </svg>
            <span className="sclf-undo-ring-num">{left}</span>
        </span>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef({});
    // When a staff write is blocked, the approval dialog opens. Pages usually also
    // toast "could not do X" in their catch — suppress that for a moment so the
    // staff member sees one clear prompt instead of two messages.
    const lastApprovalAt = useRef(0);
    useEffect(() => approvalBus.subscribe(() => { lastApprovalAt.current = Date.now(); }), []);
    // Plain, colorless card — its only visual variant is light/dark, same
    // as every other surface in the app (dashboard shell, ledger auth
    // pages) — plus a per-type outline color (see Toast.css), so an
    // error toast and a success toast are otherwise styled identically.
    const { theme } = useAppTheme();
    const isDark = isDarkTheme(theme);

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        if (timers.current[id]) {
            clearTimeout(timers.current[id]);
            delete timers.current[id];
        }
    }, []);

    const show = useCallback((toast) => {
        const type = toast.type && ICONS[toast.type] ? toast.type : 'info';
        if (type === 'error' && Date.now() - lastApprovalAt.current < 2500) return null;
        const id = toast.id || `toast-${++uid}`;
        const duration = toast.duration ?? DEFAULT_DURATION[type];

        const undo = toast.undo
            ? { ...toast.undo, seconds: toast.undo.seconds || UNDO_SECONDS, startedAt: Date.now() }
            : null;

        setToasts((prev) => {
            if (undo) return [...prev, { id, type, title: toast.title, message: toast.message, undo }];
            // Same message already showing (e.g. duplicate network errors
            // firing off two requests at once) — don't stack duplicates.
            if (prev.some((t) => t.message === toast.message && t.type === type)) {
                return prev;
            }
            return [...prev, { id, type, title: toast.title, message: toast.message }];
        });

        if (undo) {
            // The countdown ran out — the action is final, so tell the caller.
            timers.current[id] = setTimeout(() => {
                dismiss(id);
                undo.onExpire?.();
            }, undo.seconds * 1000);
        } else if (duration && duration > 0) {
            timers.current[id] = setTimeout(() => dismiss(id), duration);
        }
        return id;
    }, [dismiss]);

    useEffect(() => toastBus.subscribe(show), [show]);

    useEffect(() => () => {
        Object.values(timers.current).forEach(clearTimeout);
    }, []);

    // "Undo" press: the caller may answer false to keep the toast (and its
    // countdown) running, e.g. when the person declines a "replace what you typed?" prompt.
    const runUndo = useCallback(async (t) => {
        const result = await t.undo.onUndo?.();
        if (result === false) return;
        dismiss(t.id);
    }, [dismiss]);

    // Closing an undo toast with ✕ means "keep it" — finish the action now.
    const closeUndo = useCallback((t) => {
        dismiss(t.id);
        t.undo.onExpire?.();
    }, [dismiss]);

    const api = {
        show,
        // Toast with a 15-second countdown and an Undo button. `onExpire` runs when the
        // time is up (or the toast is closed / the page is left), `onUndo` when Undo is pressed.
        undo: ({ seconds = UNDO_SECONDS, onUndo, onExpire, undoLabel = 'Undo', type = 'success', ...rest }) =>
            show({ type, ...rest, undo: { seconds, onUndo, onExpire, undoLabel } }),
        success: (message, opts) => show({ type: 'success', message, ...opts }),
        error: (message, opts) => show({ type: 'error', message, ...opts }),
        warning: (message, opts) => show({ type: 'warning', message, ...opts }),
        info: (message, opts) => show({ type: 'info', message, ...opts }),
        dismiss,
    };

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className={`sclf-toast-viewport ${isDark ? 'dark' : 'light'}`} data-sclf-theme={theme} role="region" aria-label="Notifications">
                {toasts.map((t) => {
                    const Icon = ICONS[t.type];
                    if (t.undo) {
                        return (
                            <div key={t.id} className={`sclf-toast sclf-toast-undo sclf-toast-${t.type}`} role="status" aria-live="polite" style={{ '--undo-s': `${t.undo.seconds}s` }}>
                                <UndoRing startedAt={t.undo.startedAt} seconds={t.undo.seconds} />
                                <div className="sclf-toast-body">
                                    {t.title && <div className="sclf-toast-title">{t.title}</div>}
                                    <div className="sclf-toast-message">{t.message}</div>
                                </div>
                                <button type="button" className="sclf-undo-btn" onClick={() => runUndo(t)}>
                                    <RotateCcw size={14} /> {t.undo.undoLabel}
                                </button>
                                <button type="button" className="sclf-toast-close" onClick={() => closeUndo(t)} aria-label="Dismiss and keep">
                                    <X size={14} />
                                </button>
                                <span className="sclf-undo-bar" aria-hidden="true" />
                            </div>
                        );
                    }
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
            undo: ({ onExpire, ...t }) => { toastBus.emit({ type: 'success', ...t }); onExpire?.(); },
            success: (message) => toastBus.emit({ type: 'success', message }),
            error: (message) => toastBus.emit({ type: 'error', message }),
            warning: (message) => toastBus.emit({ type: 'warning', message }),
            info: (message) => toastBus.emit({ type: 'info', message }),
            dismiss: () => {},
        };
    }
    return ctx;
};
