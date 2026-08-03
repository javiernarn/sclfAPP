import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import AuthShell, {
    LedgerRow,
    LedgerPasswordInput,
    LedgerBanner,
    LedgerButton,
    StrengthTicks,
    RequirementChecklist,
    PasswordMatchNote,
    Stamp,
} from '../../Components/shared/AuthShell';
import { Lock } from 'lucide-react';

export default function ResetPassword() {
    const { token } = useParams();
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email') || '';
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        document.title = 'Reset Password | SCLF - Opol Community College';
    }, []);

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
            });
            setSuccess(true);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Failed to reset password. The link may have expired.'
            );
        } finally {
            setLoading(false);
        }
    };

    if (success) {
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
                <LedgerRow index={1} label="New password" icon={Lock}>
                    <LedgerPasswordInput
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        show={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                        required
                        autoFocus
                    />
                    <StrengthTicks password={password} />
                </LedgerRow>

                <LedgerRow index={2} label="Confirm password" icon={Lock}>
                    <LedgerPasswordInput
                        id="password_confirmation"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        show={showConfirm}
                        onToggle={() => setShowConfirm((v) => !v)}
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
