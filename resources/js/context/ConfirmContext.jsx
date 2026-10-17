import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from '../Components/icons';
import '../Components/shared/ConfirmDialog.css';
import '../Components/shared/Popups.css';
import { useAppTheme } from '../hooks/useAppTheme';

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
 *
 * Type-to-confirm (GitHub style) for permanent deletes:
 *   const ok = await confirm({
 *       title: 'Delete this incident report?',
 *       message: '...',
 *       confirmLabel: 'Delete report',
 *       tone: 'danger',
 *       typeToConfirm: { phrase: 'JJA' },   // person must type this (case-insensitive)
 *       delaySeconds: 5,                    // optional "think about it" countdown (default 5 when typeToConfirm is set)
 *   });
 * The red button stays disabled until the phrase matches AND the countdown ends.
 */
export function ConfirmProvider({ children }) {
    const [state, setState] = useState(null);
    const resolver = useRef(null);
    const { theme } = useAppTheme();
    const [picked, setPicked] = useState('');
    const [typed, setTyped] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(0);

    const confirm = useCallback((options = {}) => {
        return new Promise((resolve) => {
            resolver.current = resolve;
            setState({
                title: options.title || 'Are you sure?',
                message: options.message || 'This action cannot be undone.',
                confirmLabel: options.confirmLabel || 'Yes, continue',
                cancelLabel: options.cancelLabel || 'Cancel',
                tone: options.tone || 'default', // 'default' | 'danger' | 'discard'
                // Optional dropdown: { label, placeholder, required, options: [{ value, label }] }.
                // When present, confirm() resolves the chosen value (a non-empty string) instead of true.
                select: options.select || null,
                // Optional type-to-confirm: { phrase, label }. Delete stays locked until it's typed.
                typeToConfirm: options.typeToConfirm?.phrase ? options.typeToConfirm : null,
            });
            setPicked('');
            setTyped('');
            setSecondsLeft(
                options.typeToConfirm?.phrase
                    ? Math.max(0, options.delaySeconds ?? 5)
                    : Math.max(0, options.delaySeconds ?? 0)
            );
        });
    }, []);

    // "Think about it" countdown — ticks once a second while the dialog is open.
    useEffect(() => {
        if (!state || secondsLeft <= 0) return undefined;
        const t = setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
        return () => clearTimeout(t);
    }, [state, secondsLeft]);

    const phraseOk = !state?.typeToConfirm
        || typed.trim().toLowerCase() === String(state.typeToConfirm.phrase).trim().toLowerCase();
    const confirmLocked = (!!state?.select?.required && !picked) || !phraseOk || secondsLeft > 0;

    const close = (result) => {
        // With a dropdown, "yes" resolves the chosen value ('' = nothing chosen).
        if (result === true && state?.select) result = picked || true;
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
                    <div className="sclf-confirm-card sclf-popup" data-sclf-theme={theme} role="alertdialog" aria-modal="true" aria-labelledby="sclf-confirm-title">
                        <div className={`sclf-confirm-icon sclf-confirm-icon-${state.tone}`}>
                            {state.tone === 'danger' ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
                        </div>
                        <h3 id="sclf-confirm-title" className="sclf-confirm-title">{state.title}</h3>
                        <p className="sclf-confirm-message">{state.message}</p>
                        {state.select && (
                            <div className="sclf-confirm-field">
                                <label htmlFor="sclf-confirm-select">{state.select.label}</label>
                                <select id="sclf-confirm-select" value={picked} onChange={(e) => setPicked(e.target.value)}>
                                    <option value="">{state.select.placeholder || 'Choose one…'}</option>
                                    {state.select.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        )}
                        {state.typeToConfirm && (
                            <div className="sclf-confirm-field sclf-confirm-typed">
                                <label htmlFor="sclf-confirm-typed">
                                    {state.typeToConfirm.label || 'To confirm, type'}{' '}
                                    <code className="sclf-confirm-phrase">{state.typeToConfirm.phrase}</code>
                                </label>
                                <input
                                    id="sclf-confirm-typed"
                                    type="text"
                                    value={typed}
                                    onChange={(e) => setTyped(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !confirmLocked) close(true); if (e.key === 'Escape') close(false); }}
                                    autoComplete="off"
                                    autoCapitalize="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    autoFocus
                                    aria-invalid={typed.length > 0 && !phraseOk}
                                />
                            </div>
                        )}
                        <div className="sclf-confirm-actions">
                            <button type="button" className="sclf-confirm-btn sclf-confirm-btn-ghost" onClick={() => close(false)} autoFocus={!state.typeToConfirm}>
                                {state.cancelLabel}
                            </button>
                            <button
                                type="button"
                                className={`sclf-confirm-btn ${state.tone === 'danger' || state.tone === 'discard' ? 'sclf-confirm-btn-danger' : 'sclf-confirm-btn-primary'}`}
                                disabled={confirmLocked}
                                onClick={() => close(true)}
                            >
                                {state.confirmLabel}{secondsLeft > 0 ? ` (${secondsLeft})` : ''}
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
