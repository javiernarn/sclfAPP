import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams, Link } from 'react-router-dom';
import {
    Wrench, MapPin, Calendar, UserCircle, Tag, AlertTriangle,
    CheckCircle2, RotateCcw, UserPlus, Lock, PlayCircle, XCircle, Building2,
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
        case 'submitted': return 'ds-badge ds-badge-pending';
        case 'acknowledged': return 'ds-badge ds-badge-review';
        case 'in_progress': return 'ds-badge ds-badge-review';
        case 'completed': return 'ds-badge ds-badge-found';
        case 'closed': return 'ds-badge ds-badge-default';
        case 'cancelled': return 'ds-badge ds-badge-rejected';
        default: return 'ds-badge ds-badge-default';
    }
};

export default function ServiceRequestDetail() {
    const { id } = useParams();
    const { user, roles } = useAuth();
    const isStaff = Array.isArray(roles) && roles.some((r) => ['security_officer', 'admin'].includes(r));
    const toast = useToast();

    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [completionNotes, setCompletionNotes] = useState('');

    useEffect(() => {
        document.title = "Service Request Details | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get(`/service-requests/${id}`)
            .then((res) => setRequest(res.data.data))
            .catch((err) => {
                toast.error(err?.response?.data?.message || 'Could not load this request.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, [id]);

    // Same "assign to me" shortcut as IncidentDetail — no lightweight
    // "staff at my campus" roster endpoint exists yet, so this covers
    // the common case of a staff member picking up a request they're
    // already looking at.
    const assignToMe = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`/service-requests/${id}/assign`, { staff_id: user.id });
            toast.success('Assigned to you.', { title: 'Assigned' });
            setRequest(res.data.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not assign this request.', { title: 'Could not assign' });
        } finally {
            setBusy(false);
        }
    };

    const start = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`/service-requests/${id}/start`);
            toast.success('Work started.', { title: 'In progress' });
            setRequest(res.data.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not start this request.', { title: 'Could not start' });
        } finally {
            setBusy(false);
        }
    };

    const complete = async () => {
        if (!completionNotes.trim()) {
            toast.error('Describe what was done first.', { title: 'Completion notes required' });
            return;
        }
        setBusy(true);
        try {
            const res = await axios.post(`/service-requests/${id}/complete`, { completion_notes: completionNotes });
            toast.success('Request marked completed.', { title: 'Completed' });
            setRequest(res.data.data);
            setCompletionNotes('');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not complete this request.', { title: 'Could not complete' });
        } finally {
            setBusy(false);
        }
    };

    const close = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`/service-requests/${id}/close`);
            toast.success('Request closed.', { title: 'Closed' });
            setRequest(res.data.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not close this request.', { title: 'Could not close' });
        } finally {
            setBusy(false);
        }
    };

    const reopen = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`/service-requests/${id}/reopen`);
            toast.success('Request reopened.', { title: 'Reopened' });
            setRequest(res.data.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not reopen this request.', { title: 'Could not reopen' });
        } finally {
            setBusy(false);
        }
    };

    const cancel = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`/service-requests/${id}/cancel`);
            toast.success('Request cancelled.', { title: 'Cancelled' });
            setRequest(res.data.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not cancel this request.', { title: 'Could not cancel' });
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <DashboardShell eyebrow="Facilities" title="Service Request Details">
                <div className="ds-card"><div className="ds-skeleton" /></div>
            </DashboardShell>
        );
    }

    if (!request) {
        return (
            <DashboardShell eyebrow="Facilities" title="Service Request Details">
                <div className="ds-card">
                    <div className="ds-empty">
                        <Lock size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        This request couldn't be found, or you don't have access to it.
                    </div>
                </div>
            </DashboardShell>
        );
    }

    const isOwner = user?.id === request.requested_by;
    const canCancel = (isOwner || isStaff) && ['submitted', 'acknowledged', 'in_progress'].includes(request.status);

    return (
        <DashboardShell
            eyebrow="Facilities"
            title={request.title}
            subtitle={`Filed ${new Date(request.created_at).toLocaleString()}${request.requester?.name ? ` by ${request.requester.name}` : ''}`}
            actions={<span className={statusBadgeClass(request.status)}>{request.status.replace(/_/g, ' ')}</span>}
        >
            <div className="ds-card">
                <h3>Details</h3>
                <div className="ds-info-grid">
                    <InfoItem icon={Tag} label="Category" value={request.category?.replace(/_/g, ' ')} />
                    <InfoItem icon={AlertTriangle} label="Priority" value={request.priority} />
                    <InfoItem icon={MapPin} label="Location" value={request.location_text} />
                    <InfoItem icon={Building2} label="Department" value={request.department?.name} />
                    <InfoItem icon={UserCircle} label="Assigned to" value={request.assignee?.name} />
                    {request.campus?.name && <InfoItem icon={Wrench} label="Campus" value={request.campus.name} />}
                </div>
                <div className="ds-field" style={{ marginTop: 12 }}>
                    <label>Description</label>
                    <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{request.description}</p>
                </div>
            </div>

            {(request.status === 'completed' || request.status === 'closed') && (
                <div className="ds-card">
                    <h3>Completion</h3>
                    <div className="ds-info-grid">
                        <InfoItem icon={UserCircle} label="Completed by" value={request.completed_by?.name} />
                        <InfoItem icon={Calendar} label="Completed at" value={request.completed_at ? new Date(request.completed_at).toLocaleString() : null} />
                        {request.closed_at && <InfoItem icon={CheckCircle2} label="Closed at" value={new Date(request.closed_at).toLocaleString()} />}
                    </div>
                    <div className="ds-field" style={{ marginTop: 12 }}>
                        <label>Completion notes</label>
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{request.completion_notes || '—'}</p>
                    </div>
                </div>
            )}

            {request.status === 'cancelled' && (
                <div className="ds-card">
                    <div className="ds-info-grid">
                        <InfoItem icon={UserCircle} label="Cancelled by" value={request.cancelled_by?.name} />
                        <InfoItem icon={Calendar} label="Cancelled at" value={request.cancelled_at ? new Date(request.cancelled_at).toLocaleString() : null} />
                    </div>
                </div>
            )}

            {isStaff && !['closed', 'cancelled'].includes(request.status) && (
                <div className="ds-card">
                    <h3>Manage This Request</h3>

                    {(request.status === 'submitted' || request.status === 'acknowledged') && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                            <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={assignToMe}>
                                <UserPlus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                                {request.assignee ? 'Reassign to me' : 'Assign to me'}
                            </button>
                            {request.status === 'acknowledged' && (
                                <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={start}>
                                    <PlayCircle size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Start Work
                                </button>
                            )}
                        </div>
                    )}

                    {request.status !== 'completed' && (
                        <div className="ds-form-row">
                            <div className="ds-field">
                                <label>Completion notes</label>
                                <textarea
                                    value={completionNotes}
                                    onChange={(e) => setCompletionNotes(e.target.value)}
                                    rows={3}
                                    placeholder="What was done to resolve this?"
                                />
                            </div>
                            <button className="ds-btn ds-btn-primary" disabled={busy} onClick={complete}>
                                <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Mark Completed
                            </button>
                        </div>
                    )}

                    {request.status === 'completed' && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button className="ds-btn ds-btn-primary" disabled={busy} onClick={close}>
                                <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Close Request
                            </button>
                            <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={reopen}>
                                <RotateCcw size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Reopen
                            </button>
                        </div>
                    )}
                </div>
            )}

            {canCancel && (
                <div className="ds-card">
                    <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={cancel}>
                        <XCircle size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Cancel Request
                    </button>
                </div>
            )}
        </DashboardShell>
    );
}
