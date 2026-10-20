import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import AuthShell, {
    LedgerRow,
    LedgerInput,
    LedgerBanner,
    LedgerButton,
    LedgerGhostButton,
} from '../../Components/shared/AuthShell';
import { Mail, Lock } from '../../Components/icons';

// Shown to a freshly registered account until its email is verified. The
// server (EnsureEmailVerified) keeps the rest of the API closed meanwhile;
// this page is the friendly side of that rule.
const RESEND_COOLDOWN_SECONDS = 60;
// While this page is open, quietly re-check the account so the app moves on
// by itself after the link is clicked, even when the focus event never fires.
const POLL_INTERVAL_MS = 8000;

const maskEmail = (email) => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (!domain) return email;
    const masked = localPart.charAt(0) + '*'.repeat(Math.max(localPart.length - 2, 1)) + localPart.charAt(localPart.length - 1);
    return `${masked}@${domain}`;
};

export default function VerifyEmailNotice() {
    const { user, loading, updateUser, logout } = useAuth();
    const navigate = useNavigate();
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const [checking, setChecking] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [code, setCode] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        document.title = 'Verify your email | SCLF - Opol Community College';
    }, []);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    // Re-read the account from the server. Used by the button and whenever the
    // student comes back to this tab after clicking the link in their email.
    const recheck = useCallback(async (showMessage = false, quiet = false) => {
        if (!quiet) setChecking(true);
        try {
            const { data } = await axios.get('/me', { silent: true });
            updateUser(data.user);
            if (!data.user.email_verified && showMessage) {
                setError('Your email is not verified yet. Open the link in the email we sent you.');
            }
        } catch {
            // ignore: the global interceptor handles dead sessions
        } finally {
            if (!quiet) setChecking(false);
        }
    }, [updateUser]);

    useEffect(() => {
        const onFocus = () => recheck(false);
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [recheck]);

    // Background check every few seconds while the tab is visible.
    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') recheck(false, true);
        }, POLL_INTERVAL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') recheck(false, true);
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [recheck]);

    const handleSubmitCode = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setSubmitting(true);
        try {
            await axios.post('/email/verify-code', { code }, { silent: true });
            await recheck(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Could not verify the code. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResend = async () => {
        setError('');
        setMessage('');
        setSending(true);
        try {
            const { data } = await axios.post('/email/verification-notification', {}, { silent: true });
            setMessage(data.message);
            setCooldown(RESEND_COOLDOWN_SECONDS);
            if (data.email_verified) await recheck(false);
        } catch (err) {
            setError(err.response?.status === 429
                ? 'Please wait a moment before asking for another email.'
                : (err.response?.data?.message || 'Could not send the email. Please try again.'));
        } finally {
            setSending(false);
        }
    };

    const handleSignOut = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (user.email_verified !== false) return <Navigate to="/app/dashboard" replace />;

    return (
        <AuthShell
            docType="EMAIL VERIFICATION"
            caseSeed="VER"
            centerHead
            title={<>Check your <span className="accent">email</span></>}
            subtitle="We sent a 6-digit code and a verification link to your registered address. Type the code below, or open the link, to activate your account."
            railHeadline="One quick step."
            railNote="The code and link expire in 60 minutes. If you can't find it, check your spam folder or send a new one."
            footer={<>Wrong account? <button type="button" onClick={handleSignOut} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 700, color: 'var(--lg-accent)' }}>Sign out</button></>}
        >
            {error && <LedgerBanner tone="error">{error}</LedgerBanner>}
            {message && <LedgerBanner tone="notice">{message}</LedgerBanner>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', margin: '4px 0 16px', fontWeight: 600 }}>
                <Mail size={15} strokeWidth={2.25} />
                {maskEmail(user.email)}
            </div>

            <form onSubmit={handleSubmitCode} noValidate>
                <LedgerRow index={1} label={<>Verification code <span className="lg-required">*</span></>} icon={Lock}>
                    <LedgerInput
                        id="verify-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={code}
                        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                        autoComplete="one-time-code"
                        placeholder="123456"
                        aria-invalid={!!error}
                        required
                    />
                </LedgerRow>
                <LedgerButton type="submit" disabled={submitting || code.length !== 6}>
                    {submitting ? 'Verifying…' : 'Verify code'}
                </LedgerButton>
            </form>

            <div className="lg-actions-row" style={{ marginTop: 16 }}>
                <LedgerGhostButton onClick={handleResend} disabled={sending || cooldown > 0}>
                    {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
                </LedgerGhostButton>
                <LedgerButton type="button" disabled={checking} onClick={() => recheck(true)}>
                    {checking ? 'Checking…' : "I've verified"}
                </LedgerButton>
            </div>
        </AuthShell>
    );
}
