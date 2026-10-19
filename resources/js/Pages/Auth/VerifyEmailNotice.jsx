import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import AuthShell, {
    LedgerBanner,
    LedgerButton,
    LedgerGhostButton,
} from '../../Components/shared/AuthShell';
import { Mail } from '../../Components/icons';

// Shown to a freshly registered account until its email is verified. The
// server (EnsureEmailVerified) keeps the rest of the API closed meanwhile;
// this page is the friendly side of that rule.
const RESEND_COOLDOWN_SECONDS = 60;

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
    const recheck = useCallback(async (showMessage = false) => {
        setChecking(true);
        try {
            const { data } = await axios.get('/me', { silent: true });
            updateUser(data.user);
            if (!data.user.email_verified && showMessage) {
                setError('Your email is not verified yet. Open the link in the email we sent you.');
            }
        } catch {
            // ignore: the global interceptor handles dead sessions
        } finally {
            setChecking(false);
        }
    }, [updateUser]);

    useEffect(() => {
        const onFocus = () => recheck(false);
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [recheck]);

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
            subtitle="We sent a verification link to your registered address. Open it to activate your account."
            railHeadline="One quick step."
            railNote="The link expires in 60 minutes. If you can't find it, check your spam folder or send a new one."
            footer={<>Wrong account? <button type="button" onClick={handleSignOut} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 700, color: 'var(--lg-accent)' }}>Sign out</button></>}
        >
            {error && <LedgerBanner tone="error">{error}</LedgerBanner>}
            {message && <LedgerBanner tone="notice">{message}</LedgerBanner>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', margin: '4px 0 16px', fontWeight: 600 }}>
                <Mail size={15} strokeWidth={2.25} />
                {maskEmail(user.email)}
            </div>

            <div className="lg-actions-row" style={{ marginTop: 8 }}>
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
