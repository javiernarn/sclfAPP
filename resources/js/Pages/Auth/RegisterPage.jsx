import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Tooltip from '../../Components/shared/Tooltip';
import {
    filterNameInput,
    filterPhoneInput,
    filterStudentIdInput,
    normalizeEmailInput,
    isValidPhone,
    isValidStudentId,
    isValidSchoolEmail,
    humanizeValidationErrors,
    FORMAT_HINTS,
    FORMAT_ERRORS,
} from '../../utils/validators';
import { checkAvailability } from '../../utils/availability';
import AuthShell, {
    LedgerRow,
    LedgerRowPair,
    LedgerInput,
    LedgerSelect,
    LedgerPasswordInput,
    LedgerBanner,
    LedgerButton,
    LedgerGhostButton,
    StrengthTicks,
    RequirementChecklist,
    PasswordMatchNote,
} from '../../Components/shared/AuthShell';
import {
    User,
    Mail,
    Phone,
    MapPin,
    IdCard,
    GraduationCap,
    Lock,
    Camera,
    Check,
    Info,
} from 'lucide-react';

const COURSES = [
   'BSIT — Bachelor of Science in Information Technology',
    // 'BSCS — Bachelor of Science in Computer Science',
    'BSBA — Bachelor of Science in Business Administration (Major in M.M)',
    'BSBA — Bachelor of Science in Business Administration (Major in F.M)',
    'BEED — Bachelor of Elementary Education',
    'BSEd — Bachelor of Secondary Education (Major in English)',
];

const INITIAL_FORM = {
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    address: '',
    gender: '',
    student_id: '',
    course: '',
    password: '',
    password_confirmation: '',
};

// Each step maps to one "folder tab" in the record card header. The rail
// copy (headline/note) doubles as the step's framing, same way a case
// file's cover sheet explains what's inside before you open it.
const STEP_META = [
    {
        key: 'basic',
        label: 'Identity',
        title: <>Let's start with <span className="accent">you</span></>,
        subtitle: 'A quick photo and your name — this is how the campus will know you.',
        railHeadline: 'Every case file starts with a name.',
        railNote: 'Your name and photo let staff match you to your reports at a glance.',
    },
    {
        key: 'contact',
        label: 'Contact',
        title: <>How can we <span className="accent">reach you</span></>,
        subtitle: 'So we can notify you the moment someone finds your item.',
        railHeadline: 'A record only works if we can reach you.',
        railNote: "Your contact details are used only for case updates — never shared outside the registrar's desk.",
    },
    {
        key: 'academic',
        label: 'Academic',
        title: <>Your <span className="accent">academic</span> details</>,
        subtitle: 'Helps campus staff verify your report faster.',
        railHeadline: 'Verification, made faster.',
        railNote: 'Your student ID and course let staff confirm your record without extra back-and-forth.',
    },
    {
        key: 'security',
        label: 'Security',
        title: <>Secure your <span className="accent">account</span></>,
        subtitle: "Last entry — set a strong password and your file is complete.",
        railHeadline: 'Last entry on the form.',
        railNote: 'A strong password keeps your case history and personal details locked to you alone.',
    },
];

const TOTAL_STEPS = STEP_META.length;

export default function RegisterPage() {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(INITIAL_FORM);
    const [profileImage, setProfileImage] = useState(null); // preview data URL
    const [profileFile, setProfileFile] = useState(null); // actual File
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [checking, setChecking] = useState(false);
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const cardTopRef = useRef(null);

    useEffect(() => {
        document.title = 'Register | SCLF - Opol Community College';
    }, []);

    useEffect(() => {
        // Jump the (rare) internal scroll back to the top of the card
        // whenever the step changes, so the new step always starts in view.
        cardTopRef.current?.scrollIntoView({ block: 'start' });
    }, [step]);

    // Guards accidental data loss: closing the tab, refreshing, or hitting
    // the browser Back button mid-registration triggers the browser's own
    // "leave site?" prompt once any field has been touched.
    const isDirty = Object.entries(form).some(([key, value]) => value !== INITIAL_FORM[key]);
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
        if (name === 'student_id') next = filterStudentIdInput(value);
        if (name === 'email') next = normalizeEmailInput(value);
        setForm((prev) => ({ ...prev, [name]: next }));
        // As soon as they change a field that was flagged (e.g. "already
        // in use"), clear that specific error — it's no longer stale once
        // the value itself has changed.
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

    const removePhoto = () => {
        setProfileImage(null);
        setProfileFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Password requirement checks
    const hasMinLength = form.password.length >= 8;
    const hasUppercase = /[A-Z]/.test(form.password);
    const hasLowercase = /[a-z]/.test(form.password);
    const hasNumber = /[0-9]/.test(form.password);
    const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;
    const passwordsMatch = form.password === form.password_confirmation && form.password_confirmation.length > 0;

    const goBack = () => {
        setFieldErrors({});
        setStep((s) => Math.max(1, s - 1));
    };

    const jumpTo = (target) => {
        // Only allow jumping to steps already completed — never skip ahead.
        if (target < step) {
                setFieldErrors({});
            setStep(target);
        }
    };

    // Per-step checks the browser's own HTML5 "required" validation can't
    // express — both the field SHAPE (regex format) and, critically,
    // whether it's already registered to someone else. Returns true only
    // when the step is completely clear to advance past.
    const validateStep = async () => {
        const nextFieldErrors = {};

        if (step === 1) {
            if (!profileFile) {
                toast.error('Please upload a profile picture before continuing.', { title: 'Photo required' });
                return false;
            }
        }

        if (step === 2) {
            if (!isValidSchoolEmail(form.email)) nextFieldErrors.email = FORMAT_ERRORS.email;
            if (!isValidPhone(form.phone_number)) nextFieldErrors.phone_number = FORMAT_ERRORS.phone;

            // Don't bother hitting the network for a field that's already
            // known to be malformed — fix the shape first.
            if (Object.keys(nextFieldErrors).length > 0) {
                setFieldErrors(nextFieldErrors);
                return false;
            }

            setChecking(true);
            const [emailAvailable, phoneAvailable] = await Promise.all([
                checkAvailability('email', form.email),
                checkAvailability('phone_number', form.phone_number),
            ]);
            setChecking(false);

            if (!emailAvailable) nextFieldErrors.email = 'This email address is already in use by another account.';
            if (!phoneAvailable) nextFieldErrors.phone_number = 'This phone number is already linked to another account.';
        }

        if (step === 3) {
            if (!isValidStudentId(form.student_id)) {
                setFieldErrors({ student_id: FORMAT_ERRORS.studentId });
                return false;
            }

            setChecking(true);
            const studentIdAvailable = await checkAvailability('student_id', form.student_id);
            setChecking(false);

            if (!studentIdAvailable) nextFieldErrors.student_id = 'This student ID is already registered to another account.';
        }

        setFieldErrors(nextFieldErrors);
        if (Object.keys(nextFieldErrors).length > 0) {
            toast.error('This step has an account already using that information — please use a different value.', { title: 'Already in use' });
            return false;
        }
        return true;
    };

    // The form only ever has the CURRENT step's fields mounted, so native
    // HTML5 "required" validation naturally scopes itself to that step —
    // pressing Enter or clicking Next/Create Account both fire this the
    // same way, and only after the browser confirms the visible fields
    // are valid.
    const handleStepSubmit = async (e) => {
        e.preventDefault();

        const stepOk = await validateStep();
        if (!stepOk) return;

        if (step < TOTAL_STEPS) {
            setStep((s) => s + 1);
            return;
        }

        // Final step — extra cross-field checks the browser can't do.
        if (!isPasswordValid) {
            setFieldErrors((prev) => ({ ...prev, password: 'Password does not meet the requirements below.' }));
            return;
        }
        if (!passwordsMatch) {
            setFieldErrors((prev) => ({ ...prev, password_confirmation: 'Passwords do not match.' }));
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            Object.entries(form).forEach(([key, value]) => data.append(key, value));
            if (profileFile) data.append('profile_picture', profileFile);

            await register(data);
            toast.success('Welcome to SCLF! Your account has been created.', { title: 'Account created' });
            navigate('/', { replace: true });
        } catch (err) {
            const errors = err.response?.data?.errors;
            if (errors) {
                const messages = humanizeValidationErrors(errors);
                toast.error(messages.join('\n'), { title: 'Please check your details' });
                const perField = {};
                Object.entries(errors).forEach(([field, msgs]) => {
                    perField[field] = humanizeValidationErrors({ [field]: msgs })[0];
                });
                setFieldErrors(perField);
                // Send them back to whichever step holds the conflicting
                // field, instead of leaving them stuck on step 4.
                if (errors.email || errors.phone_number) setStep(2);
                else if (errors.student_id) setStep(3);
            } else {
                const message = err.response?.data?.message || 'Registration failed.';
                toast.error(message);
            }
        } finally {
            setLoading(false);
        }
    };

    const meta = STEP_META[step - 1];

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
            docType="NEW CASE FILE"
            caseSeed="REG"
            tabs={tabs}
            title={meta.title}
            subtitle={meta.subtitle}
            railHeadline={meta.railHeadline}
            railNote={meta.railNote}
            footer={<>Already have a record? <Link to="/login">Sign in instead</Link></>}
        >
            <div ref={cardTopRef} />

            <form onSubmit={handleStepSubmit} noValidate>
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
                                        {profileImage && (
                                            <button type="button" className="lg-avatar-btn danger" onClick={removePhoto}>
                                                Remove
                                            </button>
                                        )}
                                        <span className="lg-row-hint" style={{ marginTop: 0 }}>Square image, max 5MB. Required so staff can verify you.</span>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                        required
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            </LedgerRow>

                            <LedgerRowPair index={2}>
                                <div>
                                    <label className="lg-row-label"><User size={12} strokeWidth={2.5} /> First name <span className="lg-required">*</span></label>
                                    <LedgerInput
                                        id="first_name"
                                        name="first_name"
                                        value={form.first_name}
                                        onChange={handleChange}
                                        autoComplete="given-name"
                                        autoFocus
                                        required
                                        title={FORMAT_HINTS.name}
                                    />
                                </div>
                                <div>
                                    <label className="lg-row-label"><User size={12} strokeWidth={2.5} /> Last name <span className="lg-required">*</span></label>
                                    <LedgerInput
                                        id="last_name"
                                        name="last_name"
                                        value={form.last_name}
                                        onChange={handleChange}
                                        autoComplete="family-name"
                                        required
                                        title={FORMAT_HINTS.name}
                                    />
                                </div>
                            </LedgerRowPair>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <LedgerRow index={1} label={<>Email address <span className="lg-required">*</span></>} icon={Mail} hint={FORMAT_HINTS.email} error={fieldErrors.email}>
                                <LedgerInput
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    autoComplete="email"
                                    placeholder="occ.lastname.firstname@gmail.com"
                                    aria-invalid={!!fieldErrors.email}
                                    autoFocus
                                    required
                                />
                            </LedgerRow>

                            <LedgerRowPair index={2}>
                                <div>
                                    <label className="lg-row-label"><Phone size={12} strokeWidth={2.5} /> Phone number <span className="lg-required">*</span></label>
                                    <LedgerInput
                                        id="phone_number"
                                        name="phone_number"
                                        inputMode="numeric"
                                        value={form.phone_number}
                                        onChange={handleChange}
                                        autoComplete="tel"
                                        placeholder="09XXXXXXXXX"
                                        title={FORMAT_HINTS.phone}
                                        aria-invalid={!!fieldErrors.phone_number}
                                        required
                                    />
                                    {fieldErrors.phone_number && <span className="lg-row-hint lg-row-error-text">{fieldErrors.phone_number}</span>}
                                </div>
                                <div>
                                    <label className="lg-row-label">Gender <span className="lg-required">*</span></label>
                                    <div className="lg-radio-row">
                                        {[
                                            { value: 'male', label: 'Male' },
                                            { value: 'female', label: 'Female' },
                                            { value: 'other', label: 'Other' },
                                        ].map((opt) => (
                                            <label className="lg-radio" key={opt.value}>
                                                <input
                                                    type="radio"
                                                    name="gender"
                                                    value={opt.value}
                                                    checked={form.gender === opt.value}
                                                    onChange={handleChange}
                                                    required
                                                />
                                                {opt.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </LedgerRowPair>

                            <LedgerRow index={3} label={<>Current address <span className="lg-required">*</span></>} icon={MapPin}>
                                <LedgerInput
                                    id="address"
                                    name="address"
                                    value={form.address}
                                    onChange={handleChange}
                                    autoComplete="street-address"
                                    placeholder="Enter your complete address"
                                    required
                                />
                            </LedgerRow>
                        </>
                    )}

                    {step === 3 && (
                        <LedgerRowPair index={1}>
                            <div>
                                <label className="lg-row-label"><IdCard size={12} strokeWidth={2.5} /> Student ID <span className="lg-required">*</span></label>
                                <LedgerInput
                                    id="student_id"
                                    name="student_id"
                                    inputMode="numeric"
                                    value={form.student_id}
                                    onChange={handleChange}
                                    placeholder="2021-2-04062"
                                    title={FORMAT_HINTS.studentId}
                                    aria-invalid={!!fieldErrors.student_id}
                                    autoFocus
                                    required
                                />
                                {fieldErrors.student_id && <span className="lg-row-hint lg-row-error-text">{fieldErrors.student_id}</span>}
                            </div>
                            <div>
                                <label className="lg-row-label"><GraduationCap size={12} strokeWidth={2.5} /> Course <span className="lg-required">*</span></label>
                                <LedgerSelect id="course" name="course" value={form.course} onChange={handleChange} required>
                                    <option value="" disabled>Select your course</option>
                                    {COURSES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </LedgerSelect>
                            </div>
                        </LedgerRowPair>
                    )}

                    {step === 4 && (
                        <>
                            <LedgerRow index={1} label={<>Password <span className="lg-required">*</span></>} icon={Lock} error={fieldErrors.password}>
                                <LedgerPasswordInput
                                    id="password"
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    autoComplete="new-password"
                                    show={showPassword}
                                    onToggle={() => setShowPassword((v) => !v)}
                                    aria-invalid={!!fieldErrors.password}
                                    autoFocus
                                    required
                                />
                                <StrengthTicks password={form.password} />
                            </LedgerRow>

                            <LedgerRow index={2} label={<>Confirm password <span className="lg-required">*</span></>} icon={Lock} error={fieldErrors.password_confirmation}>
                                <LedgerPasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    value={form.password_confirmation}
                                    onChange={handleChange}
                                    autoComplete="new-password"
                                    show={showConfirm}
                                    onToggle={() => setShowConfirm((v) => !v)}
                                    aria-invalid={!!fieldErrors.password_confirmation}
                                    required
                                />
                                <PasswordMatchNote password={form.password} confirm={form.password_confirmation} />
                            </LedgerRow>

                            <RequirementChecklist password={form.password} />
                        </>
                    )}
                </div>

                {/* ===== Step navigation ===== */}
                <div className="lg-actions-row" style={{ marginTop: 18 }}>
                    {step > 1 && (
                        <LedgerGhostButton onClick={goBack}>Back</LedgerGhostButton>
                    )}
                    <LedgerButton disabled={loading || checking}>
                        {checking
                            ? 'Checking…'
                            : step < TOTAL_STEPS
                                ? 'Next Entry'
                                : (loading ? 'Filing record…' : 'Create Account')}
                    </LedgerButton>
                </div>
            </form>

            <style>{`
                .rp-step-panel { width: 100%; animation: lg-rise 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
            `}</style>
        </AuthShell>
    );
}
