import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link, useNavigate } from 'react-router-dom';
import { Wrench, ClipboardList, Plus, ChevronRight, Eye } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'closed', label: 'Closed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
    { value: '', label: 'All priorities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
];

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

const priorityBadgeClass = (priority) => {
    switch (priority) {
        case 'urgent': return 'ds-badge ds-badge-rejected';
        case 'high': return 'ds-badge ds-badge-rejected';
        case 'medium': return 'ds-badge ds-badge-pending';
        default: return 'ds-badge ds-badge-default';
    }
};

const statusLabel = (status) => STATUS_OPTIONS.find((o) => o.value === status)?.label || status;

export default function ServiceRequestsList() {
    const { roles } = useAuth();
    const isStaff = Array.isArray(roles) && roles.some((r) => ['security_officer', 'admin', 'staff'].includes(r));
    const toast = useToast();
    const navigate = useNavigate();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [priority, setPriority] = useState('');
    const [view, setView] = useViewMode('service-requests');

    useEffect(() => {
        document.title = "Service Requests | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/service-requests', { params: { status: status || undefined, priority: priority || undefined } })
            .then((res) => setRequests(res.data.data?.data || []))
            .catch((err) => {
                toast.error(err?.response?.data?.message || 'Could not load service requests.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, [status, priority]);

    return (
        <DashboardShell
            eyebrow="Facilities"
            title={isStaff ? 'Service Requests' : 'My Service Requests'}
            subtitle={isStaff
                ? 'Every request filed across your campus — assign, work, and close them out here.'
                : "Requests you've filed. Tap into one to see its current status."}
            actions={
                <Link to="/app/service-requests/new" className="ds-btn ds-btn-primary">
                    <Plus size={16} style={{ verticalAlign: -3, marginRight: 4 }} /> New Request
                </Link>
            }
        >
            {isStaff && (
                <div className="ds-card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div className="ds-field" style={{ minWidth: 180 }}>
                        <label>Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)}>
                            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className="ds-field" style={{ minWidth: 180 }}>
                        <label>Priority</label>
                        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>
            )}

            <div className="ds-card">
                <div className="ds-list-head-row" style={{ marginBottom: 0 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 800, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '.02em' }}>
                        {requests.length} {requests.length === 1 ? 'request' : 'requests'}
                    </h3>
                    <ViewToggle mode={view} onChange={setView} />
                </div>

                {loading && <div className="ds-skeleton" />}
                {!loading && requests.length === 0 && (
                    <div className="ds-empty">
                        <ClipboardList size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        {isStaff ? 'No requests match these filters.' : "You haven't filed any service requests yet."}
                    </div>
                )}

                {!loading && requests.length > 0 && view === 'table' && (
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Request</th>
                                    <th>{isStaff ? 'Filed By' : 'Assigned To'}</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Filed</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((r) => (
                                    <tr key={r.id} className="is-clickable" onClick={() => navigate(`/app/service-requests/${r.id}`)}>
                                        <td>
                                            <div className="ds-table-cell-main">
                                                <span className="ds-thumb">
                                                    <Wrench size={17} />
                                                </span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="ds-table-title">{r.title}</div>
                                                    <div className="ds-table-sub">
                                                        {r.category?.replace(/_/g, ' ')}
                                                        {r.department?.name ? ` · ${r.department.name}` : ''}
                                                        {r.campus?.code ? ` · ${r.campus.code}` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="ds-table-nowrap">
                                            {isStaff ? (r.requester?.name || '—') : (r.assignee?.name || 'Unassigned')}
                                        </td>
                                        <td><span className={priorityBadgeClass(r.priority)}>{r.priority}</span></td>
                                        <td><span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span></td>
                                        <td className="ds-table-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                                        <td>
                                            <div className="ds-table-actions">
                                                <span className="ds-btn ds-btn-view ds-btn-sm">
                                                    <Eye size={13} /> View
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && requests.length > 0 && view === 'cards' && (
                    <ul className="ds-list">
                        {requests.map((r) => (
                            <li key={r.id} className="ds-list-item">
                                <Link to={`/app/service-requests/${r.id}`} className="ds-list-item-link">
                                    <div className="ds-list-item-main">
                                        <span className="ds-thumb">
                                            <Wrench size={19} />
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <p className="ds-list-item-title">{r.title}</p>
                                            <p className="ds-list-item-meta">
                                                {r.category?.replace(/_/g, ' ')}
                                                {r.department?.name ? ` · ${r.department.name}` : ''}
                                                {r.campus?.code ? ` · ${r.campus.code}` : ''}
                                                {isStaff && r.requester?.name ? ` · Filed by ${r.requester.name}` : ''}
                                                {r.assignee?.name ? ` · Assigned to ${r.assignee.name}` : ''}
                                            </p>
                                            <p className="ds-list-item-meta">
                                                <Wrench size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                                                Filed {new Date(r.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ds-list-item-side">
                                        <span className={priorityBadgeClass(r.priority)}>{r.priority}</span>
                                        <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                                        <ChevronRight size={16} />
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
