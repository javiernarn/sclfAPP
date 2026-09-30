import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ShieldAlert, MapPin, Calendar, UserCircle, Tag, AlertTriangle,
    CheckCircle2, RotateCcw, UserPlus, Lock, FileText, Pencil, Trash2,
    Check, X, ArrowLeft,
} from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm, useDiscardConfirm } from '../../context/ConfirmContext';

const CATEGORY_OPTIONS = ['theft', 'vandalism', 'trespassing', 'altercation', 'suspicious_activity', 'safety_hazard', 'lost_item_dispute', 'other'];
const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="ds-info-item">
        <span className="ds-info-icon"><Icon size={16} /></span>
        <div className="ds-info-text">
            <div className="ds-info-label">{label}</div>
            <div className="ds-info-value">{value || '—'}</div>
        </div>
    </div>
);

const statusBadgeClass = (status) => {
    switch (status) {
        case 'reported': return 'ds-badge ds-badge-pending';
        case 'under_review': return 'ds-badge ds-badge-review';
        case 'resolved': return 'ds-badge ds-badge-found';
        case 'closed': return 'ds-badge ds-badge-default';
        default: return 'ds-badge ds-badge-default';
    }
};

export default function IncidentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, roles } = useAuth();
    const isStaff = Array.isArray(roles) && roles.some((r) => ['security_officer', 'admin', 'staff'].includes(r));
    const isAdmin = Array.isArray(roles) && (roles.includes('admin') || roles.includes('staff'));
    const toast = useToast();
    const confirm = useConfirm();
    const discardConfirm = useDiscardConfirm();

    const [incident, setIncident] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [officerId, setOfficerId] = useState('');
    const [officers, setOfficers] = useState([]);
    const [resolutionNotes, setResolutionNotes] = useState('');

    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [editErrors, setEditErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        document.title = "Incident Details | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get(`/security-incidents/${id}`)
            .then((res) => setIncident(res.data.data))
            .catch((err) => {
                toast.error(err?.response?.data?.message || 'Could not load this incident.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, [id]);

    // Officer picker for "Assign" — reuses /admin/users would be overkill
    // and admin-only; a lightweight campus roster isn't exposed elsewhere,
    // so this just lets an officer assign the incident to themselves,
    // which covers the common case (an officer picking up a case they're
    // already looking at) without needing a new endpoint.
    const assignToMe = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`/security-incidents/${id}/assign`, { officer_id: user.id });
            toast.success('Assigned to you.', { title: 'Assigned' });
            setIncident(res.data.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not assign this incident.', { title: 'Could not assign' });
        } finally {
            setBusy(false);
        }
    };

    const resolve = async () => {
        if (!resolutionNotes.trim()) {
            toast.error('Describe how this was resolved first.', { title: 'Resolution notes required' });
            return;
        }
        setBusy(true);
        try {
            const res = await axios.post(`/security-incidents/${id}/resolve`, { resolution_notes: resolutionNotes });
            toast.success('Incident marked resolved.', { title: 'Resolved' });
            setIncident(res.data.data);
            setResolutionNotes('');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not resolve this incident.', { title: 'Could not resolve' });
        } finally {
            setBusy(false);
        }
    };

    const close = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`/security-incidents/${id}/close`);
            toast.success('Incident closed.', { title: 'Closed' });
            setIncident(res.data.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not close this incident.', { title: 'Could not close' });
        } finally {
            setBusy(false);
        }
    };

    const reopen = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`/security-incidents/${id}/reopen`);
            toast.success('Incident reopened.', { title: 'Reopened' });
            setIncident(res.data.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not reopen this incident.', { title: 'Could not reopen' });
        } finally {
            setBusy(false);
        }
    };

    const toEditForm = (inc) => ({
        category: inc.category || 'other',
        severity: inc.severity || 'low',
        title: inc.title || '',
        description: inc.description || '',
        location_text: inc.location_text || '',
        // datetime-local wants "YYYY-MM-DDTHH:mm", occurred_at comes back as an ISO string.
        occurred_at: inc.occurred_at ? inc.occurred_at.slice(0, 16) : '',
    });

    const startEditing = () => {
        setEditForm(toEditForm(incident));
        setEditErrors({});
        setEditing(true);
    };

    const isEditDirty = editForm && incident && JSON.stringify(editForm) !== JSON.stringify(toEditForm(incident));

    const cancelEditing = async () => {
        if (!(await discardConfirm(isEditDirty))) return;
        setEditing(false);
        setEditForm(null);
        setEditErrors({});
    };

    const saveEdits = async () => {
        setSaving(true);
        setEditErrors({});
        try {
            const res = await axios.patch(`/security-incidents/${id}`, editForm);
            setIncident(res.data.data);
            setEditing(false);
            setEditForm(null);
            toast.success('Report updated.', { title: 'Saved' });
        } catch (err) {
            if (err?.response?.status === 422 && err.response.data?.errors) {
                setEditErrors(err.response.data.errors);
            } else {
                toast.error(err?.response?.data?.message || 'Could not save changes.', { title: 'Save failed' });
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteIncident = async () => {
        const ok = await confirm({
            title: 'Delete this incident report?',
            message: `Permanently remove "${incident.title}" from the record. This cannot be undone.`,
            confirmLabel: 'Delete report',
            tone: 'danger',
        });
        if (!ok) return;

        setDeleting(true);
        try {
            await axios.delete(`/security-incidents/${id}`);
            toast.success('Incident deleted.', { title: 'Deleted' });
            navigate('/app/incidents');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not delete this incident.', { title: 'Delete failed' });
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <DashboardShell eyebrow="Security" title="Incident Details">
                <div className="ds-card"><div className="ds-skeleton" /></div>
            </DashboardShell>
        );
    }

    if (!incident) {
        return (
            <DashboardShell eyebrow="Security" title="Incident Details">
                <div className="ds-card">
                    <div className="ds-empty">
                        <Lock size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        This incident couldn't be found, or you don't have access to it.
                    </div>
                </div>
            </DashboardShell>
        );
    }

    const canEdit = isStaff
        ? incident.status !== 'closed'
        : (incident.reporter?.id === user?.id && incident.status === 'reported');

    return (
        <DashboardShell
            eyebrow="Security"
            title={incident.title}
            subtitle={`Reported ${new Date(incident.created_at).toLocaleString()}${incident.reporter?.name ? ` by ${incident.reporter.name}` : ''}`}
            actions={<span className={statusBadgeClass(incident.status)}>{incident.status.replace(/_/g, ' ')}</span>}
        >
            <Link to="/app/incidents" className="ds-back-link">
                <ArrowLeft size={14} /> Back to Incidents
            </Link>

            <div className="ds-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <h3 style={{ margin: 0 }}>Details</h3>
                    {canEdit && !editing && (
                        <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={startEditing}>
                            <Pencil size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Edit
                        </button>
                    )}
                </div>

                {!editing && (
                    <>
                        <div className="ds-info-grid">
                            <InfoItem icon={Tag} label="Category" value={incident.category?.replace(/_/g, ' ')} />
                            <InfoItem icon={AlertTriangle} label="Severity" value={incident.severity} />
                            <InfoItem icon={MapPin} label="Location" value={incident.location_text} />
                            <InfoItem icon={Calendar} label="Occurred" value={new Date(incident.occurred_at).toLocaleString()} />
                            <InfoItem icon={UserCircle} label="Assigned to" value={incident.assignee?.name} />
                            {incident.campus?.name && <InfoItem icon={ShieldAlert} label="Campus" value={incident.campus.name} />}
                        </div>
                        <div className="ds-field" style={{ marginTop: 12 }}>
                            <label>Description</label>
                            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{incident.description}</p>
                        </div>
                        {incident.related_found_item && (
                            <p className="ds-list-item-meta" style={{ marginTop: 8 }}>
                                Related item: <Link to={`/app/found-items/${incident.related_found_item.id}`}>{incident.related_found_item.item_name}</Link>
                            </p>
                        )}
                    </>
                )}

                {editing && (
                    <div style={{ marginTop: 10 }}>
                        <div className="ds-form-row">
                            <div className="ds-field">
                                <label>Title</label>
                                <input value={editForm.title} maxLength={150} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                                {editErrors.title && <span className="ds-field-error">{editErrors.title[0]}</span>}
                            </div>
                        </div>
                        <div className="ds-form-row ds-form-row-2">
                            <div className="ds-field">
                                <label>Category</label>
                                <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                                    {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                                </select>
                            </div>
                            <div className="ds-field">
                                <label>Severity</label>
                                <select value={editForm.severity} onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })}>
                                    {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="ds-form-row ds-form-row-2">
                            <div className="ds-field">
                                <label>Location</label>
                                <input value={editForm.location_text} maxLength={255} onChange={(e) => setEditForm({ ...editForm, location_text: e.target.value })} />
                            </div>
                            <div className="ds-field">
                                <label>Occurred at</label>
                                <input
                                    type="datetime-local"
                                    value={editForm.occurred_at}
                                    max={new Date().toISOString().slice(0, 16)}
                                    onChange={(e) => setEditForm({ ...editForm, occurred_at: e.target.value })}
                                />
                                {editErrors.occurred_at && <span className="ds-field-error">{editErrors.occurred_at[0]}</span>}
                            </div>
                        </div>
                        <div className="ds-field">
                            <label>Description</label>
                            <textarea rows={4} maxLength={5000} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                            {editErrors.description && <span className="ds-field-error">{editErrors.description[0]}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                            <button type="button" className="ds-btn ds-btn-primary" disabled={saving} onClick={saveEdits}>
                                <Check size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                            <button type="button" className="ds-btn ds-btn-secondary" disabled={saving} onClick={cancelEditing}>
                                <X size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {(incident.status === 'resolved' || incident.status === 'closed') && (
                <div className="ds-card">
                    <h3>Resolution</h3>
                    <div className="ds-info-grid">
                        <InfoItem icon={UserCircle} label="Resolved by" value={incident.resolver?.name} />
                        <InfoItem icon={Calendar} label="Resolved at" value={incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : null} />
                        {incident.closed_at && <InfoItem icon={CheckCircle2} label="Closed at" value={new Date(incident.closed_at).toLocaleString()} />}
                    </div>
                    <div className="ds-field" style={{ marginTop: 12 }}>
                        <label>Resolution notes</label>
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{incident.resolution_notes || '—'}</p>
                    </div>
                </div>
            )}

            {isStaff && incident.status !== 'closed' && (
                <div className="ds-card">
                    <h3>Manage This Incident</h3>

                    {(incident.status === 'reported' || incident.status === 'under_review') && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                            <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={assignToMe}>
                                <UserPlus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                                {incident.assignee ? 'Reassign to me' : 'Assign to me'}
                            </button>
                        </div>
                    )}

                    {incident.status !== 'resolved' && (
                        <div className="ds-form-row">
                            <div className="ds-field">
                                <label>Resolution notes</label>
                                <textarea
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    rows={3}
                                    placeholder="How was this resolved?"
                                />
                            </div>
                            <button className="ds-btn ds-btn-primary" disabled={busy} onClick={resolve}>
                                <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Mark Resolved
                            </button>
                        </div>
                    )}

                    {incident.status === 'resolved' && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button className="ds-btn ds-btn-primary" disabled={busy} onClick={close}>
                                <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Close Incident
                            </button>
                            <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={reopen}>
                                <RotateCcw size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Reopen
                            </button>
                        </div>
                    )}
                </div>
            )}
            {isAdmin && (
                <div className="ds-card">
                    <h3 style={{ color: '#dc2626' }}>Danger Zone</h3>
                    <p className="ds-card-desc">Permanently remove this incident report. This cannot be undone.</p>
                    <button type="button" className="ds-btn ds-btn-danger" disabled={deleting} onClick={deleteIncident}>
                        <Trash2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                        {deleting ? 'Deleting…' : 'Delete Report'}
                    </button>
                </div>
            )}
        </DashboardShell>
    );
}
