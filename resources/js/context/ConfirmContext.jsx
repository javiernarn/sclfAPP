import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from '../Components/icons';
import '../Components/shared/ConfirmDialog.css';

const ConfirmContext = createContext(null);

/**
 * useConfirm() returns an async function: `await confirm({ ... })` resolves
 * true/false depending on which button the person pressed — a drop-in,
 * promise-based replacement for the blocking window.confirm().
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *       title: 'Discard changes?',
 *       message: "You have unsaved changes. If you leave now they'll be lost.",
 *       confirmLabel: 'Discard',
 *       cancelLabel: 'Continue editing',
 *       tone: 'danger',
 *   });
 *   if (ok) { ... }
 */
export function ConfirmProvider({ children }) {
    const [state, setState] = useState(null);
    const resolver = useRef(null);

    const confirm = useCallback((options = {}) => {
        return new Promise((resolve) => {
            resolver.current = resolve;
            setState({
                title: options.title || 'Are you sure?',
                message: options.message || 'This action cannot be undone.',
                confirmLabel: options.confirmLabel || 'Yes, continue',
                cancelLabel: options.cancelLabel || 'Cancel',
                tone: options.tone || 'default', // 'default' | 'danger' | 'discard'
            });
        });
    }, []);

    const close = (result) => {
        setState(null);
        if (resolver.current) {
            resolver.current(result);
            resolver.current = null;
        }
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state && (
                <div className="sclf-confirm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
                    <div className="sclf-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="sclf-confirm-title">
                        <div className={`sclf-confirm-icon sclf-confirm-icon-${state.tone}`}>
                            {state.tone === 'danger' ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
                        </div>
                        <h3 id="sclf-confirm-title" className="sclf-confirm-title">{state.title}</h3>
                        <p className="sclf-confirm-message">{state.message}</p>
                        <div className="sclf-confirm-actions">
                            <button type="button" className="sclf-confirm-btn sclf-confirm-btn-ghost" onClick={() => close(false)} autoFocus>
                                {state.cancelLabel}
                            </button>
                            <button
                                type="button"
                                className={`sclf-confirm-btn ${state.tone === 'danger' || state.tone === 'discard' ? 'sclf-confirm-btn-danger' : 'sclf-confirm-btn-primary'}`}
                                onClick={() => close(true)}
                            >
                                {state.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

export const useConfirm = () => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        // Graceful fallback if a component somehow renders outside the
        // provider — behaves like the native confirm() it replaces.
        return async (options) => window.confirm(typeof options === 'string' ? options : options?.message || 'Are you sure?');
    }
    return ctx;
};

// Convenience helper specifically for the "unsaved changes" pattern asked
// for across every form: Close/Cancel button → if the form is dirty, ask
// "Discard changes?" with Discard / Continue editing buttons; if it's not
// dirty, just proceed immediately without bothering the person.
export const useDiscardConfirm = () => {
    const confirm = useConfirm();
    return useCallback(async (isDirty, opts = {}) => {
        if (!isDirty) return true;
        return confirm({
            title: opts.title || 'Discard changes?',
            message: opts.message || "You have unsaved changes. If you leave now, they'll be lost.",
            confirmLabel: opts.confirmLabel || 'Discard changes',
            cancelLabel: opts.cancelLabel || 'Continue editing',
            tone: 'discard',
        });
    }, [confirm]);
};
