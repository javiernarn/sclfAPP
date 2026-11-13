import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
    ShieldCheck, ShieldOff, Smartphone, Copy, Check, Eye, EyeOff,
    AlertTriangle, KeyRound, Download,
} from '../../../Components/icons';
import axios from '../../../config/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useDiscardConfirm } from '../../../context/ConfirmContext';
import { PasswordField, OtpInput, Steps, Banner, Actions } from './SecurityParts';
import { saveText, saveBlob, copyText, codesToPngBlob } from '../../../utils/saveFile';

// Copy button used by the manual key and each recovery code.
const CopyBtn = ({ value, label }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        if (await copyText(value)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };
    return (
        <button type="button" className={`sx-icon-btn${copied ? ' is-copied' : ''}`} onClick={copy} aria-label={`Copy ${label}`}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
    );
};

// Phases: idle (collapsed) -> enroll (QR + code) -> recovery (shown once);
// plus disable (password confirm). Layout: phone = single column, laptop =
// QR on the left and the steps on the right.
export default function TwoFactorAuthForm() {
    const { user, updateUser } = useAuth();
    const toast = useToast();
    const discardConfirm = useDiscardConfirm();
    const enabled = !!user?.two_factor_enabled;

    const [phase, setPhase] = useState('idle'); // idle | enroll | recovery | disable | regen
    const [isRegen, setIsRegen] = useState(false);
    const [remaining, setRemaining] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Enrollment state
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [code, setCode] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState([]);
    const [savedAck, setSavedAck] = useState(false);

    // Disable state
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // How many recovery codes are still unused (shown on the collapsed row).
    const loadStatus = async () => {
        try {
            const res = await axios.get('/2fa/status', { silent: true });
            setRemaining(res.data.recovery_codes_remaining);
        } catch (e) { /* non-critical */ }
    };
    useEffect(() => { if (enabled && phase === 'idle') loadStatus(); }, [enabled, phase]);

    const reset = () => {
        setIsRegen(false);
        setPhase('idle');
        setError('');
        setQrDataUrl('');
        setSecret('');
        setShowSecret(false);
        setCode('');
        setRecoveryCodes([]);
        setSavedAck(false);
        setPassword('');
        setShowPassword(false);
    };

    const startEnroll = async () => {
        setError('');
        setLoading(true);
        try {
            const res = await axios.post('/2fa/setup', {}, { silent: true });
            const dataUrl = await QRCode.toDataURL(res.data.otpauth_uri, {
                errorCorrectionLevel: 'M',
                margin: 1,
                width: 220,
            });
            setSecret(res.data.secret);
            setQrDataUrl(dataUrl);
            setPhase('enroll');
        } catch (err) {
            const message = err.response?.data?.message || 'Could not start 2FA setup. Please try again.';
            toast.error(message, { title: 'Setup failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (e) => {
        e.preventDefault();
        setError('');
        if (code.length !== 6) {
            setError('Enter the 6-digit code from your authenticator app.');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post('/2fa/confirm', { code }, { silent: true });
            setRecoveryCodes(res.data.recovery_codes || []);
            setPhase('recovery');
            updateUser({ two_factor_enabled: true });
        } catch (err) {
            const message = err.response?.data?.errors?.code?.[0]
                || err.response?.data?.message
                || 'That code is invalid or has expired.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const finishRecovery = () => {
        const wasRegen = isRegen;
        reset();
        if (wasRegen) toast.success('Your new recovery codes are active. The old ones no longer work.', { title: 'Recovery codes replaced' });
        else toast.success('Two-factor authentication is now on for your account.', { title: '2FA enabled' });
    };

    const handleRegen = async (e) => {
        e.preventDefault();
        setError('');
        if (!password) {
            setError('Enter your current password to confirm.');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post('/2fa/recovery-codes', { password }, { silent: true });
            setRecoveryCodes(res.data.recovery_codes || []);
            setPassword('');
            setShowPassword(false);
            setIsRegen(true);
            setPhase('recovery');
        } catch (err) {
            setError(err.response?.data?.errors?.password?.[0]
                || err.response?.data?.message
                || 'Could not create new recovery codes. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const codesText = () =>
        `SCLF recovery codes — ${user?.email || ''}\nGenerated ${new Date().toLocaleString()}\n\n${recoveryCodes.join('\n')}\n\nEach code works once. Keep this somewhere safe.\n`;

    // Opens the phone's share sheet ("Save to Files", AirDrop, Drive…) instead of
    // the iOS text preview; desktop gets a normal download.
    const downloadRecoveryCodes = async () => {
        const result = await saveText(codesText(), 'sclf-recovery-codes.txt', { title: 'SCLF recovery codes' });
        if (result === 'downloaded') toast.success('Saved to your Downloads.', { title: 'Recovery codes' });
    };

    const saveCodesImage = async () => {
        const blob = await codesToPngBlob({
            title: 'SCLF recovery codes',
            subtitle: user?.email || '',
            codes: recoveryCodes,
            footer: 'Each code works once. Keep this somewhere safe.',
        });
        if (!blob) return;
        const result = await saveBlob(blob, 'sclf-recovery-codes.png', { title: 'SCLF recovery codes' });
        if (result === 'downloaded') toast.success('Saved to your Downloads.', { title: 'Recovery codes' });
    };

    const copyAllCodes = async () => {
        if (await copyText(recoveryCodes.join('\n'))) toast.success('All codes copied.', { title: 'Recovery codes' });
        else toast.error('Could not copy. Use Save instead.');
    };

    const handleCancelEnroll = async () => {
        const ok = await discardConfirm(true, {
            message: "You haven't finished setting up two-factor authentication. If you close this now, you'll need to start over.",
        });
        if (!ok) return;
        reset();
    };

    const handleDisable = async (e) => {
        e.preventDefault();
        setError('');
        if (!password) {
            setError('Enter your current password to confirm.');
            return;
        }
        setLoading(true);
        try {
            await axios.post('/2fa/disable', { password }, { silent: true });
            updateUser({ two_factor_enabled: false });
            reset();
            toast.info('Two-factor authentication has been turned off.');
        } catch (err) {
            const message = err.response?.data?.errors?.password?.[0]
                || err.response?.data?.message
                || 'Failed to disable two-factor authentication. Please try again.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const header = (title, sub, Icon = ShieldCheck) => (
        <div className="sx-panel-head">
            <span className="sx-row-icon"><Icon size={19} /></span>
            <div style={{ minWidth: 0 }}>
                <h4 className="sx-panel-title">{title}</h4>
                {sub && <p className="sx-panel-sub">{sub}</p>}
            </div>
        </div>
    );

    // ---------- Collapsed row ----------
    if (phase === 'idle') {
        return (
            <div className="sx-root">
                <div className="sx-row">
                    <div className="sx-row-main">
                        <span className="sx-row-icon">{enabled ? <ShieldCheck size={19} /> : <ShieldOff size={19} />}</span>
                        <div style={{ minWidth: 0 }}>
                            <div className="sx-row-title">Two-factor authentication</div>
                            <div className={`sx-row-meta${enabled ? ' is-on' : ''}`}>
                                {enabled ? 'On — a code from your authenticator app is needed at sign-in' : 'Off — add a second step when you sign in'}
                            </div>
                            {enabled && remaining !== null && (
                                <div className="sx-row-meta" style={remaining <= 2 ? { color: '#b45309' } : undefined}>
                                    {remaining === 0
                                        ? 'No recovery codes left — create new ones now.'
                                        : `${remaining} recovery code${remaining === 1 ? '' : 's'} left${remaining <= 2 ? ' — create new ones soon' : ''}`}
                                </div>
                            )}
                        </div>
                    </div>
                    {enabled ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setPhase('regen')}>
                                <KeyRound size={15} /> New recovery codes
                            </button>
                            <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setPhase('disable')}>
                                <ShieldOff size={15} /> Turn off
                            </button>
                        </div>
                    ) : (
                        <button type="button" className="ds-btn ds-btn-secondary" onClick={startEnroll} disabled={loading}>
                            <Smartphone size={15} /> {loading ? 'Starting…' : 'Set up 2FA'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ---------- Step 1: scan + verify ----------
    if (phase === 'enroll') {
        return (
            <form className="sx-root sx-panel" onSubmit={handleConfirm} noValidate>
                {header('Set up two-factor authentication', 'Use an authenticator app such as Google Authenticator, Authy or 1Password.', Smartphone)}
                <Steps labels={['Scan', 'Verify', 'Save codes']} current={0} />
                {error && <Banner tone="error">{error}</Banner>}

                <div className="sx-tfa-grid">
                    <div>
                        <div className="sx-qr">
                            {qrDataUrl && <img src={qrDataUrl} alt="QR code to scan with your authenticator app" width={220} height={220} />}
                        </div>
                    </div>

                    <div style={{ minWidth: 0 }}>
                        <ol className="sx-howto">
                            <li><span>Open your authenticator app and choose <b>Add account</b>.</span></li>
                            <li><span>Scan the QR code. On this phone? Use the key below instead.</span></li>
                            <li><span>Type the 6-digit code the app shows.</span></li>
                        </ol>

                        <div className="sx-field">
                            <label>Setup key</label>
                            <div className="sx-key">
                                <code>{showSecret ? secret : secret.replace(/./g, '•')}</code>
                                <button type="button" className="sx-icon-btn" onClick={() => setShowSecret((v) => !v)} aria-label={showSecret ? 'Hide key' : 'Show key'}>
                                    {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                                <CopyBtn value={secret} label="setup key" />
                            </div>
                        </div>

                        <div className="sx-field">
                            <label>6-digit code <span className="ds-required">*</span></label>
                            <OtpInput value={code} onChange={(v) => { setCode(v); setError(''); }} invalid={!!error} disabled={loading} autoFocus />
                        </div>
                    </div>
                </div>

                <Actions>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={handleCancelEnroll} disabled={loading}>Cancel</button>
                    <button type="submit" className="ds-btn ds-btn-primary" disabled={loading || code.length !== 6}>
                        {loading ? 'Verifying…' : 'Verify & enable'}
                    </button>
                </Actions>
            </form>
        );
    }

    // ---------- Step 2: recovery codes (shown exactly once) ----------
    if (phase === 'recovery') {
        return (
            <div className="sx-root sx-panel">
                {header(isRegen ? 'New recovery codes' : 'Two-factor is on', isRegen ? 'Your old codes no longer work.' : 'One last thing: keep your recovery codes.')}
                <Steps labels={['Scan', 'Verify', 'Save codes']} current={2} />

                <Banner tone="warn">
                    <AlertTriangle size={16} />
                    <span><b>Save these codes now.</b> Each works once if you lose your authenticator app. They are shown only this one time.</span>
                </Banner>

                <div className="sx-codes">
                    {recoveryCodes.map((c) => (
                        <div className="sx-code-chip" key={c}>
                            <code>{c}</code>
                            <CopyBtn value={c} label="recovery code" />
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={downloadRecoveryCodes}>
                        <Download size={15} /> Save file
                    </button>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={saveCodesImage}>
                        <Download size={15} /> Save as image
                    </button>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={copyAllCodes}>
                        <Copy size={15} /> Copy all
                    </button>
                </div>

                <label className="sx-check">
                    <input name="saved_ack" type="checkbox" checked={savedAck} onChange={(e) => setSavedAck(e.target.checked)} />
                    <span>I have saved these codes somewhere safe</span>
                </label>

                <Actions>
                    <button type="button" className="ds-btn ds-btn-primary" onClick={finishRecovery} disabled={!savedAck}>Done</button>
                </Actions>
            </div>
        );
    }

    // ---------- Regenerate recovery codes ----------
    if (phase === 'regen') {
        return (
            <form className="sx-root sx-panel" onSubmit={handleRegen} noValidate>
                {header('Create new recovery codes?', 'Your old codes will stop working immediately.', KeyRound)}
                {error && <Banner tone="error">{error}</Banner>}
                <PasswordField
                    id="tfa-regen-password"
                    label="Current password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    autoComplete="current-password"
                    autoFocus
                    hint="Type it yourself to confirm. Autofill and paste are turned off."
                    manual
                />
                <Actions>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={reset} disabled={loading}>Cancel</button>
                    <button type="submit" className="ds-btn ds-btn-primary" disabled={loading || !password}>
                        {loading ? 'Creating…' : 'Create new codes'}
                    </button>
                </Actions>
            </form>
        );
    }

    // ---------- Disable ----------
    if (phase === 'disable') {
        return (
            <form className="sx-root sx-panel" onSubmit={handleDisable} noValidate>
                {header('Turn off two-factor?', 'Only your password will be needed to sign in.', ShieldOff)}
                {error && <Banner tone="error">{error}</Banner>}

                <PasswordField
                    id="tfa-disable-password"
                    label="Current password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    autoComplete="current-password"
                    autoFocus
                    hint="Type it yourself to confirm. Autofill and paste are turned off."
                    manual
                />

                <Actions>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={reset} disabled={loading}>Cancel</button>
                    <button type="submit" className="ds-btn ds-btn-primary" disabled={loading || !password}>
                        <KeyRound size={15} /> {loading ? 'Turning off…' : 'Turn off 2FA'}
                    </button>
                </Actions>
            </form>
        );
    }

    return null;
}
