import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, HelpCircle, ShieldAlert, ShieldCheck, Camera, ChevronRight, ChevronDown, Printer } from '../Components/icons';
import '../Components/shared/ConfirmDialog.css';
import '../Components/shared/Popups.css';
import { useAppTheme } from '../hooks/useAppTheme';

const ConfirmContext = createContext(null);

// Icons a notice row can ask for by name (see `points` in the usage notes).
const NOTICE_ICONS = { shield: ShieldAlert, check: ShieldCheck, camera: Camera, alert: AlertTriangle };

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
 *
 * Short "read this first" notice (icon rows instead of a wall of text, a
 * visible countdown bar so people actually read it, and an optional link):
 *   const ok = await confirm({
 *       title: 'Before you continue',
 *       points: [{ icon: 'shield', tone: 'danger', lead: 'Violations block clearance', text: '...' }],
 *       details: 'Full policy text, folded away until "Read the full notice" is opened.',
 *       link: { href: '/app/print/abc', label: 'Check my violations', hint: 'Opens here — you come back to this notice' },
 *       delaySeconds: 8,
 *   });
 */
export function ConfirmProvider({ children }) {
    const [state, setState] = useState(null);
    const resolver = useRef(null);
    const { theme } = useAppTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [picked, setPicked] = useState('');
    const [typed, setTyped] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [secondsTotal, setSecondsTotal] = useState(0);
    const [showDetails, setShowDetails] = useState(false);

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
                // Optional compact notice: icon rows, a folded "full notice", and one link.
                points: Array.isArray(options.points) ? options.points : null,
                details: options.details || '',
                link: options.link?.href ? options.link : null,
            });
            setPicked('');
            setTyped('');
            setShowDetails(false);
            const delay = options.typeToConfirm?.phrase
                ? Math.max(0, options.delaySeconds ?? 5)
                : Math.max(0, options.delaySeconds ?? 0);
            setSecondsLeft(delay);
            setSecondsTotal(delay);
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

    // The notice's link (e.g. "Check my violations") opens in THIS tab, not a new one:
    // a new tab starts without the sign-in token and would bounce to "session expired".
    // We remember where the person was so the page they land on can bring them back
    // here and show this notice again.
    const openLink = (e) => {
        e.preventDefault();
        const href = state.link.href;
        const backTo = `${location.pathname}${location.search}`;
        close(false);
        navigate(href, { state: { backTo, reopenNotice: true } });
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state && (
                <div className="sclf-confirm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
                    <div className={`sclf-confirm-card sclf-popup${state.points ? ' sclf-confirm-card-notice' : ''}`} data-sclf-theme={theme} role="alertdialog" aria-modal="true" aria-labelledby="sclf-confirm-title">
                        <div className={`sclf-confirm-icon sclf-confirm-icon-${state.tone}`}>
                            {state.tone === 'danger' ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
                        </div>
                        <h3 id="sclf-confirm-title" className="sclf-confirm-title">{state.title}</h3>
                        {state.message && <p className="sclf-confirm-message">{state.message}</p>}
                        {state.points && (
                            <ul className="sclf-notice-list">
                                {state.points.map((pt, i) => {
                                    const Icon = NOTICE_ICONS[pt.icon] || ShieldCheck;
                                    return (
                                        <li key={i} className={`sclf-notice-row sclf-notice-${pt.tone || 'info'}`}>
                                            <span className="sclf-notice-ico"><Icon size={16} /></span>
                                            <span className="sclf-notice-copy">
                                                <strong>{pt.lead}</strong> {pt.text}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {state.link && (
                            <a className="sclf-notice-link" href={state.link.href} onClick={openLink}>
                                <Printer size={15} />
                                <span>
                                    {state.link.label}
                                    {state.link.hint && <small>{state.link.hint}</small>}
                                </span>
                                <ChevronRight size={14} />
                            </a>
                        )}
                        {state.details && (
                            <div className="sclf-notice-more">
                                <button type="button" className="sclf-notice-more-btn" aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)}>
                                    {showDetails ? 'Hide the full notice' : 'Read the full notice'}
                                    <ChevronDown size={14} className={showDetails ? 'is-open' : ''} />
                                </button>
                                {showDetails && <p>{state.details}</p>}
                            </div>
                        )}
                        {secondsTotal > 0 && (
                            <div className="sclf-confirm-timer" role="timer" aria-label="Reading time">
                                <div className="sclf-confirm-timer-track">
                                    <div
                                        className="sclf-confirm-timer-fill"
                                        style={{ width: `${Math.min(100, ((secondsTotal - secondsLeft) / secondsTotal) * 100)}%` }}
                                    />
                                </div>
                                <span>{secondsLeft > 0 ? `Please read first — you can continue in ${secondsLeft}s` : 'Thanks for reading — you can continue.'}</span>
                            </div>
                        )}
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
