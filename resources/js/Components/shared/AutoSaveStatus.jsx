import React, { useEffect, useState } from 'react';
import { Camera, Check, Loader2, Save } from '../icons';

/**
 * Status card above a report form: shows that Auto Save is on, when the draft
 * was last stored and whether it has reached the account yet. Renders nothing
 * while Auto Save is off, so the form looks exactly like it always did.
 *
 * Layout (see .ds-autosave in DashboardShell.css): an icon, the title + time,
 * a small state chip (Ready / Saving / Synced / Offline) and an optional
 * footnote. It wraps cleanly from 320px phones up to wide desktop screens.
 */
const useOnline = () => {
    const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
    }, []);
    return online;
};

const sentence = (text) => {
    if (!text) return '';
    const t = text.trim();
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    return /[.!?]$/.test(cap) ? cap : `${cap}.`;
};

export default function AutoSaveStatus({ autoSave, savedAt, synced, note }) {
    const online = useOnline();
    if (!autoSave) return null;

    const time = savedAt
        ? new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : null;

    let state = 'ready';
    let chip = 'Ready';
    let detail = 'Your draft is saved as you type.';
    if (time && !online) {
        state = 'offline'; chip = 'Offline';
        detail = `Saved on this device at ${time}. It will sync when you're back online.`;
    } else if (time && synced) {
        state = 'synced'; chip = 'Synced';
        detail = `Draft saved at ${time} and synced to your account.`;
    } else if (time) {
        state = 'saving'; chip = 'Syncing';
        detail = `Saved on this device at ${time}. Syncing to your account…`;
    }

    return (
        <div className={`ds-autosave is-${state}`} role="status" aria-live="polite">
            <div className="ds-autosave-main">
                <span className="ds-autosave-icon" aria-hidden="true"><Save size={16} /></span>
                <div className="ds-autosave-text">
                    <strong className="ds-autosave-title">Auto Save is on</strong>
                    <span className="ds-autosave-detail">{detail}</span>
                </div>
                <span className="ds-autosave-chip">
                    <span className={`ds-autosave-chip-icon ${state === 'saving' ? 'is-spinning' : ''}`} aria-hidden="true">
                        {state === 'saving' ? <Loader2 size={12} /> : state === 'synced' ? <Check size={12} /> : <span className="ds-autosave-dot" />}
                    </span>
                    {chip}
                </span>
            </div>
            {note && (
                <div className="ds-autosave-note">
                    <Camera size={13} aria-hidden="true" />
                    <span>{sentence(note)}</span>
                </div>
            )}
        </div>
    );
}
