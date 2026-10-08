import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, Plus, ChevronRight, Eye } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'reported', label: 'Reported' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
];

const SEVERITY_OPTIONS = [
    { value: '', label: 'All severities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
];

const statusBadgeClass = (status) => {
    switch (status) {
        case 'reported': return 'ds-badge ds-badge-pending';
        case 'under_review': return 'ds-badge ds-badge-review';
        case 'resolved': return 'ds-badge ds-badge-found';
        case 'closed': return 'ds-badge ds-badge-default';
        default: return 'ds-badge ds-badge-default';
    }
};

const severityBadgeClass = (severity) => {
    switch (severity) {
        case 'critical': return 'ds-badge ds-badge-rejected';
        case 'high': return 'ds-badge ds-badge-rejected';
        case 'medium': return 'ds-badge ds-badge-pending';
        default: return 'ds-badge ds-badge-default';
    }
};

const statusLabel = (status) => STATUS_OPTIONS.find((o) => o.value === status)?.label || status;

export default function IncidentsList() {
    const { roles } = useAuth();
    const isStaff = Array.isArray(roles) && roles.some((r) => ['security_officer', 'admin', 'staff'].includes(r));
    const toast = useToast();
    const navigate = useNavigate();

    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [severity, setSeverity] = useState('');
    const [view, setView] = useViewMode('incidents');

    useEffect(() => {
        document.title = "Security Incidents | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/security-incidents', { params: { status: status || undefined, severity: severity || undefined } })
            .then((res) => setIncidents(res.data.data?.data || []))
            .catch((err) => {
                toast.error(err?.response?.data?.message || 'Could not load incidents.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, [status, severity]);

    return (
        <DashboardShell onRefresh={() => load()} refreshing={loading}
            eyebrow="Security"
            title={isStaff ? 'Security Incidents' : 'My Incident Reports'}
            subtitle={isStaff
                ? 'Every incident reported across your campus — assign, resolve, and close cases here.'
                : "Incidents you've reported. Tap into one to see its current status."}
            actions={
                <Link to="/app/incidents/report" className="ds-btn ds-btn-primary">
                    <Plus size={16} style={{ verticalAlign: -3, marginRight: 4 }} /> Report Incident
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
                        <label>Severity</label>
                        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                            {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>
            )}

            <div className="ds-card">
                <div className="ds-list-head-row" style={{ marginBottom: 0 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 800, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '.02em' }}>
                        {incidents.length} {incidents.length === 1 ? 'incident' : 'incidents'}
                    </h3>
                    <ViewToggle mode={view} onChange={setView} />
                </div>

                {loading && <div className="ds-skeleton" />}
                {!loading && incidents.length === 0 && (
                    <div className="ds-empty">
                        <ShieldAlert size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        {isStaff ? 'No incidents match these filters.' : "You haven't reported any incidents yet."}
                    </div>
                )}

                {!loading && incidents.length > 0 && view === 'table' && (
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Incident</th>
                                    <th>{isStaff ? 'Reported By' : 'Assigned To'}</th>
                                    <th>Severity</th>
                                    <th>Status</th>
                                    <th>Occurred</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incidents.map((incident) => (
                                    <tr key={incident.id} className="is-clickable" onClick={() => navigate(`/app/incidents/${incident.id}`)}>
                                        <td>
                                            <div className="ds-table-cell-main">
                                                <span className="ds-thumb">
                                                    <ShieldAlert size={17} />
                                                </span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="ds-table-title">{incident.title}</div>
                                                    <div className="ds-table-sub">
                                                        {incident.category?.replace(/_/g, ' ')}
                                                        {incident.campus?.code ? ` · ${incident.campus.code}` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="ds-table-nowrap">
                                            {isStaff ? (incident.reporter?.name || '—') : (incident.assignee?.name || 'Unassigned')}
                                        </td>
                                        <td><span className={severityBadgeClass(incident.severity)}>{incident.severity}</span></td>
                                        <td><span className={statusBadgeClass(incident.status)}>{statusLabel(incident.status)}</span></td>
                                        <td className="ds-table-nowrap">{new Date(incident.occurred_at).toLocaleString()}</td>
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

                {!loading && incidents.length > 0 && view === 'cards' && (
                    <ul className="ds-list">
                        {incidents.map((incident) => (
                            <li key={incident.id} className="ds-list-item">
                                <Link to={`/app/incidents/${incident.id}`} className="ds-list-item-link">
                                    <div className="ds-list-item-main">
                                        <span className="ds-thumb">
                                            <ShieldAlert size={19} />
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <p className="ds-list-item-title">{incident.title}</p>
                                            <p className="ds-list-item-meta">
                                                {incident.category?.replace(/_/g, ' ')}
                                                {incident.campus?.code ? ` · ${incident.campus.code}` : ''}
                                                {isStaff && incident.reporter?.name ? ` · Reported by ${incident.reporter.name}` : ''}
                                                {incident.assignee?.name ? ` · Assigned to ${incident.assignee.name}` : ''}
                                            </p>
                                            <p className="ds-list-item-meta">
                                                <AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                                                {new Date(incident.occurred_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ds-list-item-side">
                                        <span className={severityBadgeClass(incident.severity)}>{incident.severity}</span>
                                        <span className={statusBadgeClass(incident.status)}>{statusLabel(incident.status)}</span>
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
