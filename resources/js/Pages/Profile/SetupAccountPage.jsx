import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
    filterNameInput,
    filterPhoneInput,
    filterStaffIdInput,
    normalizeEmailInput,
    isValidPhone,
    isValidStaffId,
    isValidEmail,
    FORMAT_ERRORS,
    FORMAT_HINTS,
} from '../../utils/validators';
import AuthShell, {
    LedgerRow,
    LedgerRowPair,
    LedgerInput,
    LedgerSelect,
    LedgerPasswordInput,
    LedgerBanner,
    StrengthTicks,
    PasswordMatchNote,
    LedgerButton,
    LedgerGhostButton,
} from '../../Components/shared/AuthShell';
import { User, Phone, VenetianMask, Lock, Camera, Check, IdCard, Mail, MapPin } from '../../Components/icons';

const GENDER_OPTIONS = [
    { value: '', label: 'Prefer not to say / skip' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const ROLE_LABELS = {
    admin: 'Admin',
    staff: 'Staff',
    security_officer: 'Security Officer',
    instructor: 'Instructor',
};

// What the ID number is called for each role on this form.
const ID_LABELS = {
    admin: 'Admin ID',
    staff: 'Staff ID',
    security_officer: 'Security Officer ID',
    instructor: 'Instructor ID',
};

const INITIAL_FORM = {
    first_name: '',
    last_name: '',
    staff_id: '',
    email: '',
    address: '',
    phone_number: '',
    gender: '',
    password: '',
    password_confirmation: '',
};

// Same "one folder tab per step" pattern as RegisterPage — kept to 3 steps
// since setup has fewer fields than registration. Each step's copy is
// generated with the account's role folded in (see buildStepMeta) so the
// rail still reads as tailored to "you", not a generic wizard.
const buildStepMeta = (roleLabel, idLabel, isAdmin) => [
    {
        key: 'identity',
        label: 'Identity',
        title: <>Welcome — let's confirm <span className="accent">you</span></>,
        subtitle: `This ${roleLabel} account was set up for you. Add your photo, name and your own ${idLabel}.`,
        railHeadline: 'One last entry before you\u2019re in.',
        railNote: `Whatever you set across this form — photo, name, ${idLabel}, password — replaces the placeholder details entered when the account was created.`,
    },
    {
        key: 'contact',
        label: 'Contact',
        title: <>How can we <span className="accent">reach you</span></>,
        subtitle: isAdmin
            ? 'Use your own email address — it is what you will sign in with. Phone, gender and address are optional.'
            : 'Optional, but helps staff and notifications reach the right person.',
        railHeadline: 'Stay reachable on campus.',
        railNote: isAdmin
            ? 'This replaces the placeholder email the system was installed with. Phone, gender and address are optional and can be updated later from your profile.'
            : 'Your phone number, gender and address are optional here and can always be updated later from your profile.',
    },
    {
        key: 'security',
        label: 'Security',
        title: <>Secure your <span className="accent">account</span></>,
        subtitle: 'Last step — set a password only you know, and you\u2019re in.',
        railHeadline: 'Last entry on the form.',
        railNote: 'This replaces the administrator\u2019s original password. They will not see your new one.',
    },
];

const TOTAL_STEPS = 3;

/**
 * Mandatory first-login gate for an admin-created staff account
 * (instructor / security_officer / admin). ProtectedRoute in RootApp.jsx
 * routes here automatically the moment user.must_setup_profile is true
 * and refuses to send the person anywhere else in the app until this
 * form succeeds — mirrored server-side by EnsureProfileSetupComplete, so
 * there's no way to skip it by hitting the API directly either.
 *
 * Built as a 3-step wizard (Identity -> Contact -> Security), the same
 * folder-tab pattern RegisterPage uses, instead of one long scrolling
 * form — keeps each screen short on any device and avoids the up/down
 * scrolling a single 6-field form caused on desktop.
 */
export default function SetupAccountPage() {
    const { user, roles, completeSetup, logout } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const cardTopRef = useRef(null);

    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        ...INITIAL_FORM,
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        // Prefilled with the placeholder the system generated (or the
        // seeded Admin ID) so the person only has to correct it.
        staff_id: user?.staff_id || '',
        email: user?.email || '',
        address: user?.address || '',
        phone_number: user?.phone_number || '',
        gender: user?.gender || '',
    });
    const [profileImage, setProfileImage] = useState(user?.profile_picture_url || null);
    const [profileFile, setProfileFile] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [banner, setBanner] = useState('');
    const [loading, setLoading] = useState(false);

    const primaryRole = roles?.find((r) => ROLE_LABELS[r]);
    const roleLabel = ROLE_LABELS[primaryRole] || 'Staff';
    const idLabel = ID_LABELS[primaryRole] || 'ID number';
    // Only the single seeded Admin may replace the email on this form.
    const isAdmin = !!roles?.includes('admin');
    const STEP_META = buildStepMeta(roleLabel, idLabel, isAdmin);
    const meta = STEP_META[step - 1];

    useEffect(() => {
        document.title = 'Complete Your Account | SCLF - Opol Community College';
    }, []);

    useEffect(() => {
        // Jump the (rare) internal scroll back to the top of the card
        // whenever the step changes, so the new step always starts in view
        // — same fix RegisterPage uses.
        cardTopRef.current?.scrollIntoView({ block: 'start' });
    }, [step]);

    // Guards against an accidental refresh/close mid-setup — same pattern
    // RegisterPage uses, since the admin-set password on the account
    // until this submits is functionally a "lost draft" too.
    const isDirty = form.password !== '' || form.password_confirmation !== '' || !!profileFile;
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let next = value;
        if (name === 'first_name' || name === 'last_name') next = filterNameInput(value);
        if (name === 'phone_number') next = filterPhoneInput(value);
        if (name === 'staff_id') next = filterStaffIdInput(value);
        if (name === 'email') next = normalizeEmailInput(value);
        setForm((prev) => ({ ...prev, [name]: next }));
        setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    };

    const handlePickPhoto = () => fileInputRef.current?.click();

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please choose an image file for your profile picture.');
            return;
        }
        if (file.size / 1024 / 1024 > 5) {
            toast.error('Profile picture must be smaller than 5MB.');
            return;
        }

        setProfileFile(file);
        const reader = new FileReader();
        reader.onload = () => setProfileImage(reader.result);
        reader.readAsDataURL(file);
    };

    const hasMinLength = form.password.length >= 8;
    const hasUppercase = /[A-Z]/.test(form.password);
    const hasLowercase = /[a-z]/.test(form.password);
    const hasNumber = /[0-9]/.test(form.password);
    const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;
    const passwordsMatch = form.password === form.password_confirmation && form.password_confirmation.length > 0;

    const goBack = () => {
        setFieldErrors({});
        setBanner('');
        setStep((s) => Math.max(1, s - 1));
    };

    const jumpTo = (target) => {
        // Only allow jumping to steps already completed — never skip ahead,
        // same rule RegisterPage's tab strip follows.
        if (target < step) {
            setFieldErrors({});
            setBanner('');
            setStep(target);
        }
    };

    // Per-step checks the browser's own HTML5 "required" validation can't
    // express. Returns true only when the step is completely clear to
    // advance past.
    const validateStep = () => {
        const nextFieldErrors = {};

        if (step === 1) {
            if (!profileFile) {
                toast.error('Please upload a profile picture so staff can verify you at a glance.', { title: 'Photo required' });
                return false;
            }
            if (!form.first_name.trim()) nextFieldErrors.first_name = 'First name is required.';
            if (!form.last_name.trim()) nextFieldErrors.last_name = 'Last name is required.';
            if (!form.staff_id.trim()) nextFieldErrors.staff_id = `${idLabel} is required.`;
            else if (!isValidStaffId(form.staff_id)) nextFieldErrors.staff_id = FORMAT_ERRORS.staffId;
        }

        if (step === 2) {
            if (isAdmin) {
                if (!form.email.trim()) nextFieldErrors.email = 'Email address is required.';
                else if (!isValidEmail(form.email)) nextFieldErrors.email = FORMAT_ERRORS.genericEmail;
            }
            if (form.phone_number && !isValidPhone(form.phone_number)) {
                nextFieldErrors.phone_number = FORMAT_ERRORS.phone;
            }
        }

        setFieldErrors(nextFieldErrors);
        return Object.keys(nextFieldErrors).length === 0;
    };

    // The form only ever has the CURRENT step's fields mounted, so this
    // fires on Enter or clicking Next/Complete Setup either way, and only
    // advances once the visible step's own checks pass.
    const handleStepSubmit = async (e) => {
        e.preventDefault();
        setBanner('');

        const stepOk = validateStep();
        if (!stepOk) return;

        if (step < TOTAL_STEPS) {
            setStep((s) => s + 1);
            return;
        }

        // Final step — password checks the browser can't do on its own.
        if (!isPasswordValid) {
            setFieldErrors({ password: 'Use 8+ characters with an uppercase letter, a lowercase letter and a number.' });
            return;
        }
        if (!passwordsMatch) {
            setFieldErrors({ password_confirmation: 'Passwords do not match.' });
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            data.append('first_name', form.first_name);
            data.append('last_name', form.last_name);
            data.append('staff_id', form.staff_id);
            if (isAdmin) data.append('email', form.email);
            if (form.address.trim()) data.append('address', form.address.trim());
            if (form.phone_number) data.append('phone_number', form.phone_number);
            if (form.gender) data.append('gender', form.gender);
            data.append('password', form.password);
            data.append('password_confirmation', form.password_confirmation);
            data.append('profile_picture', profileFile);

            await completeSetup(data);

            toast.success("Your account is set up — welcome to SCLF!", { title: 'All set' });
            // This already is their welcome — don't stack a second
            // "Welcome" toast when the dashboard mounts.
            try { window.sessionStorage.removeItem('sclf-login-toast'); } catch (e) { /* ignore */ }
            // Same trick used after login/register: land on "/" and let
            // MainPage's role-based redirect (admin/security/instructor)
            // take it from there.
            navigate('/', { replace: true });
        } catch (err) {
            const errors = err.response?.data?.errors;
            if (errors) {
                setFieldErrors((prev) => ({
                    ...prev,
                    ...Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
                }));
                // Send them back to whichever step holds the conflicting
                // field, instead of leaving them stuck on step 3.
                if (errors.first_name || errors.last_name || errors.staff_id || errors.profile_picture) setStep(1);
                else if (errors.email || errors.address || errors.phone_number || errors.gender) setStep(2);
            }
            setBanner(
                (errors && Object.values(errors).flat()[0]) ||
                err.response?.data?.message ||
                'Something went wrong completing your account setup. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleWrongAccount = async (e) => {
        e.preventDefault();
        await logout();
        navigate('/login', { replace: true });
    };

    const tabs = STEP_META.map((s, idx) => {
        const n = idx + 1;
        const isDone = n < step;
        const isActive = n === step;
        return (
            <button
                type="button"
                key={s.key}
                className={`lg-folder-tab${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
                onClick={() => jumpTo(n)}
                disabled={n >= step}
                aria-current={isActive ? 'step' : undefined}
            >
                <span className="n">{isDone ? <Check size={11} strokeWidth={3} /> : String(n).padStart(2, '0')}</span>
                {s.label}
            </button>
        );
    });

    return (
        <AuthShell
            wide
            compact
            docType="ACCOUNT SETUP"
            caseSeed="SETUP"
            tabs={tabs}
            title={meta.title}
            subtitle={meta.subtitle}
            railHeadline={meta.railHeadline}
            railNote={meta.railNote}
            footer={
                <p style={{ fontSize: 12.5, textAlign: 'center', margin: 0 }}>
                    Signed in as {user?.email}.{' '}
                    <a href="#" onClick={handleWrongAccount}>Not you? Log out</a>
                </p>
            }
        >
            <div ref={cardTopRef} />

            <form onSubmit={handleStepSubmit} noValidate>
                {banner && <LedgerBanner tone="error">{banner}</LedgerBanner>}

                <div key={step} className="rp-step-panel">
                    {step === 1 && (
                        <>
                            <LedgerRow index={1} label={<>Profile photo <span className="lg-required">*</span></>} icon={Camera}>
                                <div className="lg-avatar-row">
                                    <div className="lg-avatar-frame" onClick={handlePickPhoto} role="button" tabIndex={0} aria-required="true">
                                        {profileImage ? (
                                            <img src={profileImage} alt="Profile preview" />
                                        ) : (
                                            <Camera size={18} strokeWidth={1.75} style={{ opacity: 0.5 }} />
                                        )}
                                    </div>
                                    <div className="lg-avatar-actions">
                                        <button type="button" className="lg-avatar-btn" onClick={handlePickPhoto}>
                                            {profileImage ? 'Change photo' : 'Upload photo'}
                                        </button>
                                        <span className="lg-row-hint" style={{ marginTop: 0 }}>Square image, max 5MB. Required so staff can verify you.</span>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            </LedgerRow>

                            <LedgerRowPair index={2}>
                                <div>
                                    <label className="lg-row-label"><User size={12} strokeWidth={2.5} /> First name <span className="lg-required">*</span></label>
                                    <LedgerInput
                                        name="first_name"
                                        value={form.first_name}
                                        onChange={handleChange}
                                        autoComplete="given-name"
                                        aria-invalid={!!fieldErrors.first_name}
                                        autoFocus
                                        required
                                    />
                                    {fieldErrors.first_name && <span className="lg-row-hint lg-row-error-text">{fieldErrors.first_name}</span>}
                                </div>
                                <div>
                                    <label className="lg-row-label"><User size={12} strokeWidth={2.5} /> Last name <span className="lg-required">*</span></label>
                                    <LedgerInput
                                        name="last_name"
                                        value={form.last_name}
                                        onChange={handleChange}
                                        autoComplete="family-name"
                                        aria-invalid={!!fieldErrors.last_name}
                                        required
                                    />
                                    {fieldErrors.last_name && <span className="lg-row-hint lg-row-error-text">{fieldErrors.last_name}</span>}
                                </div>
                            </LedgerRowPair>

                            <LedgerRow
                                index={3}
                                label={<>{idLabel} <span className="lg-required">*</span></>}
                                icon={IdCard}
                                hint={!fieldErrors.staff_id ? `${FORMAT_HINTS.staffId} Change the one shown if it isn't yours.` : undefined}
                                error={fieldErrors.staff_id}
                            >
                                <LedgerInput
                                    name="staff_id"
                                    value={form.staff_id}
                                    onChange={handleChange}
                                    autoComplete="off"
                                    placeholder="e.g. ADMIN-09874589"
                                    aria-invalid={!!fieldErrors.staff_id}
                                    required
                                />
                            </LedgerRow>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            {isAdmin && (
                                <LedgerRow
                                    index={1}
                                    label={<>Email address <span className="lg-required">*</span></>}
                                    icon={Mail}
                                    hint={!fieldErrors.email ? 'You will sign in with this email from now on.' : undefined}
                                    error={fieldErrors.email}
                                >
                                    <LedgerInput
                                        type="email"
                                        name="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        autoComplete="email"
                                        aria-invalid={!!fieldErrors.email}
                                        autoFocus
                                        required
                                    />
                                </LedgerRow>
                            )}

                            <LedgerRow
                                index={isAdmin ? 2 : 1}
                                label="Phone number"
                                icon={Phone}
                                hint={!fieldErrors.phone_number ? 'Optional — 09171234567 format.' : undefined}
                                error={fieldErrors.phone_number}
                            >
                                <LedgerInput
                                    name="phone_number"
                                    value={form.phone_number}
                                    onChange={handleChange}
                                    inputMode="numeric"
                                    autoComplete="tel"
                                    placeholder="09XXXXXXXXX"
                                    aria-invalid={!!fieldErrors.phone_number}
                                    autoFocus={!isAdmin}
                                />
                            </LedgerRow>

                            <LedgerRow index={isAdmin ? 3 : 2} label="Gender" icon={VenetianMask} hint="Optional.">
                                <LedgerSelect name="gender" value={form.gender} onChange={handleChange}>
                                    {GENDER_OPTIONS.map((g) => (
                                        <option key={g.value} value={g.value}>{g.label}</option>
                                    ))}
                                </LedgerSelect>
                            </LedgerRow>

                            <LedgerRow index={isAdmin ? 4 : 3} label="Address" icon={MapPin} hint="Optional." error={fieldErrors.address}>
                                <LedgerInput
                                    name="address"
                                    value={form.address}
                                    onChange={handleChange}
                                    autoComplete="street-address"
                                    placeholder="Your current address"
                                />
                            </LedgerRow>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <LedgerRow
                                index={1}
                                label={<>New password <span className="lg-required">*</span></>}
                                icon={Lock}
                                error={fieldErrors.password}
                            >
                                <LedgerPasswordInput
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    show={showPassword}
                                    onToggle={() => setShowPassword((v) => !v)}
                                    autoComplete="new-password"
                                    aria-invalid={!!fieldErrors.password}
                                    autoFocus
                                    required
                                />
                                <StrengthTicks password={form.password} />
                            </LedgerRow>

                            <LedgerRow
                                index={2}
                                label={<>Confirm new password <span className="lg-required">*</span></>}
                                icon={Lock}
                                error={fieldErrors.password_confirmation}
                            >
                                <LedgerPasswordInput
                                    name="password_confirmation"
                                    value={form.password_confirmation}
                                    onChange={handleChange}
                                    show={showConfirm}
                                    onToggle={() => setShowConfirm((v) => !v)}
                                    autoComplete="new-password"
                                    aria-invalid={!!fieldErrors.password_confirmation}
                                    required
                                />
                                <PasswordMatchNote password={form.password} confirm={form.password_confirmation} />
                            </LedgerRow>

                        </>
                    )}
                </div>

                {/* ===== Step navigation ===== */}
                <div className="lg-actions-row" style={{ marginTop: 10 }}>
                    {step > 1 && (
                        <LedgerGhostButton onClick={goBack}>Back</LedgerGhostButton>
                    )}
                    <LedgerButton type="submit" disabled={loading}>
                        {step < TOTAL_STEPS
                            ? 'Next Entry'
                            : (loading ? 'Saving…' : 'Complete Setup & Continue')}
                    </LedgerButton>
                </div>
            </form>

            <style>{`
                .rp-step-panel { width: 100%; animation: lg-rise 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
            `}</style>
        </AuthShell>
    );
}
