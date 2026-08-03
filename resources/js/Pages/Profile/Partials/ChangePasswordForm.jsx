import React, { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, CheckCircle2, XCircle, KeyRound } from 'lucide-react';
import axios from '../../../config/axiosConfig';
import Tooltip from '../../../Components/shared/Tooltip';
import { useToast } from '../../../context/ToastContext';
import { useDiscardConfirm } from '../../../context/ConfirmContext';

// Same "eye" toggle pattern used by the public Reset Password page
// (Components/shared/AuthShell.jsx's LedgerPasswordInput), rebuilt with
// the dashboard's `ds-` classes so it fits the themed Profile page.
function PasswordField({ id, label, value, onChange, show, onToggle, autoComplete, autoFocus }) {
    return (
        <div className="ds-field">
            <label htmlFor={id}>{label} <span className="ds-required">*</span></label>
            <div className="ds-pwd-wrap">
                <input
                    id={id}
                    name={id}
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    required
                />
                <Tooltip label={show ? 'Hide password' : 'Show password'} side="left">
                    <button
                        type="button"
                        className="ds-pwd-toggle"
                        onClick={onToggle}
                        tabIndex={-1}
                        aria-label={show ? 'Hide password' : 'Show password'}
                    >
                        {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                </Tooltip>
            </div>
        </div>
    );
}

function StrengthMeter({ password }) {
    if (!password) return null;
    const checks = [
        password.length >= 8,
        /[A-Z]/.test(password),
        /[a-z]/.test(password),
        /[0-9]/.test(password),
    ];
    const score = checks.filter(Boolean).length;
    const meta = [
        { label: 'Too short', color: '#ef4444' },
        { label: 'Weak', color: '#ef4444' },
        { label: 'Fair', color: '#f59e0b' },
        { label: 'Good', color: '#0ea5e9' },
        { label: 'Strong', color: '#16a34a' },
    ][score];
    return (
        <div className="ds-strength">
            <div className="ds-strength-ticks">
                {[0, 1, 2, 3].map((i) => (
                    <span key={i} style={i < score ? { background: meta.color } : undefined} />
                ))}
            </div>
            <span className="ds-strength-label" style={{ color: meta.color }}>{meta.label}</span>
        </div>
    );
}

function RequirementChecklist({ password }) {
    const items = [
        { ok: password.length >= 8, label: '8+ characters' },
        { ok: /[A-Z]/.test(password), label: 'One uppercase letter' },
        { ok: /[a-z]/.test(password), label: 'One lowercase letter' },
        { ok: /[0-9]/.test(password), label: 'One number' },
    ];
    return (
        <div className="ds-checklist">
            <div className="ds-checklist-grid">
                {items.map((it) => (
                    <span key={it.label} className={`ds-checklist-item${it.ok ? ' is-ok' : ''}`}>
                        {it.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                        {it.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function MatchNote({ password, confirm }) {
    if (!confirm) return null;
    const match = password === confirm;
    return (
        <div className={`ds-match ${match ? 'is-ok' : 'is-bad'}`}>
            {match ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {match ? 'Passwords match' : 'Passwords do not match'}
        </div>
    );
}

const EMPTY_FORM = { current_password: '', password: '', password_confirmation: '' };

export default function ChangePasswordForm() {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const toast = useToast();
    const discardConfirm = useDiscardConfirm();

    const isDirty = form.current_password !== '' || form.password !== '' || form.password_confirmation !== '';

    const isPasswordValid =
        form.password.length >= 8 &&
        /[A-Z]/.test(form.password) &&
        /[a-z]/.test(form.password) &&
        /[0-9]/.test(form.password);
    const passwordsMatch = form.password === form.password_confirmation && form.password_confirmation.length > 0;

    const reset = () => {
        setForm(EMPTY_FORM);
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
        setError('');
    };

    const handleCancel = async () => {
        const ok = await discardConfirm(isDirty, {
            message: "You've started changing your password. If you close this now, what you've typed will be discarded.",
        });
        if (!ok) return;
        reset();
        setOpen(false);
    };

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.current_password) {
            setError('Enter your current password.');
            return;
        }
        if (!isPasswordValid) {
            setError('Your new password does not meet the requirements below.');
            return;
        }
        if (!passwordsMatch) {
            setError('New password and confirmation do not match.');
            return;
        }
        if (form.current_password === form.password) {
            setError('Your new password must be different from your current password.');
            return;
        }

        setLoading(true);
        try {
            // Silent so the shared axios instance's global 422 toast
            // doesn't fire on top of the inline banner below — a failed
            // "current password" check is an expected, routine outcome
            // here, not an unexpected app error.
            await axios.post('/change-password', form, { silent: true });
            reset();
            setSuccess(true);
            setOpen(false);
            toast.success('Your password has been changed successfully.', { title: 'Password updated' });
            setTimeout(() => setSuccess(false), 5000);
        } catch (err) {
            const errors = err.response?.data?.errors;
            const message =
                (errors && Object.values(errors).flat()[0]) ||
                err.response?.data?.message ||
                'Failed to change password. Please try again.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {success && (
                <div className="ds-success">
                    <ShieldCheck size={16} />
                    Your password has been changed successfully.
                </div>
            )}

            {!open ? (
                <div className="ds-security-row">
                    <div className="ds-security-row-text">
                        <span className="ds-security-icon"><KeyRound size={18} /></span>
                        <div>
                            <div className="ds-security-row-title">Password</div>
                            <div className="ds-security-row-meta">••••••••••••</div>
                        </div>
                    </div>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setOpen(true)}>
                        <Lock size={15} />
                        Change Password
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    {error && <div className="ds-error">{error}</div>}

                    <PasswordField
                        id="current_password"
                        label="Current password"
                        value={form.current_password}
                        onChange={handleChange}
                        show={showCurrent}
                        onToggle={() => setShowCurrent((v) => !v)}
                        autoComplete="current-password"
                        autoFocus
                    />

                    <PasswordField
                        id="password"
                        label="New password"
                        value={form.password}
                        onChange={handleChange}
                        show={showNew}
                        onToggle={() => setShowNew((v) => !v)}
                        autoComplete="new-password"
                    />
                    <StrengthMeter password={form.password} />
                    <RequirementChecklist password={form.password} />

                    <PasswordField
                        id="password_confirmation"
                        label="Confirm new password"
                        value={form.password_confirmation}
                        onChange={handleChange}
                        show={showConfirm}
                        onToggle={() => setShowConfirm((v) => !v)}
                        autoComplete="new-password"
                    />
                    <MatchNote password={form.password} confirm={form.password_confirmation} />

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            type="submit"
                            className="ds-btn ds-btn-primary"
                            disabled={loading || !isPasswordValid || !passwordsMatch || !form.current_password}
                        >
                            {loading ? 'Updating…' : 'Update Password'}
                        </button>
                        <button type="button" className="ds-btn ds-btn-secondary" onClick={handleCancel} disabled={loading}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </>
    );
}
