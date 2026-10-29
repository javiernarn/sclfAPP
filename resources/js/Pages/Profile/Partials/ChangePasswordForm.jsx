import React, { useState } from 'react';
import { Lock, ShieldCheck, CheckCircle2, XCircle, KeyRound } from '../../../Components/icons';
import axios from '../../../config/axiosConfig';
import { useToast } from '../../../context/ToastContext';
import { useDiscardConfirm } from '../../../context/ConfirmContext';
import { PasswordField, PasswordStrength, Banner, Actions } from './SecurityParts';

const EMPTY_FORM = { current_password: '', password: '', password_confirmation: '' };

// Phone: one column, big fields, stacked full-width buttons.
// Tablet: same, buttons side by side.
// Laptop/desktop: fields on the left, live strength + requirements on the right.
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

    const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.current_password) { setError('Enter your current password.'); return; }
        if (!isPasswordValid) { setError('Your new password does not meet the requirements.'); return; }
        if (!passwordsMatch) { setError('New password and confirmation do not match.'); return; }
        if (form.current_password === form.password) { setError('Your new password must be different from your current password.'); return; }

        setLoading(true);
        try {
            // Silent: a wrong "current password" is a routine outcome, shown
            // inline instead of through the global 422 toast.
            await axios.post('/change-password', form, { silent: true });
            reset();
            setSuccess(true);
            setOpen(false);
            toast.success('Your password has been changed successfully.', { title: 'Password updated' });
            setTimeout(() => setSuccess(false), 5000);
        } catch (err) {
            const errors = err.response?.data?.errors;
            setError(
                (errors && Object.values(errors).flat()[0]) ||
                err.response?.data?.message ||
                'Failed to change password. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sx-root">
            {success && (
                <Banner tone="ok"><ShieldCheck size={16} /> Your password has been changed successfully.</Banner>
            )}

            {!open ? (
                <div className="sx-row">
                    <div className="sx-row-main">
                        <span className="sx-row-icon"><KeyRound size={19} /></span>
                        <div style={{ minWidth: 0 }}>
                            <div className="sx-row-title">Password</div>
                            <div className="sx-row-meta" style={{ letterSpacing: '0.12em' }}>••••••••••••</div>
                        </div>
                    </div>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setOpen(true)}>
                        <Lock size={15} /> Change password
                    </button>
                </div>
            ) : (
                <form className="sx-panel" onSubmit={handleSubmit} noValidate>
                    <div className="sx-panel-head">
                        <span className="sx-row-icon"><KeyRound size={19} /></span>
                        <div style={{ minWidth: 0 }}>
                            <h4 className="sx-panel-title">Change password</h4>
                            <p className="sx-panel-sub">Other devices are signed out after you change it.</p>
                        </div>
                    </div>

                    {error && <Banner tone="error">{error}</Banner>}

                    <div className="sx-pw-grid">
                        <div>
                            <PasswordField
                                id="current_password"
                                label="Current password"
                                value={form.current_password}
                                onChange={handleChange}
                                show={showCurrent}
                                onToggle={() => setShowCurrent((v) => !v)}
                                autoComplete="current-password"
                                autoFocus
                                manual
                                hint="Type it yourself. Autofill and paste are turned off."
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
                            <PasswordField
                                id="password_confirmation"
                                label="Confirm new password"
                                value={form.password_confirmation}
                                onChange={handleChange}
                                show={showConfirm}
                                onToggle={() => setShowConfirm((v) => !v)}
                                autoComplete="new-password"
                            />
                            {form.password_confirmation && (
                                <div className={`sx-match ${passwordsMatch ? 'is-ok' : 'is-bad'}`} style={{ marginTop: -6, marginBottom: 12 }}>
                                    {passwordsMatch ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                                </div>
                            )}
                        </div>

                        <div>
                            <PasswordStrength password={form.password} />
                        </div>
                    </div>

                    <Actions>
                        <button type="button" className="ds-btn ds-btn-secondary" onClick={handleCancel} disabled={loading}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="ds-btn ds-btn-primary"
                            disabled={loading || !isPasswordValid || !passwordsMatch || !form.current_password}
                        >
                            {loading ? 'Updating…' : 'Update password'}
                        </button>
                    </Actions>
                </form>
            )}
        </div>
    );
}
