import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sessionBus } from '../../utils/eventBus';
import { useAppTheme } from '../../hooks/useAppTheme';
import './DeviceSignedOutModal.css';

// How long the alert stays up so the person can actually read it.
const SECONDS = 12;
const TICK_MS = 100;

/**
 * iOS-style alert shown on the OLD device when the same account signs in
 * somewhere else (single-device login). The server already ended this
 * session; this just explains why, then returns to the login screen —
 * automatically after 12 seconds, or sooner when the person taps OK.
 *
 * The countdown only advances while the tab is visible, so someone who
 * switches away and comes back still gets the full time to read it.
 */
export default function DeviceSignedOutModal() {
    const { theme } = useAppTheme();
    const [info, setInfo] = useState(null); // { device } | null
    const [elapsed, setElapsed] = useState(0);
    const leaving = useRef(false);
    const okRef = useRef(null);

    useEffect(() => sessionBus.subscribe((payload) => {
        leaving.current = false;
        setElapsed(0);
        setInfo(payload || {});
    }), []);

    const finish = useCallback(() => {
        if (leaving.current) return;
        leaving.current = true;
        // Full reload (not a router push) so every in-memory piece of the
        // old session — user, roles, polling — is gone for good.
        window.location.href = '/login?type=session-displaced';
    }, []);

    useEffect(() => {
        if (!info) return undefined;
        okRef.current?.focus();
        const id = setInterval(() => {
            if (document.hidden) return;
            setElapsed((e) => e + TICK_MS);
        }, TICK_MS);
        return () => clearInterval(id);
    }, [info]);

    useEffect(() => {
        if (info && elapsed >= SECONDS * 1000) finish();
    }, [elapsed, info, finish]);

    if (!info) return null;

    const secondsLeft = Math.max(0, Math.ceil((SECONDS * 1000 - elapsed) / 1000));
    const progress = Math.min(1, elapsed / (SECONDS * 1000));
    const dark = theme === 'black';

    return (
        <div className={`ios-alert-backdrop${dark ? ' ios-dark' : ''}`} role="presentation">
            <div
                className="ios-alert"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="ios-alert-title"
                aria-describedby="ios-alert-message"
            >
                <div className="ios-alert-body">
                    <h2 id="ios-alert-title" className="ios-alert-title">Signed out</h2>
                    <p id="ios-alert-message" className="ios-alert-message">
                        Your account was signed in on {info.device ? <strong>{info.device}</strong> : 'another device'}.
                        For your security, only one device can use an account at a time, so this device has been signed out.
                    </p>
                    <p className="ios-alert-hint">
                        Not you? Sign in again and change your password.
                    </p>
                </div>

                <div className="ios-alert-timer" aria-hidden="true">
                    <div className="ios-alert-timer-fill" style={{ transform: `scaleX(${1 - progress})` }} />
                </div>

                <button ref={okRef} type="button" className="ios-alert-button" onClick={finish}>
                    OK
                    <span className="ios-alert-count" aria-live="off">{secondsLeft}s</span>
                </button>
            </div>
        </div>
    );
}
