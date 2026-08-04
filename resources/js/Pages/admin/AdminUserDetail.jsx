import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, UserCircle, Mail, Phone, IdCard, ShieldCheck, Calendar,
    VenetianMask, MapPin, GraduationCap, LogIn, LogOut, History,
    PackageSearch, ClipboardCheck, Ban, Trash2,
} from 'lucide-react';
import DashboardShell from '../../Components/shared/DashboardShell';
import ImageViewer from '../../Components/shared/ImageViewer';
import { useAuth } from '../../context/AuthContext';

const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="ds-info-item">
        <span className="ds-info-icon"><Icon size={16} /></span>
        <div className="ds-info-text">
            <div className="ds-info-label">{label}</div>
            <div className="ds-info-value">{value || '—'}</div>
        </div>
    </div>
);

const ROLE_LABELS = {
    student: 'Student',
    instructor: 'Instructor',
    security_officer: 'Security Officer',
    admin: 'Administrator',
};

// Only these two actions count as a "sign-in event" for the Login /
// Logout History list below — every other audit action (account edits,
// item reports, claims, etc.) belongs to the account's general activity
// trail instead, which the admin can always see in full via the "Open
// full Audit Log" link at the bottom of that list.
const AUTH_ACTIONS = new Set(['auth.login', 'auth.logout']);

export default function AdminUserDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [logFilter, setLogFilter] = useState('auth'); // 'auth' | 'all'

    const [cleaningClaims, setCleaningClaims] = useState(false);
    const [cleanupMessage, setCleanupMessage] = useState('');

    useEffect(() => {
        document.title = "User Details | SCLF - Opol Community College";
    }, []);

    const loadUser = () => {
        setLoading(true);
        setError('');
        return axios.get(`/admin/users/${id}`)
            .then((res) => setUser(res.data.data))
            .catch((err) => setError(err?.response?.data?.message || 'Could not load this account.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadUser();
    }, [id]);

    const deleteCancelledClaims = async () => {
        const count = user?.cancelled_claims_count ?? 0;
        if (count === 0) return;
        if (!window.confirm(
            `Permanently delete ${count} cancelled claim(s) for ${user.name}? ` +
            `Their related notifications will be removed too. This cannot be undone.`
        )) return;

        setCleaningClaims(true);
        setCleanupMessage('');
        try {
            const res = await axios.delete(`/admin/users/${id}/claims/cancelled`);
            setCleanupMessage(res.data.message || 'Done.');
            await loadUser();
        } catch (err) {
            setCleanupMessage(err?.response?.data?.message || 'Could not delete cancelled claims.');
        } finally {
            setCleaningClaims(false);
        }
    };

    useEffect(() => {
        setLogsLoading(true);
        axios.get('/audit-logs', { params: { user_id: id } })
            .then((res) => setLogs(res.data.data || []))
            .finally(() => setLogsLoading(false));
    }, [id]);

    const authLogs = useMemo(() => logs.filter((l) => AUTH_ACTIONS.has(l.action)), [logs]);
    const visibleLogs = logFilter === 'auth' ? authLogs : logs;

    const isSelf = currentUser?.id === Number(id);
    const roleName = (user?.roles || [])[0]?.name;
    const initials = (user?.name || '?')
        .split(' ').filter(Boolean).slice(0, 2)
        .map((p) => p[0]?.toUpperCase()).join('');

    if (loading) {
        return (
            <DashboardShell eyebrow="Admin" title="User Details">
                <div className="ds-card"><div className="ds-skeleton" /><div className="ds-skeleton" /></div>
            </DashboardShell>
        );
    }

    if (!user) {
        return (
            <DashboardShell eyebrow="Admin" title="User Details">
                <div className="ds-card"><div className="ds-error">{error || 'Account not found.'}</div></div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell
            eyebrow="Admin"
            title={user.name}
            subtitle="Full profile details and sign-in history — visible to admins only."
            actions={
                <span className="ds-badge ds-badge-default">
                    {ROLE_LABELS[roleName] || 'No role'}
                </span>
            }
        >
            <Link to="/admin/users" className="ds-back-link">
                <ArrowLeft size={14} /> Back to Users
            </Link>

            <div className="ds-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
                    {user.profile_picture_url ? (
                        <ImageViewer
                            src={user.profile_picture_url}
                            alt={user.name}
                            className="ds-avatar"
                            style={{ width: 72, height: 72, borderRadius: 20 }}
                        />
                    ) : (
                        <span className="ds-avatar" style={{ width: 72, height: 72, fontSize: 24, borderRadius: 20 }}>
                            {initials || <UserCircle size={30} />}
                        </span>
                    )}
                    <div style={{ minWidth: 0 }}>
                        <p className="ds-item-hero-name" style={{ fontSize: 19, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {user.name}
                            {isSelf && <span className="ds-badge ds-badge-default">You</span>}
                            {!user.is_active && (
                                <span className="ds-badge ds-badge-rejected">
                                    <Ban size={12} style={{ verticalAlign: -2, marginRight: 3 }} /> Disabled
                                </span>
                            )}
                            {user.deleted_at && <span className="ds-badge ds-badge-default">Archived</span>}
                        </p>
                        <p className="ds-item-hero-meta">{user.email}</p>
                    </div>
                </div>

                <div className="ds-info-grid" style={{ marginTop: 14 }}>
                    <InfoItem icon={Mail} label="Email" value={user.email} />
                    <InfoItem icon={Phone} label="Phone" value={user.phone_number} />
                    <InfoItem icon={IdCard} label="ID Number" value={user.display_id} />
                    <InfoItem icon={ShieldCheck} label="Role" value={ROLE_LABELS[roleName] || 'No role'} />
                    <InfoItem icon={VenetianMask} label="Gender" value={
                        user.gender ? user.gender.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : null
                    } />
                    {user.course && <InfoItem icon={GraduationCap} label="Course" value={user.course} />}
                    {user.address && <InfoItem icon={MapPin} label="Address" value={user.address} />}
                    <InfoItem
                        icon={Calendar}
                        label="Account Created"
                        value={user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null}
                    />
                </div>
            </div>

            <div className="ds-card">
                <div className="ds-card-title">Activity</div>
                <p className="ds-card-desc">What this account has reported and claimed so far.</p>
                <div className="ds-info-grid">
                    <InfoItem icon={PackageSearch} label="Lost Items Reported" value={user.lost_items_count ?? 0} />
                    <InfoItem icon={PackageSearch} label="Found Items Reported" value={user.found_items_count ?? 0} />
                    <InfoItem icon={ClipboardCheck} label="Claims Filed" value={user.claims_count ?? 0} />
                    <InfoItem icon={Ban} label="Cancelled Claims" value={user.cancelled_claims_count ?? 0} />
                </div>

                {(user.cancelled_claims_count ?? 0) > 0 && (
                    <div style={{
                        marginTop: 14, display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
                    }}>
                        <p className="ds-card-desc" style={{ margin: 0 }}>
                            This account has {user.cancelled_claims_count} cancelled claim(s) cluttering its history.
                        </p>
                        <button
                            type="button"
                            className="ds-btn ds-btn-danger"
                            onClick={deleteCancelledClaims}
                            disabled={cleaningClaims}
                        >
                            <Trash2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                            {cleaningClaims ? 'Deleting…' : 'Delete cancelled claims'}
                        </button>
                    </div>
                )}
                {cleanupMessage && <p className="ds-card-desc" style={{ marginTop: 8 }}>{cleanupMessage}</p>}
            </div>

            <div className="ds-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div className="ds-card-title-icon" style={{ fontSize: 15.5, fontWeight: 800 }}>
                        <History size={17} /> Login / Logout History
                    </div>
                    <div className="ds-seg" role="tablist" aria-label="Filter activity log">
                        <button
                            type="button"
                            className={`ds-seg-btn ${logFilter === 'auth' ? 'active' : ''}`}
                            onClick={() => setLogFilter('auth')}
                        >
                            Sign-ins only
                        </button>
                        <button
                            type="button"
                            className={`ds-seg-btn ${logFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setLogFilter('all')}
                        >
                            All activity
                        </button>
                    </div>
                </div>
                <p className="ds-card-desc">
                    Every time this account has logged in or out, most recent first.
                </p>

                {logsLoading && <div className="ds-skeleton" />}
                {!logsLoading && visibleLogs.length === 0 && (
                    <div className="ds-empty">No {logFilter === 'auth' ? 'sign-in' : 'activity'} entries yet.</div>
                )}
                {!logsLoading && visibleLogs.length > 0 && (
                    <ul className="ds-list">
                        {visibleLogs.map((l) => (
                            <li key={l.id} className="ds-list-item">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    <span className="ds-thumb" style={{ width: 34, height: 34, flexShrink: 0 }}>
                                        {l.action === 'auth.login' ? <LogIn size={16} />
                                            : l.action === 'auth.logout' ? <LogOut size={16} />
                                                : <History size={16} />}
                                    </span>
                                    <div style={{ minWidth: 0 }}>
                                        <p className="ds-list-item-title">
                                            {l.action === 'auth.login' ? 'Logged in'
                                                : l.action === 'auth.logout' ? 'Logged out'
                                                    : l.action}
                                        </p>
                                        <p className="ds-list-item-meta">{l.description}</p>
                                    </div>
                                </div>
                                <span className="ds-list-item-meta">{new Date(l.created_at).toLocaleString()}</span>
                            </li>
                        ))}
                    </ul>
                )}

                <Link to="/admin/audit-log" className="ds-back-link" style={{ marginTop: 12, marginBottom: 0 }}>
                    Open full Audit Log <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
                </Link>
            </div>
        </DashboardShell>
    );
}
