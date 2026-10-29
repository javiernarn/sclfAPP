import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Pencil, ArrowRight, CheckCircle2, Info, Lock, ArrowLeft, Sparkles } from '../../../Components/icons';
import axios from '../../../config/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useDiscardConfirm } from '../../../context/ConfirmContext';
import { emailNameSegment } from '../../../utils/validators';
import { PasswordField, OtpInput, Steps, Banner, Actions } from './SecurityParts';

// Profile > Security > Email address (students and instructors only).
// Shown only when the server says so (user.email_change_enabled, which comes
// from SCLF_EMAIL_CHANGE_ENABLED in .env). Three phases:
//   form  -> type the new address + current password
//   code  -> type the 6-digit code that was emailed to the NEW address
//   done  -> confirmation
//
// Students keep the school format, so the "occ.lastname." part is locked and
// they only type the first-name part. Instructors only type the part before
// "@gmail.com". Either way the full address is built and shown live.

const SUFFIX = '@gmail.com';
const STUDENT_TYPED = /^[a-z]+\d{0,6}$/;
// Gmail's own rule: 6-30 letters/digits/dots, no leading/double/trailing dot.
const INSTRUCTOR_LOCAL = /^(?!\.)(?!.*\.\.)[a-z0-9.]{5,29}[a-z0-9]$/;

// Lets a long address wrap after a dot or before the @, never mid-word.
const breakable = (str) => String(str).split(/(?<=\.)(?!com$)|(?=@)/).map((part, i) => <React.Fragment key={i}>{i > 0 && <wbr />}{part}</React.Fragment>);

const clean = (v) => String(v || '').toLowerCase().replace(/\s/g, '');

export default function EmailChangeForm() {
    const { user, roles, updateUser } = useAuth();
    const toast = useToast();
    const discardConfirm = useDiscardConfirm();

    const isStudent = Array.isArray(roles) && roles.includes('student');

    const lastSeg = useMemo(() => {
        const fromLast = emailNameSegment(user?.last_name);
        if (fromLast) return fromLast;
        const parts = String(user?.name || '').trim().split(/\s+/);
        return emailNameSegment(parts[parts.length - 1]);
    }, [user?.last_name, user?.name]);
    const firstSeg = useMemo(() => emailNameSegment(user?.first_name || String(user?.name || '').split(' ')[0]), [user?.first_name, user?.name]);

    const prefix = isStudent ? `occ.${lastSeg}.` : '';

    const [phase, setPhase] = useState('idle'); // idle | form | code | done
    const [typed, setTyped] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loading, setLoading] = useState(false);
    const [sentTo, setSentTo] = useState('');
    const [minutes, setMinutes] = useState(15);
    const [wait, setWait] = useState(0);

    const fullEmail = `${prefix}${typed}${SUFFIX}`;
    const typedOk = typed !== '' && (isStudent ? STUDENT_TYPED.test(typed) : INSTRUCTOR_LOCAL.test(typed));
    const sameAsNow = typedOk && fullEmail === String(user?.email || '').toLowerCase();
    const showBad = typed !== '' && (!typedOk || sameAsNow);

    // Resend countdown.
    useEffect(() => {
        if (wait <= 0) return undefined;
        const t = setTimeout(() => setWait((w) => w - 1), 1000);
        return () => clearTimeout(t);
    }, [wait]);

    const reset = () => {
        setPhase('idle'); setTyped(''); setPassword(''); setShowPassword(false);
        setCode(''); setError(''); setFieldError(''); setPasswordError(''); setSentTo(''); setWait(0); setLoading(false);
    };

    const handleTyped = (e) => {
        let v = clean(e.target.value);
        if (v.includes('@')) v = v.split('@')[0];
        if (isStudent && prefix && v.startsWith(prefix)) v = v.slice(prefix.length);
        // Students: letters then up to 6 digits. Instructors: letters, digits, dots.
        v = isStudent ? v.replace(/[^a-z0-9]/g, '') : v.replace(/[^a-z0-9.]/g, '');
        setTyped(v.slice(0, isStudent ? 40 : 30));
        setError(''); setFieldError('');
    };

    const dirty = typed !== '' || password !== '';

    const close = async () => {
        if (phase === 'code') {
            axios.delete('/profile/email/pending', { silent: true }).catch(() => {});
        }
        const ok = phase === 'done' ? true : await discardConfirm(dirty || phase === 'code', {
            message: "You haven't finished changing your email. If you close this now, nothing will change.",
        });
        if (!ok) return;
        reset();
    };

    const sendCode = async (e) => {
        e?.preventDefault();
        setError(''); setFieldError(''); setPasswordError('');

        if (!typedOk) {
            setFieldError(isStudent
                ? 'Use letters for your first name; numbers after it are optional (up to 6).'
                : 'Use 6-30 letters, numbers or dots (no dot at the start, end or twice in a row).');
            return;
        }
        if (sameAsNow) { setFieldError('That is already your email address.'); return; }
        if (!password) { setPasswordError('Type your current password to continue.'); return; }

        setLoading(true);
        try {
            const res = await axios.post('/profile/email/request', { new_email: fullEmail, current_password: password }, { silent: true });
            setSentTo(res.data.sent_to || fullEmail);
            setMinutes(res.data.expires_in_minutes || 15);
            setWait(res.data.resend_in || 60);
            setCode('');
            setPhase('code');
        } catch (err) {
            const d = err.response?.data;
            const errs = d?.errors || {};
            if (errs.new_email) setFieldError(errs.new_email[0]);
            if (errs.current_password) {
                // Wrong password: stay on this step, clear the field so it is typed again by hand.
                setPasswordError(errs.current_password[0]);
                setPassword('');
            }
            if (!errs.new_email && !errs.current_password) setError(d?.message || 'Could not send the code. Please try again.');
            if (err.response?.status === 429 && d?.resend_in) { setWait(d.resend_in); setPhase('code'); setSentTo(fullEmail); }
        } finally {
            setLoading(false);
        }
    };

    const confirm = async (e) => {
        e?.preventDefault();
        setError('');
        if (code.length !== 6) { setError('Enter all 6 digits of the code.'); return; }
        setLoading(true);
        try {
            const res = await axios.post('/profile/email/confirm', { code }, { silent: true });
            updateUser({ email: res.data.email, email_verified: true });
            setPassword('');
            setPhase('done');
            toast.success('Your email address has been changed.', { title: 'Email updated' });
        } catch (err) {
            setError(err.response?.data?.errors?.code?.[0] || err.response?.data?.message || 'That code is not correct.');
            setCode('');
        } finally {
            setLoading(false);
        }
    };

    const useDifferent = async () => {
        axios.delete('/profile/email/pending', { silent: true }).catch(() => {});
        setCode(''); setError(''); setPhase('form');
    };

    const suggestion = isStudent && firstSeg ? firstSeg : '';

    // ---------- collapsed ----------
    if (phase === 'idle') {
        return (
            <div className="sx-root">
                <div className="sx-row">
                    <div className="sx-row-main">
                        <span className="sx-row-icon"><Mail size={19} /></span>
                        <div style={{ minWidth: 0 }}>
                            <div className="sx-row-title">Email address</div>
                            <div className="sx-row-meta">{user?.email || '—'}</div>
                        </div>
                    </div>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setPhase('form')}>
                        <Pencil size={15} /> Change email
                    </button>
                </div>
            </div>
        );
    }

    // ---------- done ----------
    if (phase === 'done') {
        return (
            <div className="sx-root">
                <div className="sx-panel">
                    <div className="sx-done">
                        <div className="sx-done-badge"><CheckCircle2 size={28} /></div>
                        <h4>Email changed</h4>
                        <p>You will now sign in with <b>{breakable(user?.email || '')}</b>. We also let your old address know. Other devices were signed out.</p>
                        <button type="button" className="ds-btn ds-btn-primary" onClick={reset}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    const stepIndex = phase === 'form' ? 0 : 1;

    return (
        <div className="sx-root">
            <div className="sx-panel">
                <div className="sx-panel-head">
                    <span className="sx-row-icon"><Mail size={19} /></span>
                    <div style={{ minWidth: 0 }}>
                        <h4 className="sx-panel-title">Change email address</h4>
                        <p className="sx-panel-sub">We will send a code to the new address to prove it is yours.</p>
                    </div>
                </div>

                <Steps labels={['New email', 'Confirm code']} current={stepIndex} />

                {/* The envelope: where it is now -> where it is going. */}
                <div className="sx-envelope" aria-live="polite">
                    <div className="sx-env-line">
                        <span className="sx-env-tag">From</span>
                        <span className="sx-env-val is-old">{breakable(user?.email || '')}</span>
                    </div>
                    <div className="sx-env-line">
                        <span className="sx-env-tag">To</span>
                        <span className={`sx-env-val is-new${typed ? '' : ' is-empty'}${showBad ? ' is-bad' : ''}`}>
                            {typed || phase === 'code' ? (
                                <>
                                    {prefix && <span className="sx-seg-fixed">{breakable(prefix)}</span>}
                                    <span className="sx-seg-typed">{phase === 'code' ? sentTo.slice(prefix.length, sentTo.length - SUFFIX.length) : typed}</span>
                                    <wbr /><span className="sx-seg-fixed">{SUFFIX}</span>
                                    {typedOk && !sameAsNow && phase === 'form' && <span className="sx-env-ok"><CheckCircle2 size={15} /></span>}
                                </>
                            ) : (
                                isStudent ? `${prefix}firstname${SUFFIX}` : `yourname${SUFFIX}`
                            )}
                        </span>
                    </div>
                </div>

                {phase === 'form' && (
                    <form onSubmit={sendCode} noValidate>
                        {error && <Banner tone="error">{error}</Banner>}

                        <div className="sx-email-grid">
                            <div>
                                <div className="sx-field">
                                    <label htmlFor="new-email-part">New email <span className="ds-required">*</span></label>
                                    <div className={`sx-affix${showBad || fieldError ? ' is-bad' : ''}`}>
                                        {prefix && (
                                            <span className="sx-affix-pre" title={prefix}>
                                                <span className="sx-affix-lock"><Lock size={12} /></span>{prefix}
                                            </span>
                                        )}
                                        <input
                                            id="new-email-part"
                                            name="new_email_part"
                                            type="text"
                                            inputMode="email"
                                            autoComplete="email"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            spellCheck={false}
                                            autoFocus
                                            placeholder={isStudent ? 'firstname' : 'yourname'}
                                            value={typed}
                                            onChange={handleTyped}
                                            aria-invalid={showBad || !!fieldError || undefined}
                                            aria-describedby="new-email-hint"
                                        />
                                        <span className="sx-affix-suf">{SUFFIX}</span>
                                    </div>
                                    {fieldError
                                        ? <p className="sx-error">{fieldError}</p>
                                        : <p className="sx-hint" id="new-email-hint">
                                            {isStudent
                                                ? <>School format: <b>occ.{lastSeg || 'lastname'}.firstname</b>@gmail.com. Numbers after your first name are optional.</>
                                                : <>Any Gmail address you can open. Just type the part before @gmail.com.</>}
                                        </p>}
                                    {suggestion && typed !== suggestion && (
                                        <button type="button" className="sx-suggest" onClick={() => { setTyped(suggestion); setFieldError(''); }}>
                                            <Sparkles size={13} /> Use <code>{prefix}{suggestion}</code>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <PasswordField
                                    id="email-change-password"
                                    label="Current password"
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(''); setPasswordError(''); }}
                                    show={showPassword}
                                    onToggle={() => setShowPassword((v) => !v)}
                                    autoComplete="current-password"
                                    hint="Type it yourself. Autofill and paste are turned off for your safety."
                                    manual
                                    error={passwordError}
                                />
                            </div>
                        </div>

                        <Actions>
                            <button type="button" className="ds-btn ds-btn-secondary" onClick={close} disabled={loading}>Cancel</button>
                            <button type="submit" className="ds-btn ds-btn-primary" disabled={loading || !typed || !password}>
                                <ArrowRight size={15} /> {loading ? 'Sending…' : 'Send code'}
                            </button>
                        </Actions>
                    </form>
                )}

                {phase === 'code' && (
                    <form onSubmit={confirm} noValidate>
                        {error && <Banner tone="error">{error}</Banner>}

                        <div className="sx-sentto">
                            <Info size={17} />
                            <span>We sent a 6-digit code to <b>{breakable(sentTo)}</b>. It expires in {minutes} minutes. Check Spam if you do not see it.</span>
                        </div>

                        <div className="sx-field">
                            <label>Confirmation code <span className="ds-required">*</span></label>
                            <OtpInput value={code} onChange={(v) => { setCode(v); setError(''); }} invalid={!!error} disabled={loading} autoFocus />
                        </div>

                        <div className="sx-inline" style={{ marginBottom: 12 }}>
                            <button type="button" className="sx-linkbtn" onClick={sendCode} disabled={loading || wait > 0}>
                                {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
                            </button>
                            <button type="button" className="sx-linkbtn" onClick={useDifferent} disabled={loading}>
                                <ArrowLeft size={13} /> Use a different email
                            </button>
                        </div>

                        <Actions>
                            <button type="button" className="ds-btn ds-btn-secondary" onClick={close} disabled={loading}>Cancel</button>
                            <button type="submit" className="ds-btn ds-btn-primary" disabled={loading || code.length !== 6}>
                                {loading ? 'Checking…' : 'Confirm & change'}
                            </button>
                        </Actions>
                    </form>
                )}
            </div>
        </div>
    );
}
