import React, { useEffect, useState } from 'react';
import { UserCircle, Mail, ShieldCheck, Moon, Sun, Phone, MapPin, VenetianMask, IdCard, GraduationCap, Bell, BellOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import usePushNotifications from '../../hooks/usePushNotifications';
import DashboardShell from '../../Components/shared/DashboardShell';
import ProfileSkeleton from '../../Components/shared/ProfileSkeleton';
import ChangePasswordForm from './Partials/ChangePasswordForm';
import TwoFactorAuthForm from './Partials/TwoFactorAuthForm';
import { useToast } from '../../context/ToastContext';

// One compact "field" block used inside the account-details grid — icon,
// small uppercase label, value. Several of these sit side by side per row
// (see .ds-info-grid), instead of the old one-per-row list that left a lot
// of empty space on anything wider than a phone.
const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="ds-info-item">
        <span className="ds-info-icon"><Icon size={16} /></span>
        <div className="ds-info-text">
            <div className="ds-info-label">{label}</div>
            <div className="ds-info-value">{value || '—'}</div>
        </div>
    </div>
);

export default function ProfilePage() {
    const { user, roles } = useAuth();
    const { theme, toggleTheme } = useAppTheme();
    const isDark = theme === 'black';
    const [pageLoading, setPageLoading] = useState(true);
    const toast = useToast();
    const push = usePushNotifications();

    useEffect(() => {
        document.title = "Profile | SCLF - Opol Community College";
    }, []);

    // Brief grid-shaped skeleton on first mount, same treatment as the
    // dashboard and the report form, so every page loads consistently.
    useEffect(() => {
        const t = setTimeout(() => setPageLoading(false), 450);
        return () => clearTimeout(t);
    }, []);

    const initials = (user?.name || '?')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('');

    const ROLE_LABELS = {
        admin: 'Administrator',
        security_officer: 'Security Officer',
        instructor: 'Instructor',
        student: 'Student',
    };
    const primaryRole = ['admin', 'security_officer', 'instructor', 'student']
        .find((r) => Array.isArray(roles) && roles.includes(r));
    const roleLabel = ROLE_LABELS[primaryRole] || 'Member';

    const genderLabels = {
        male: 'Male',
        female: 'Female',
        other: 'Other',
        prefer_not_to_say: 'Prefer not to say',
    };
    const genderLabel = user?.gender ? (genderLabels[user.gender] || user.gender) : '—';

    // Fields shown here are gated by role: a security officer or instructor
    // account never had a course/student address/student ID to begin
    // with, so those inputs are hidden entirely for them instead of
    // showing as empty dashes. Students see their self-chosen student_id;
    // staff/security/admin see their system-generated staff_id instead,
    // under a role-appropriate label.
    const isStudent = primaryRole === 'student';
    const ID_LABELS = {
        admin: 'Admin ID',
        security_officer: 'Security ID',
        instructor: 'Instructor ID',
        student: 'Student ID',
    };
    const idLabel = ID_LABELS[primaryRole] || 'ID Number';
    const idValue = isStudent ? user?.student_id : user?.staff_id;

    const handlePushToggle = async () => {
        if (push.subscribed) {
            await push.disable();
            toast.info('Push notifications turned off for this device.');
            return;
        }

        const result = await push.enable();
        if (result.status === 'subscribed') {
            toast.success('Push notifications are on for this device.');
        } else if (result.status === 'denied') {
            toast.warning('Notifications are blocked in your browser settings. Allow them for this site to turn this on.');
        } else if (result.status === 'unconfigured') {
            toast.error('Push notifications aren\'t set up on the server yet.');
        } else if (result.status === 'unsupported') {
            toast.error('This browser doesn\'t support push notifications.');
        }
    };

    return (
        <DashboardShell
            eyebrow="Account"
            title="Profile"
            subtitle="Your account details for SCLF."
        >
            {pageLoading ? (
                <ProfileSkeleton />
            ) : (
            <>
            {/* ---------- Hero: avatar + name + quick-glance chips ---------- */}
            <div className="ds-card" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <span
                    className="ds-avatar"
                    style={{
                        width: 64,
                        height: 64,
                        fontSize: 22,
                        borderRadius: 16,
                        backgroundImage: user?.profile_picture_url ? `url(${user.profile_picture_url})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                >
                    {!user?.profile_picture_url && (initials || <UserCircle size={28} />)}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{user?.name || 'Account'}</div>
                    <div style={{ fontSize: 13, opacity: 0.6 }}>{user?.email || ''}</div>
                    <div className="ds-chip-row">
                        <span className="ds-chip ds-chip-accent"><ShieldCheck size={12} /> {roleLabel}</span>
                        {idValue && <span className="ds-chip">{idLabel}: {idValue}</span>}
                        {isStudent && user?.course && <span className="ds-chip">{user.course}</span>}
                    </div>
                </div>
            </div>

            {/* ---------- Account details: compact grid, no dead rows ---------- */}
            <div className="ds-card">
                <div className="ds-card-title">Account details</div>
                <p className="ds-card-desc">Information tied to your SCLF account.</p>

                <div className="ds-info-grid">
                    <InfoItem icon={UserCircle} label="Full name" value={user?.name} />
                    <InfoItem icon={Mail} label="Email" value={user?.email} />
                    <InfoItem icon={Phone} label="Phone number" value={user?.phone_number} />
                    <InfoItem icon={VenetianMask} label="Gender" value={genderLabel} />
                    <InfoItem icon={IdCard} label={idLabel} value={idValue} />
                    {isStudent && <InfoItem icon={GraduationCap} label="Course" value={user?.course} />}
                    {isStudent && <InfoItem icon={MapPin} label="Address" value={user?.address} />}
                    <InfoItem icon={ShieldCheck} label="Role" value={roleLabel} />
                </div>
            </div>

            {/* ---------- Security: Change Password ---------- */}
            <div className="ds-card">
                <div className="ds-card-title">Security</div>
                <p className="ds-card-desc">Update your password or turn on two-factor authentication to keep your account secure.</p>
                <ChangePasswordForm />
                <hr className="ds-divider" />
                <TwoFactorAuthForm />
            </div>

            {/* ---------- Notifications ---------- */}
            <div className="ds-card">
                <div className="ds-card-title">Notifications</div>
                <p className="ds-card-desc">
                    Get an alert on this device the moment something changes — a claim update, a match, or an item
                    ready for pickup — even when SCLF isn't open in a tab. This is separate from email notifications,
                    which keep going either way.
                </p>

                {!push.supported && (
                    <p style={{ fontSize: 13, opacity: 0.65, margin: 0 }}>
                        This browser doesn't support push notifications.
                    </p>
                )}

                {push.supported && push.loading && <div className="ds-skeleton" style={{ height: 40 }} />}

                {push.supported && !push.loading && (
                    <button
                        type="button"
                        className={push.subscribed ? 'ds-btn ds-btn-secondary' : 'ds-btn ds-btn-primary'}
                        onClick={handlePushToggle}
                        disabled={push.busy}
                    >
                        {push.subscribed ? <BellOff size={16} /> : <Bell size={16} />}
                        {push.busy
                            ? 'Please wait…'
                            : push.subscribed
                                ? 'Turn off notifications on this device'
                                : 'Enable notifications on this device'}
                    </button>
                )}
            </div>

            {/* ---------- Appearance ---------- */}
            {/* <div className="ds-card">
                <div className="ds-card-title">Appearance</div>
                <p className="ds-card-desc">Switch between light and dark mode, or pick a color theme from the account menu.</p>
                <button type="button" className="ds-btn ds-btn-secondary" onClick={toggleTheme}>
                    {isDark ? <Sun size={16} /> : <Moon size={16} />}
                    {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                </button>
            </div> */}
            </>
            )}
        </DashboardShell>
    );
}
