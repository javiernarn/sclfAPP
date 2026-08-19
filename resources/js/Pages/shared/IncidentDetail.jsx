import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams, Link } from 'react-router-dom';
import {
    ShieldAlert, MapPin, Calendar, UserCircle, Tag, AlertTriangle,
    CheckCircle2, RotateCcw, UserPlus, Lock, FileText,
} from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

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
    const { user, roles } = useAuth();
    const isStaff = Array.isArray(roles) && roles.some((r) => ['security_officer', 'admin'].includes(r));
    const toast = useToast();

    const [incident, setIncident] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [officerId, setOfficerId] = useState('');
    const [officers, setOfficers] = useState([]);
    const [resolutionNotes, setResolutionNotes] = useState('');

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

    return (
        <DashboardShell
            eyebrow="Security"
            title={incident.title}
            subtitle={`Reported ${new Date(incident.created_at).toLocaleString()}${incident.reporter?.name ? ` by ${incident.reporter.name}` : ''}`}
            actions={<span className={statusBadgeClass(incident.status)}>{incident.status.replace(/_/g, ' ')}</span>}
        >
            <div className="ds-card">
                <h3>Details</h3>
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
        </DashboardShell>
    );
}
