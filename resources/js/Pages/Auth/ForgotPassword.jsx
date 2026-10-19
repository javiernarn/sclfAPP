import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import AuthShell, {
    LedgerRow,
    LedgerInput,
    LedgerBanner,
    LedgerButton,
    LedgerGhostButton,
    Stamp,
} from '../../Components/shared/AuthShell';
import { Mail, CheckCircle2 } from '../../Components/icons';

// ---------------------------------------------------------------------------
// Recovery flow: enter email -> confirm the (masked) email -> send (or resend)
// the reset link. For security the server never says whether an account
// exists and never returns a name, so this screen can only ever show back the
// email the person typed. The wording is deliberately "if an account exists".
// ---------------------------------------------------------------------------

const maskEmail = (email) => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (!domain) return email;
    const maskedLocal = localPart.charAt(0) + '*'.repeat(Math.max(localPart.length - 2, 1)) + localPart.charAt(localPart.length - 1);
    return `${maskedLocal}@${domain}`;
};

export default function ForgotPassword() {
    const [view, setView] = useState('find'); // 'find' | 'found'
    const [email, setEmail] = useState('');
    const [foundUser, setFoundUser] = useState(null);
    const [emailSent, setEmailSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        document.title = 'Forgot Password | SCLF - Opol Community College';
    }, []);

    const handleFindAccount = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data } = await axios.post('/password/find-account', { email }, { silent: true });
            setFoundUser({ email: data?.data?.email || email });
            setView('found');
        } catch (err) {
            const status = err.response?.status;
            const message = status === 429
                ? (err.response?.data?.message || 'Too many attempts. Please try again later.')
                : (err.response?.data?.message || 'Something went wrong. Please try again.');
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendResetLink = async () => {
        setError('');
        setLoading(true);

        try {
            await axios.post('/forgot-password', { email }, { silent: true });
            setEmailSent(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send reset link. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleTryAgain = () => {
        setView('find');
        setFoundUser(null);
        setEmailSent(false);
        setError('');
    };

    return (
        <AuthShell
            docType="RECOVERY REQUEST"
            caseSeed="REC"
            centerHead={view === 'found'}
            title={view === 'found' ? <>Confirm your <span className="accent">email</span></> : <>Recover <span className="accent">access</span></>}
            subtitle={view === 'found' ? "If this email is registered, we'll send a secure password reset link to it." : "Give us the email on your record and we'll help you find it."}
            railHeadline={view === 'found' ? 'Almost there.' : 'Locked out happens to everyone.'}
            railNote={view === 'found'
                ? "Click Send Reset Link. If the email is on record, you'll get a secure link that expires in 60 minutes."
                : "Confirm the email tied to your record and we'll help you get back to tracking lost items around campus."}
            footer={<>Remembered it after all? <Link to="/login">Back to sign in</Link></>}
        >
            {error && <LedgerBanner tone="error">{error}</LedgerBanner>}

            {view === 'find' && (
                <form onSubmit={handleFindAccount}>
                    <LedgerRow index={1} label={<>Email on file <span className="lg-required">*</span></>} icon={Mail}>
                        <LedgerInput
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(''); }}
                            autoComplete="email"
                            placeholder="occ.lastname.firstname@gmail.com"
                            aria-invalid={!!error}
                            required
                            autoFocus
                        />
                    </LedgerRow>

                    <LedgerButton disabled={loading} style={{ marginTop: 16 }}>
                        {loading ? 'Searching…' : 'Find My Account'}
                    </LedgerButton>
                </form>
            )}

            {view === 'found' && (
                <>
                    {emailSent ? (
                        <Stamp label="LINK SENT" />
                    ) : (
                        <div className="lg-found-badge">
                            <CheckCircle2 size={15} strokeWidth={2.5} />
                            Ready to send
                        </div>
                    )}

                    <div className="lg-found-box">
                        <div className="lg-found-row">
                            <Mail size={14} strokeWidth={2.25} />
                            {maskEmail(foundUser?.email)}
                        </div>
                    </div>

                    {emailSent && (
                        <LedgerBanner tone="notice">
                            If <strong>{maskEmail(foundUser?.email)}</strong> is registered, a password reset link is on its way. Check your inbox — and the spam folder, just in case.
                        </LedgerBanner>
                    )}

                    <div className="lg-actions-row" style={{ marginTop: 16 }}>
                        <LedgerGhostButton onClick={handleTryAgain}>Try Again</LedgerGhostButton>
                        <LedgerButton type="button" disabled={loading || emailSent} onClick={handleSendResetLink}>
                            {emailSent ? 'Link Sent' : (loading ? 'Sending…' : 'Send Reset Link')}
                        </LedgerButton>
                    </div>

                    {emailSent && (
                        <button type="button" className="lg-resend-link" onClick={handleSendResetLink} disabled={loading}>
                            {loading ? 'Resending…' : "Didn't get it? Resend the link"}
                        </button>
                    )}
                </>
            )}

            <style>{`
                .lg-found-badge {
                    display: flex; width: fit-content; align-items: center; gap: 6px;
                    margin: 0 auto 16px; padding: 6px 14px; border-radius: 999px;
                    font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
                    color: var(--lg-ok);
                }
                .lg-wrap.light .lg-found-badge { background: rgba(22,163,74,0.08); border: 1px solid rgba(22,163,74,0.25); }
                .lg-wrap.dark .lg-found-badge { background: rgba(22,163,74,0.12); border: 1px solid rgba(22,163,74,0.3); }
                .lg-found-box { border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
                .lg-wrap.light .lg-found-box { background: #f4f7fb; border: 1.5px solid #d9e0ec; }
                .lg-wrap.dark .lg-found-box { background: #161a24; border: 1.5px solid #2a3140; }
                .lg-found-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; font-weight: 600; opacity: 0.9; min-width: 0; word-break: break-word; overflow-wrap: anywhere; }
                .lg-found-row svg { flex-shrink: 0; margin-top: 1px; }
                .lg-resend-link {
                    display: block; width: 100%; text-align: center; margin-top: 12px;
                    background: none; border: none; cursor: pointer;
                    font-size: 12.5px; font-weight: 700; color: var(--lg-accent);
                }
                .lg-resend-link:hover:not(:disabled) { text-decoration: underline; }
                .lg-resend-link:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </AuthShell>
    );
}