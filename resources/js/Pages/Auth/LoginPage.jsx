import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Tooltip from '../../Components/shared/Tooltip';
import {
    loadRememberedCredentials,
    saveRememberedCredentials,
    clearRememberedCredentials,
} from '../../hooks/useRememberedCredentials';
import { normalizeEmailInput } from '../../utils/validators';
import AuthShell, {
    LedgerRow,
    LedgerInput,
    LedgerPasswordInput,
    LedgerBanner,
    LedgerButton,
} from '../../Components/shared/AuthShell';
import { Mail, Lock } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionExpired = searchParams.get('type') === 'session-expired';
    // Set when this login page was opened from a notification email's
    // "Login to View" button (?redirect=/claims/5, etc.) — stashed for
    // MainPage to pick up once the post-login "Preparing your
    // workspace…" screen finishes, so the person lands straight on the
    // claim/match/found item the email was about instead of just their
    // role's generic dashboard. Only ever a same-app relative path (it's
    // built server-side in SclfNotification::actionUrl()), but validated
    // again here regardless before it's trusted.
    const redirectParam = searchParams.get('redirect');

    useEffect(() => {
        document.title = 'Login | SCLF - Opol Community College';
    }, []);

    // Prefill from anything previously remembered — only ever written when
    // the person checked "Keep this session open" on a prior visit.
    useEffect(() => {
        const remembered = loadRememberedCredentials();
        if (remembered) {
            setEmail(remembered.email || '');
            setPassword(remembered.password || '');
            setRemember(true);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password, remember);

            // "Keep this session open" checked → store email + password so
            // this form is prefilled next visit. Unchecked → make sure
            // nothing lingers from an earlier login.
            if (remember) {
                saveRememberedCredentials(email, password);
            } else {
                clearRememberedCredentials();
            }

            // Don't toast here — the person still has the ~7s MainPage
            // loading screen ahead of them before they actually land on
            // their dashboard. Flag it instead; DashboardShell fires the
            // "Welcome back" toast itself once they're really there (see
            // the sessionStorage check in DashboardShell.jsx).
            try {
                window.sessionStorage.setItem('sclf-login-toast', '1');
                // Relative path only ("/claims/5", "/notifications", …) —
                // guards against an external/absolute URL ever being
                // honored even though actionUrl() only ever builds one of
                // the three known routes below.
                if (redirectParam && /^\/(?!\/)/.test(redirectParam)) {
                    window.sessionStorage.setItem('sclf-post-login-redirect', redirectParam);
                }
            } catch (e) {
                // ignore storage errors (private mode etc.) — worst case
                // they just don't get the post-login toast/redirect this time.
            }

            // Route back through "/" so the branded MainPage loading
            // screen plays again before landing on the right dashboard —
            // same behaviour as right after visiting the site fresh.
            navigate('/', { replace: true });
        } catch (err) {
            // Validation errors (bad credentials, lockout) carry the real,
            // specific message under errors.email — the top-level
            // `message` is just Laravel's generic "The given data was
            // invalid." wrapper.
            const message = err.response?.data?.errors?.email?.[0]
                || err.response?.data?.message
                || 'Invalid credentials.';
            setError(message);
            toast.error(message, { title: 'Sign-in failed' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell
            docType="ACCESS LOG"
            caseSeed="LOG"
            title={<>Open your <span className="accent">session</span></>}
            subtitle="Sign in to check on lost items and everything the campus has found."
            railHeadline="Welcome back to the SCLF office."
            railNote="One record, one login — everything you've reported or claimed lives under a single account."
            footer={<>No record on file? <Link to="/register">Open a new case file</Link></>}
        >
            {sessionExpired && (
                <LedgerBanner tone="error">Your session expired. Please sign in again.</LedgerBanner>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <LedgerRow index={1} label={<>Email on file <span className="lg-required">*</span></>} icon={Mail} hint="Format: occ.lastname.firstname@gmail.com">
                    <LedgerInput
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(normalizeEmailInput(e.target.value)); setError(''); }}
                        autoComplete="email"
                        placeholder="occ.lastname.firstname@gmail.com"
                        aria-invalid={!!error}
                        required
                        autoFocus
                    />
                </LedgerRow>

                <LedgerRow index={2} label={<>Password <span className="lg-required">*</span></>} icon={Lock}>
                    <LedgerPasswordInput
                        id="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        autoComplete="current-password"
                        show={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                        aria-invalid={!!error}
                        required
                    />
                </LedgerRow>

                <div className="lg-row-checkbox" style={{ margin: '14px 0 18px' }}>
                    <Tooltip label="Stay signed in on this device, and this form remembers your email/password next time. Uncheck on shared or public computers.">
                        <label className="lg-remember" htmlFor="remember">
                            <input
                                id="remember"
                                type="checkbox"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                            />
                            Keep this session open
                        </label>
                    </Tooltip>
                    <Link to="/forgot-password" className="lg-forgot">Forgot password?</Link>
                </div>

                <LedgerButton disabled={loading}>
                    {loading ? 'Verifying…' : 'Sign In'}
                </LedgerButton>
            </form>
        </AuthShell>
    );
}
