import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { UserCheck, UserX, Users, Clock, LogOut } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';

const PURPOSE_OPTIONS = [
    { value: 'meeting', label: 'Meeting' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'event', label: 'Event' },
    { value: 'interview', label: 'Interview' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
    full_name: '', id_presented: '', id_number: '', purpose: 'meeting',
    host_name: '', host_department: '', badge_number: '', notes: '',
};

function VisitorRow({ visitor, onCheckedOut }) {
    const [busy, setBusy] = useState(false);
    const toast = useToast();

    const checkOut = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`/visitors/${visitor.id}/check-out`, {});
            toast.success(`${visitor.full_name} checked out.`, { title: 'Checked out' });
            onCheckedOut(res.data.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not check this visitor out.', { title: 'Could not check out' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <li className="ds-list-item">
            <div className="ds-list-item-main" style={{ minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                    <p className="ds-list-item-title">{visitor.full_name}</p>
                    <p className="ds-list-item-meta">
                        {visitor.purpose}
                        {visitor.host_name ? ` · Visiting ${visitor.host_name}` : ''}
                        {visitor.host_department ? ` (${visitor.host_department})` : ''}
                        {visitor.badge_number ? ` · Badge #${visitor.badge_number}` : ''}
                    </p>
                    <p className="ds-list-item-meta">
                        <Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                        Checked in {new Date(visitor.checked_in_at).toLocaleString()} by {visitor.checked_in_by?.name || '—'}
                        {visitor.status === 'checked_out' && visitor.checked_out_at && (
                            ` · Checked out ${new Date(visitor.checked_out_at).toLocaleString()}`
                        )}
                    </p>
                </div>
            </div>
            {visitor.status === 'checked_in' && (
                <div className="ds-list-item-side">
                    <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={checkOut}>
                        <LogOut size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Check Out
                    </button>
                </div>
            )}
            {visitor.status === 'checked_out' && (
                <span className="ds-badge ds-badge-default">Checked out</span>
            )}
        </li>
    );
}

export default function SecurityVisitors() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [visitors, setVisitors] = useState([]);
    const [onCampusCount, setOnCampusCount] = useState(0);
    const [showHistory, setShowHistory] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const toast = useToast();

    useEffect(() => {
        document.title = "Visitor Management | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/visitors', { params: showHistory ? { history: 1 } : {} })
            .then((res) => {
                setVisitors(res.data.data?.data || []);
                setOnCampusCount(res.data.currently_on_campus || 0);
            })
            .catch((err) => {
                toast.error(err?.response?.data?.message || 'Could not load visitors.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, [showHistory]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (fieldErrors[e.target.name]) {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[e.target.name]; return next; });
        }
    };

    const handleCheckIn = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setFieldErrors({});
        try {
            await axios.post('/visitors', form, { silent: true });
            toast.success(`${form.full_name} checked in.`, { title: 'Checked in' });
            setForm(EMPTY_FORM);
            load();
        } catch (err) {
            const errors = err?.response?.data?.errors;
            const message = errors
                ? Object.values(errors).flat().join('\n')
                : (err?.response?.data?.message || 'Could not check this visitor in.');
            setFieldErrors(errors ? Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])) : {});
            toast.error(message, { title: 'Could not check in' });
        } finally {
            setSubmitting(false);
        }
    };

    const updateAfterCheckOut = (updated) => {
        if (showHistory) {
            setVisitors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
        } else {
            setVisitors((prev) => prev.filter((v) => v.id !== updated.id));
        }
        setOnCampusCount((c) => Math.max(0, c - 1));
    };

    return (
        <DashboardShell
            eyebrow="Security"
            title="Visitor Management"
            subtitle="Log visitors in and out at the counter, and see who's currently on campus."
            actions={
                <span className="ds-badge ds-badge-found">
                    <Users size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {onCampusCount} on campus
                </span>
            }
        >
            <div className="ds-card">
                <h3>Check In a Visitor</h3>
                <form onSubmit={handleCheckIn}>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Full name</label>
                            <input name="full_name" value={form.full_name} onChange={handleChange} required maxLength={150}
                                aria-invalid={!!fieldErrors.full_name} />
                            {fieldErrors.full_name && <p className="ds-field-error">{fieldErrors.full_name}</p>}
                        </div>
                        <div className="ds-field">
                            <label>Purpose of visit</label>
                            <select name="purpose" value={form.purpose} onChange={handleChange} required>
                                {PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>ID presented</label>
                            <input name="id_presented" value={form.id_presented} onChange={handleChange} maxLength={100}
                                placeholder="e.g. Driver's License, School ID" />
                        </div>
                        <div className="ds-field">
                            <label>ID number</label>
                            <input name="id_number" value={form.id_number} onChange={handleChange} maxLength={100} />
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Host / person visiting</label>
                            <input name="host_name" value={form.host_name} onChange={handleChange} maxLength={150} />
                        </div>
                        <div className="ds-field">
                            <label>Host's department</label>
                            <input name="host_department" value={form.host_department} onChange={handleChange} maxLength={150} />
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Badge number (optional)</label>
                            <input name="badge_number" value={form.badge_number} onChange={handleChange} maxLength={50} />
                        </div>
                        <div className="ds-field">
                            <label>Notes (optional)</label>
                            <input name="notes" value={form.notes} onChange={handleChange} maxLength={1000} />
                        </div>
                    </div>
                    <button type="submit" className="ds-btn ds-btn-primary" disabled={submitting}>
                        <UserCheck size={15} style={{ verticalAlign: -2, marginRight: 4 }} />
                        {submitting ? 'Checking in…' : 'Check In'}
                    </button>
                </form>
            </div>

            <div className="ds-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <h3 style={{ margin: 0 }}>{showHistory ? 'Full Visitor Log' : 'Currently On Campus'}</h3>
                    <button className="ds-btn ds-btn-secondary" onClick={() => setShowHistory((s) => !s)}>
                        {showHistory ? 'Show currently on campus' : 'Show full history'}
                    </button>
                </div>
                {loading && <div className="ds-skeleton" />}
                {!loading && visitors.length === 0 && (
                    <div className="ds-empty">
                        <UserX size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        {showHistory ? 'No visitors logged yet.' : 'Nobody is currently checked in.'}
                    </div>
                )}
                {!loading && visitors.length > 0 && (
                    <ul className="ds-list">
                        {visitors.map((v) => (
                            <VisitorRow key={v.id} visitor={v} onCheckedOut={updateAfterCheckOut} />
                        ))}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
