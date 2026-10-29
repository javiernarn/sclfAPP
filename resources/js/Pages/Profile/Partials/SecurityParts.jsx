import React, { useRef, useState } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle } from '../../../Components/icons';
import './SecurityForms.css';

// Shared building blocks for the three Security-card forms (Change email,
// Change password, Two-factor). Kept in one place so they look and behave the
// same on phones, tablets, laptops and inside the installed mobile app.

/**
 * Password input with its own show/hide button.
 *
 * `manual` is for the CURRENT-password check: the person must type it
 * themselves. Browser/password-manager autofill is blocked (the field stays
 * read-only until it is tapped, which stops Chrome/Safari from filling it),
 * and pasting or dropping text into it is refused.
 */
export function PasswordField({ id, label, value, onChange, show, onToggle, autoComplete, autoFocus, hint, invalid, manual, error }) {
    const [locked, setLocked] = useState(!!manual);
    const stop = manual ? (e) => e.preventDefault() : undefined;
    return (
        <div className="sx-field">
            <label htmlFor={id}>{label} <span className="ds-required">*</span></label>
            <div className="sx-input-wrap">
                <input
                    id={id}
                    name={manual ? `${id}_manual` : id}
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    autoComplete={manual ? 'off' : autoComplete}
                    autoFocus={autoFocus}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    readOnly={locked}
                    onFocus={manual ? () => setLocked(false) : undefined}
                    onPaste={stop}
                    onDrop={stop}
                    onCopy={stop}
                    data-lpignore={manual ? 'true' : undefined}
                    data-1p-ignore={manual ? 'true' : undefined}
                    data-form-type={manual ? 'other' : undefined}
                    aria-invalid={invalid || !!error || undefined}
                    required
                />
                <button
                    type="button"
                    className="sx-eye"
                    onClick={onToggle}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    aria-pressed={show}
                >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
            </div>
            {error
                ? <p className="sx-error" role="alert">{error}</p>
                : hint && <p className="sx-hint">{hint}</p>}
        </div>
    );
}

/** Six one-digit boxes that behave like one field (paste, backspace, arrows). */
export function OtpInput({ value, onChange, disabled, invalid, autoFocus, label = 'Verification code' }) {
    const refs = useRef([]);
    const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

    const focusAt = (i) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

    const setAt = (i, d) => {
        const next = digits.slice();
        next[i] = d;
        onChange(next.join('').slice(0, 6));
    };

    const handleChange = (i, e) => {
        const raw = e.target.value.replace(/\D/g, '');
        if (!raw) { setAt(i, ''); return; }
        if (raw.length > 1) {
            // Autofill / paste from keyboard suggestion lands here.
            const merged = (value.slice(0, i) + raw).slice(0, 6);
            onChange(merged);
            focusAt(merged.length >= 6 ? 5 : merged.length);
            return;
        }
        setAt(i, raw);
        if (i < 5) focusAt(i + 1);
    };

    const handleKeyDown = (i, e) => {
        if (e.key === 'Backspace' && !digits[i] && i > 0) { e.preventDefault(); setAt(i - 1, ''); focusAt(i - 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); focusAt(i - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); focusAt(i + 1); }
    };

    const handlePaste = (e) => {
        const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        if (!text) return;
        e.preventDefault();
        onChange(text);
        focusAt(text.length >= 6 ? 5 : text.length);
    };

    return (
        <div className="sx-otp" role="group" aria-label={label}>
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={(el) => { refs.current[i] = el; }}
                    className={`sx-otp-box${d ? ' is-filled' : ''}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    autoFocus={autoFocus && i === 0}
                    value={d}
                    disabled={disabled}
                    aria-label={`Digit ${i + 1}`}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => handleChange(i, e)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    onFocus={(e) => e.target.select()}
                />
            ))}
        </div>
    );
}

/** Numbered progress dots: Step 1 of 2. */
export function Steps({ labels, current }) {
    return (
        <ol className="sx-steps" aria-label="Progress">
            {labels.map((l, i) => (
                <li key={l} className={i < current ? 'is-done' : i === current ? 'is-now' : ''} aria-current={i === current ? 'step' : undefined}>
                    <span className="sx-steps-dot">{i < current ? '✓' : i + 1}</span>
                    <span className="sx-steps-label">{l}</span>
                </li>
            ))}
        </ol>
    );
}

export function Banner({ tone = 'error', children }) {
    return <div className={`sx-banner is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

/** Bottom button row: stacked + full width on phones, side by side elsewhere. */
export function Actions({ children }) {
    return <div className="sx-actions">{children}</div>;
}

export function PasswordStrength({ password }) {
    const checks = [
        { ok: password.length >= 8, label: '8+ characters' },
        { ok: /[A-Z]/.test(password), label: 'Uppercase letter' },
        { ok: /[a-z]/.test(password), label: 'Lowercase letter' },
        { ok: /[0-9]/.test(password), label: 'A number' },
    ];
    const score = checks.filter((c) => c.ok).length;
    const meta = [
        { label: 'Too short', cls: 'is-0' },
        { label: 'Weak', cls: 'is-1' },
        { label: 'Fair', cls: 'is-2' },
        { label: 'Good', cls: 'is-3' },
        { label: 'Strong', cls: 'is-4' },
    ][password ? score : 0];
    return (
        <div className={`sx-strength ${password ? meta.cls : ''}`}>
            <div className="sx-strength-head">
                <span>Password strength</span>
                <b>{password ? meta.label : '—'}</b>
            </div>
            <div className="sx-strength-bar" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => <span key={i} className={i < score && password ? 'on' : ''} />)}
            </div>
            <ul className="sx-reqs">
                {checks.map((c) => (
                    <li key={c.label} className={c.ok ? 'is-ok' : ''}>
                        {c.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {c.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}
