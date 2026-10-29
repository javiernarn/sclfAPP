import React, { useState, useEffect, useRef } from 'react';
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
import { Mail, Lock } from '../../Components/icons';
import { rememberLogin } from '../../utils/welcome';
import { canOpenPath } from '../../utils/redirectGuard';
import { useTranslation } from '../../i18n';
import occBg from '../../assets/images/occ.webp';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    // Set once login() reports two_factor_required — switches the form
    // from credentials to the OTP-entry step instead of navigating away.
    // tempToken is only ever held in memory (never persisted) and is only
    // good for the /2fa/login-verify call itself, which is exactly what
    // it's scoped to server-side (see RequireFullAccess middleware).
    const [twoFactorChallenge, setTwoFactorChallenge] = useState(null); // { tempToken } | null
    const [code, setCode] = useState('');
    const { login, verifyTwoFactor, user: currentUser, roles, loading: authLoading } = useAuth();
    const toast = useToast();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionDisplaced = searchParams.get('type') === 'session-displaced';
    const sessionExpired = searchParams.get('type') === 'session-expired';
    // Set by the link in the verification email (EmailVerificationController).
    const verifyStatus = searchParams.get('verify'); // 'ok' | 'invalid' | null
    // Set when this login page was opened from a notification email's
    // "Login to View" button (?redirect=/claims/5, etc.) — stashed for
    // MainPage to pick up once the post-login "Preparing your
    // workspace…" screen finishes, so the person lands straight on the
    // claim/match/found item the email was about instead of just their
    // role's generic dashboard. Only ever a same-app relative path (it's
    // built server-side in SclfNotification::actionUrl()), but validated
    // again here regardless before it's trusted.
    const redirectParam = searchParams.get('redirect');
    // Id of the account the notification (email link) was sent to.
    const uidParam = searchParams.get('uid');

    // Already signed in and opened an emailed link: go straight to the page,
    // but only if the link was meant for this account.
    //
    // `signingIn` guards against a fresh login on this very page: login()
    // sets the user BEFORE finishLogin() runs, so without this guard the
    // effect below would jump straight to the redirect target (the
    // dashboard flashes) and only then does finishLogin() send them to the
    // MainPage loader — or skip the loader entirely when navigation races.
    const signingIn = useRef(false);
    useEffect(() => {
        if (signingIn.current) return;
        if (authLoading || !currentUser || !redirectParam || !/^\/(?!\/)/.test(redirectParam)) return;
        if (uidParam && String(currentUser.id) !== String(uidParam)) return; // someone else's link: show login
        if (!canOpenPath(redirectParam, roles)) return; // another role's page: stay on login
        navigate(redirectParam, { replace: true });
    }, [authLoading, currentUser, roles, redirectParam, uidParam, navigate]);

    useEffect(() => {
        document.title = t('login.pageTitle');
    }, [t]);

    // Prefill from anything previously remembered — only ever written when
    // the person checked "Keep this session open" on a prior visit.
    useEffect(() => {
        // Arrived here because another device took over the account:
        // never prefill, and wipe anything still remembered on this device.
        if (sessionDisplaced) {
            clearRememberedCredentials();
            setEmail('');
            setPassword('');
            setRemember(false);
            return;
        }
        const remembered = loadRememberedCredentials();
        if (remembered) {
            setEmail(remembered.email || '');
            setPassword(remembered.password || '');
            setRemember(true);
        }
    }, [sessionDisplaced]);

    const finishLogin = (firstLogin = false) => {
        rememberLogin(firstLogin);
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
        // "Welcome" (first ever sign-in) or "Welcome back" toast itself
        // once they're really there (see DashboardShell.jsx and
        // utils/welcome.js — the server's first_login flag decides).
        try {
            window.sessionStorage.setItem('sclf-login-toast', '1');
            // Relative path only ("/claims/5", "/notifications", …) —
            // guards against an external/absolute URL ever being
            // honored even though actionUrl() only ever builds one of
            // the three known routes below.
            if (redirectParam && /^\/(?!\/)/.test(redirectParam)) {
                window.sessionStorage.setItem('sclf-post-login-redirect', redirectParam);
                if (uidParam) window.sessionStorage.setItem('sclf-post-login-uid', uidParam);
                else window.sessionStorage.removeItem('sclf-post-login-uid');
            } else {
                // This sign-in has no deep link: drop any older one so it can't fire for this account.
                window.sessionStorage.removeItem('sclf-post-login-redirect');
                window.sessionStorage.removeItem('sclf-post-login-uid');
            }
        } catch (e) {
            // ignore storage errors (private mode etc.) — worst case
            // they just don't get the post-login toast/redirect this time.
        }

        // Route back through "/" so the branded MainPage loading
        // screen plays again before landing on the right dashboard —
        // same behaviour as right after visiting the site fresh.
        navigate('/', { replace: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        signingIn.current = true;

        try {
            const result = await login(email, password, remember);

            if (result.two_factor_required) {
                signingIn.current = false;
                setTwoFactorChallenge({ tempToken: result.temp_token });
                return;
            }

            finishLogin(!!result.first_login);
        } catch (err) {
            signingIn.current = false;
            // Validation errors (bad credentials, lockout) carry the real,
            // specific message under errors.email — the top-level
            // `message` is just Laravel's generic "The given data was
            // invalid." wrapper.
            const message = err.response?.data?.errors?.email?.[0]
                || err.response?.data?.message
                || t('login.invalidCredentials');
            setError(message);
            toast.error(message, { title: t('login.signInFailed') });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        signingIn.current = true;

        try {
            const result = await verifyTwoFactor(twoFactorChallenge.tempToken, code, remember);
            finishLogin(!!result.first_login);
        } catch (err) {
            signingIn.current = false;
            const message = err.response?.data?.errors?.code?.[0]
                || err.response?.data?.message
                || t('login.invalidCode');
            setError(message);
            toast.error(message, { title: t('login.verificationFailed') });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell
            docType={t('login.docType')}
            caseSeed="LOG"
            title={<>{t('login.titleA')}<span className="accent">{t('login.titleB')}</span></>}
            subtitle={t('login.subtitle')}
            railHeadline={t('login.railHeadline')}
            railNote={t('login.railNote')}
            bgImage={occBg}
            gate
            gateName="Opol Community College"
            gateLabel={t('login.gateLabel')}
            gateDefaultOpen={sessionExpired || sessionDisplaced || !!redirectParam || !!verifyStatus}
            footer={<>{t('login.noRecord')} <Link to="/register">{t('login.openCase')}</Link></>}
        >
            {sessionDisplaced && (
                <LedgerBanner tone="notice">{t('login.sessionDisplaced')}</LedgerBanner>
            )}
            {sessionExpired && (
                <LedgerBanner tone="notice">{t('login.sessionExpired')}</LedgerBanner>
            )}
            {verifyStatus === 'ok' && (
                <LedgerBanner tone="notice">{t('login.verifyOk')}</LedgerBanner>
            )}
            {verifyStatus === 'invalid' && (
                <LedgerBanner tone="error">{t('login.verifyInvalid')}</LedgerBanner>
            )}

            {twoFactorChallenge ? (
                <form onSubmit={handleVerifyCode} noValidate>
                    <LedgerBanner tone="notice">
                        {t('login.enterCode')}
                    </LedgerBanner>

                    <LedgerRow index={1} label={<>{t('login.verificationCode')} <span className="lg-required">*</span></>} icon={Lock}>
                        <LedgerInput
                            id="code"
                            type="text"
                            inputMode="numeric"
                            value={code}
                            onChange={(e) => { setCode(e.target.value); setError(''); }}
                            autoComplete="one-time-code"
                            placeholder="123456"
                            aria-invalid={!!error}
                            required
                            autoFocus
                        />
                    </LedgerRow>

                    <LedgerButton disabled={loading || !code}>
                        {loading ? t('login.verifying') : t('login.verifyAndSignIn')}
                    </LedgerButton>

                    <button
                        type="button"
                        className="lg-forgot"
                        style={{ display: 'block', marginTop: 14, background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => { setTwoFactorChallenge(null); setCode(''); setError(''); }}
                    >
                        &larr; {t('login.backToSignIn')}
                    </button>
                </form>
            ) : (
            <form onSubmit={handleSubmit} noValidate>
                <LedgerRow index={1} label={<>{t('login.emailOnFile')} <span className="lg-required">*</span></>} icon={Mail} hint={t('login.emailHint')}>
                    <LedgerInput
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(normalizeEmailInput(e.target.value)); setError(''); }}
                        autoComplete={sessionDisplaced ? 'off' : 'email'}
                        placeholder="occ.lastname.firstname@gmail.com"
                        aria-invalid={!!error}
                        required
                        autoFocus
                    />
                </LedgerRow>

                <LedgerRow index={2} label={<>{t('login.password')} <span className="lg-required">*</span></>} icon={Lock}>
                    <LedgerPasswordInput
                        id="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        autoComplete={sessionDisplaced ? 'new-password' : 'current-password'}
                        show={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                        aria-invalid={!!error}
                        required
                    />
                </LedgerRow>

                <div className="lg-row-checkbox" style={{ margin: '14px 0 18px' }}>
                    <Tooltip label={t('login.keepOpenTip')}>
                        <label className="lg-remember" htmlFor="remember">
                            <input
                                id="remember"
                                type="checkbox"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                            />
                            {t('login.keepOpen')}
                        </label>
                    </Tooltip>
                    <Link to="/forgot-password" className="lg-forgot">{t('login.forgot')}</Link>
                </div>

                <LedgerButton disabled={loading}>
                    {loading ? t('login.verifying') : t('login.signIn')}
                </LedgerButton>
            </form>
            )}
        </AuthShell>
    );
}
