import React, { useState } from 'react';
import QRCode from 'qrcode';
import {
    ShieldCheck, ShieldOff, Smartphone, Copy, Check, Eye, EyeOff,
    AlertTriangle, KeyRound, Download,
} from '../../../Components/icons';
import axios from '../../../config/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useDiscardConfirm } from '../../../context/ConfirmContext';

// Small copy-to-clipboard row, same visual language as ClaimDetail's
// CodeBox (release codes / tokens) — reused here for the manual-entry
// secret and each recovery code.
const CopyRow = ({ label, value }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (e) {
            // clipboard unavailable — silently ignore
        }
    };
    return (
        <div className="ds-code-box">
            <div className="ds-code-box-text">
                {label && <div className="ds-code-box-label">{label}</div>}
                <div className="ds-code-box-value">{value}</div>
            </div>
            <button type="button" className={`ds-code-copy ${copied ? 'is-copied' : ''}`} onClick={copy} aria-label={`Copy ${label || value}`}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
        </div>
    );
};

// Three phases live under one component so the "cancel" / discard-confirm
// handling is in one place: 'idle' (collapsed row) -> 'enroll' (QR + code
// entry) -> 'recovery' (one-time codes, shown exactly once) for turning
// 2FA on; a separate 'disable' phase (password confirm) for turning it off.
export default function TwoFactorAuthForm() {
    const { user, updateUser } = useAuth();
    const toast = useToast();
    const discardConfirm = useDiscardConfirm();
    const enabled = !!user?.two_factor_enabled;

    const [phase, setPhase] = useState('idle'); // idle | enroll | recovery | disable
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

    const reset = () => {
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
        if (!code.trim()) {
            setError('Enter the 6-digit code from your authenticator app.');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post('/2fa/confirm', { code: code.trim() }, { silent: true });
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
        reset();
        toast.success('Two-factor authentication is now on for your account.', { title: '2FA enabled' });
    };

    const downloadRecoveryCodes = () => {
        const blob = new Blob(
            [`SCLF recovery codes — ${user?.email || ''}\nGenerated ${new Date().toLocaleString()}\n\n${recoveryCodes.join('\n')}\n\nEach code works once. Keep this somewhere safe.\n`],
            { type: 'text/plain' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'sclf-recovery-codes.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
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

    // ---------- Collapsed row ----------
    if (phase === 'idle') {
        return (
            <div className="ds-security-row">
                <div className="ds-security-row-text">
                    <span className="ds-security-icon">
                        {enabled ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
                    </span>
                    <div>
                        <div className="ds-security-row-title">Two-factor authentication</div>
                        <div className="ds-security-row-meta">
                            {enabled ? 'On — an authenticator app code is required at sign-in' : 'Off'}
                        </div>
                    </div>
                </div>
                {enabled ? (
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setPhase('disable')}>
                        <ShieldOff size={15} /> Turn off
                    </button>
                ) : (
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={startEnroll} disabled={loading}>
                        <Smartphone size={15} /> {loading ? 'Starting…' : 'Set up 2FA'}
                    </button>
                )}
            </div>
        );
    }

    // ---------- Step 1: scan + verify ----------
    if (phase === 'enroll') {
        return (
            <form onSubmit={handleConfirm}>
                {error && <div className="ds-error">{error}</div>}

                <p className="ds-card-desc" style={{ marginBottom: 12 }}>
                    Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.),
                    then enter the 6-digit code it shows you.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 16px' }}>
                    {qrDataUrl && (
                        <img
                            src={qrDataUrl}
                            alt="Scan with your authenticator app"
                            width={200}
                            height={200}
                            style={{ borderRadius: 12, border: '1.5px solid rgba(128,128,128,0.25)' }}
                        />
                    )}
                </div>

                <div className="ds-field">
                    <label>Can't scan it? Enter this key manually</label>
                    <CopyRow value={showSecret ? secret : secret.replace(/./g, '•')} />
                    <button
                        type="button"
                        onClick={() => setShowSecret((v) => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0 0', fontSize: 12.5, opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                        {showSecret ? <EyeOff size={13} /> : <Eye size={13} />} {showSecret ? 'Hide key' : 'Show key'}
                    </button>
                </div>

                <div className="ds-field">
                    <label htmlFor="tfa-code">Verification code <span className="ds-required">*</span></label>
                    <input
                        id="tfa-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        value={code}
                        onChange={(e) => { setCode(e.target.value); setError(''); }}
                        aria-invalid={!!error}
                        autoFocus
                        required
                    />
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="submit" className="ds-btn ds-btn-primary" disabled={loading || !code.trim()}>
                        {loading ? 'Verifying…' : 'Verify & Enable'}
                    </button>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={handleCancelEnroll} disabled={loading}>
                        Cancel
                    </button>
                </div>
            </form>
        );
    }

    // ---------- Step 2: recovery codes (shown exactly once) ----------
    if (phase === 'recovery') {
        return (
            <div>
                <div className="ds-success" style={{ marginBottom: 14 }}>
                    <ShieldCheck size={16} />
                    Two-factor authentication is enabled.
                </div>

                <div className="ds-risk-banner" style={{ marginBottom: 14 }}>
                    <div className="ds-risk-banner-head">
                        <span className="ds-risk-banner-title"><AlertTriangle size={15} /> Save your recovery codes</span>
                    </div>
                    <p style={{ fontSize: 12.5, opacity: 0.85, margin: '0 0 4px' }}>
                        Each code works once and lets you sign in if you lose access to your authenticator app.
                        This is the only time they'll be shown — store them somewhere safe.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 14 }}>
                    {recoveryCodes.map((c) => (
                        <CopyRow key={c} value={c} />
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={downloadRecoveryCodes}>
                        <Download size={15} /> Download as .txt
                    </button>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: 0.85 }}>
                        <input type="checkbox" checked={savedAck} onChange={(e) => setSavedAck(e.target.checked)} />
                        I've saved these codes
                    </label>
                </div>

                <div style={{ marginTop: 14 }}>
                    <button type="button" className="ds-btn ds-btn-primary" onClick={finishRecovery} disabled={!savedAck}>
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // ---------- Disable ----------
    if (phase === 'disable') {
        return (
            <form onSubmit={handleDisable}>
                {error && <div className="ds-error">{error}</div>}
                <p className="ds-card-desc" style={{ marginBottom: 12 }}>
                    Turning this off means only your password will be needed to sign in. Enter your password to confirm.
                </p>

                <div className="ds-field">
                    <label htmlFor="tfa-disable-password">Current password <span className="ds-required">*</span></label>
                    <div className="ds-pwd-wrap">
                        <input
                            id="tfa-disable-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            autoComplete="current-password"
                            autoFocus
                            required
                        />
                        <button
                            type="button"
                            className="ds-pwd-toggle"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="submit" className="ds-btn ds-btn-primary" disabled={loading || !password}>
                        <KeyRound size={15} /> {loading ? 'Turning off…' : 'Turn off 2FA'}
                    </button>
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={reset} disabled={loading}>
                        Cancel
                    </button>
                </div>
            </form>
        );
    }

    return null;
}
