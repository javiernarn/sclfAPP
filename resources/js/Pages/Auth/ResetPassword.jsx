import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation, Link, Navigate } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import AuthShell, {
    LedgerRow,
    LedgerPasswordInput,
    LedgerBanner,
    LedgerButton,
    LedgerGhostButton,
    StrengthTicks,
    RequirementChecklist,
    PasswordMatchNote,
    Stamp,
} from '../../Components/shared/AuthShell';
import { Lock } from '../../Components/icons';

// ---------------------------------------------------------------------------
// One-time reset links.
//
// The emailed link is good for ONE successful reset, within 60 minutes, and
// only until a newer link is requested. The server enforces all of that; this
// page just makes it visible and friendly:
//   - on open (and when the browser restores the page from its back/forward
//     cache) it asks the server whether the link is still usable and, if not,
//     shows "link no longer valid" instead of the form;
//   - if the server rejects the link at submit time (e.g. it was used in
//     another tab a moment ago) the form is swapped for the same screen;
//   - after a successful reset the form's history entry is REPLACED by the
//     success page (/reset-password/success), so Back can't return to the
//     form, and re-clicking the old email link is refused by the check above.
// ---------------------------------------------------------------------------

const LINK_MESSAGES = {
    link_expired: {
        title: <>Link <span className="accent">expired</span></>,
        stamp: 'LINK EXPIRED',
        headline: 'That link has timed out.',
        note: 'Reset links only work for a short time. Request a fresh one and we will email it right away.',
        text: 'This reset link has expired. For your security, links only work for a short time. Please request a new one.',
    },
    link_invalid: {
        title: <>Link no longer <span className="accent">valid</span></>,
        stamp: 'LINK REVOKED',
        headline: 'This link has been retired.',
        note: 'Each reset link works once. If you already changed your password with it, or asked for a newer link, the old one is closed.',
        text: 'This reset link is no longer valid. It may have already been used, been replaced by a newer link, or never belonged to this account. Please request a new link.',
    },
};

export default function ResetPassword() {
    const { token } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const email = searchParams.get('email') || '';
    const navigate = useNavigate();

    // 'checking' -> asking the server if the link is usable
    // 'form'     -> link is good, show the new-password form
    // 'blocked'  -> link used / expired / replaced
    const [phase, setPhase] = useState(token && email ? 'checking' : 'blocked');
    const [blockedCode, setBlockedCode] = useState('link_invalid');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Reached only through a real, just-finished reset (see handleSubmit).
    const isSuccessRoute = !token;
    const resetJustDone = isSuccessRoute && !!location.state?.passwordReset;

    useEffect(() => {
        document.title = 'Reset Password | SCLF - Opol Community College';
    }, []);

    // Is the emailed link still usable? Runs on open, and again if the browser
    // restores this page from the back/forward cache (where React would not
    // otherwise re-run anything and a used link could look alive).
    useEffect(() => {
        if (isSuccessRoute) return undefined;
        if (!token || !email) {
            setBlockedCode('link_invalid');
            setPhase('blocked');
            return undefined;
        }

        let cancelled = false;
        const verify = async () => {
            try {
                const { data } = await axios.post(
                    '/password/reset-token/check',
                    { token, email },
                    { silent: true }
                );
                if (cancelled) return;
                if (data?.data?.valid) {
                    setPhase((p) => (p === 'blocked' ? p : 'form'));
                } else {
                    setBlockedCode(data?.data?.reason === 'expired' ? 'link_expired' : 'link_invalid');
                    setPhase('blocked');
                }
            } catch {
                // Couldn't reach the check (offline, rate limit...). Don't lock
                // anyone out over that: show the form — the server still refuses
                // a bad link when the password is submitted.
                if (!cancelled) setPhase((p) => (p === 'blocked' ? p : 'form'));
            }
        };

        verify();
        const onPageShow = (e) => { if (e.persisted) verify(); };
        window.addEventListener('pageshow', onPageShow);
        return () => {
            cancelled = true;
            window.removeEventListener('pageshow', onPageShow);
        };
    }, [token, email, isSuccessRoute]);

    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
    const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email) {
            setError('Missing email address. Please use the link from your email again.');
            return;
        }
        if (!isPasswordValid) {
            setError('Password does not meet the requirements below.');
            return;
        }
        if (!passwordsMatch) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/reset-password', {
                token,
                email,
                password,
                password_confirmation: confirmPassword,
            }, { silent: true });
            // REPLACE (not push) so the form — and the now-spent token in its
            // URL — is gone from history; Back can't return to it.
            navigate('/reset-password/success', { replace: true, state: { passwordReset: true } });
        } catch (err) {
            const code = err.response?.data?.code;
            if (code === 'link_expired' || code === 'link_invalid') {
                // Used in another tab, expired while typing, or replaced by a newer email.
                setBlockedCode(code);
                setPhase('blocked');
            } else {
                setError(
                    err.response?.data?.errors?.password?.[0] ||
                    err.response?.data?.message ||
                    'We could not reset your password just now. Please check your connection and try again.'
                );
            }
        } finally {
            setLoading(false);
        }
    };

    // /reset-password/success opened directly (typed, bookmarked, or reached via
    // Back/Forward without a fresh reset): nothing to show — go to sign in.
    if (isSuccessRoute && !resetJustDone) {
        return <Navigate to="/login" replace />;
    }

    if (!isSuccessRoute && phase === 'checking') {
        return (
            <AuthShell
                docType="CREDENTIAL REISSUE"
                caseSeed="RST"
                title={<>Checking your <span className="accent">link</span></>}
                subtitle="One moment while we confirm this reset link is still valid."
                railHeadline="Almost back in."
                railNote="Reset links work once and only for a short time, so we check yours first."
            >
                <LedgerBanner tone="notice">Verifying your link…</LedgerBanner>
            </AuthShell>
        );
    }

    if (!isSuccessRoute && phase === 'blocked') {
        const m = LINK_MESSAGES[blockedCode] || LINK_MESSAGES.link_invalid;
        return (
            <AuthShell
                docType="CREDENTIAL REISSUE"
                caseSeed="RST"
                title={m.title}
                subtitle="We can't use this link to change a password."
                railHeadline={m.headline}
                railNote={m.note}
            >
                <Stamp label={m.stamp} tone="danger" />
                <LedgerBanner tone="error">{m.text}</LedgerBanner>
                <div className="lg-stack">
                    <LedgerButton type="button" onClick={() => navigate('/forgot-password', { replace: true })}>
                        Request a New Link
                    </LedgerButton>
                    <LedgerGhostButton type="button" onClick={() => navigate('/login', { replace: true })}>
                        Back to Sign In
                    </LedgerGhostButton>
                </div>
            </AuthShell>
        );
    }

    if (resetJustDone) {
        return (
            <AuthShell
                docType="CREDENTIAL REISSUE"
                caseSeed="RST"
                title={<>Credential <span className="accent">reissued</span></>}
                subtitle="Your password has been changed successfully."
                railHeadline="You're all set."
                railNote="Sign in with your new password to get back to reporting and tracking lost items around campus."
                footer={<>Ready to go? <Link to="/login">Sign in here</Link></>}
            >
                <Stamp label="RESET COMPLETE" />
                <LedgerBanner tone="notice">
                    Your password has been reset successfully. Please sign in with your new password.
                </LedgerBanner>
                <LedgerButton type="button" onClick={() => navigate('/login', { replace: true })}>
                    Go to Sign In
                </LedgerButton>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            docType="CREDENTIAL REISSUE"
            caseSeed="RST"
            title={<>Set a <span className="accent">new</span> password</>}
            subtitle="Choose a strong, secure password for your account."
            railHeadline="Almost back in."
            railNote="Choose a strong new password so your record — and everything you've reported — stays secure."
            footer={<>Remember your password? <Link to="/login">Sign in here</Link></>}
        >
            {error && <LedgerBanner tone="error">{error}</LedgerBanner>}

            <form onSubmit={handleSubmit}>
                <LedgerRow index={1} label={<>New password <span className="lg-required">*</span></>} icon={Lock}>
                    <LedgerPasswordInput
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        show={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                        aria-invalid={!!error}
                        required
                        autoFocus
                    />
                    <StrengthTicks password={password} />
                </LedgerRow>

                <LedgerRow index={2} label={<>Confirm password <span className="lg-required">*</span></>} icon={Lock}>
                    <LedgerPasswordInput
                        id="password_confirmation"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        show={showConfirm}
                        onToggle={() => setShowConfirm((v) => !v)}
                        aria-invalid={!!error}
                        required
                    />
                    <PasswordMatchNote password={password} confirm={confirmPassword} />
                </LedgerRow>

                <RequirementChecklist password={password} />

                <LedgerButton disabled={loading || !isPasswordValid || !passwordsMatch} style={{ marginTop: 14 }}>
                    {loading ? 'Resetting…' : 'Reset Password'}
                </LedgerButton>
            </form>
        </AuthShell>
    );
}
