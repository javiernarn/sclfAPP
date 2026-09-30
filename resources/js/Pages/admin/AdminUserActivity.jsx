import React, { useEffect, useState, useCallback } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import DeviceIcon from '../../Components/shared/DeviceIcon';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { useToast } from '../../context/ToastContext';
import {
    ShieldAlert,
    ChevronLeft,
    ChevronRight,
    Globe,
    Activity,
    RefreshCw,
} from '../../Components/icons';

const DEVICE_OPTIONS = [
    { value: '', label: 'All devices' },
    { value: 'desktop', label: 'Desktop' },
    { value: 'mobile', label: 'Mobile' },
    { value: 'tablet', label: 'Tablet' },
    { value: 'bot', label: 'Bot / script' },
];

function Pagination({ meta, onPage }) {
    if (!meta || meta.last_page <= 1) return null;
    return (
        <div className="ds-list-item-side" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button
                type="button"
                className="ds-btn ds-btn-secondary ds-btn-sm"
                disabled={meta.current_page <= 1}
                onClick={() => onPage(meta.current_page - 1)}
            >
                <ChevronLeft size={14} /> Prev
            </button>
            <span className="ds-list-item-meta">
                Page {meta.current_page} of {meta.last_page} · {meta.total} total
            </span>
            <button
                type="button"
                className="ds-btn ds-btn-secondary ds-btn-sm"
                disabled={meta.current_page >= meta.last_page}
                onClick={() => onPage(meta.current_page + 1)}
            >
                Next <ChevronRight size={14} />
            </button>
        </div>
    );
}

// Raw request-level feed (see App\Http\Middleware\TrackUserActivity /
// user_activities table) — separate from Audit Log, which is the curated
// "meaningful actions" trail. This page answers "who's using the system,
// from where/what device, and does any of it look like spam or abuse",
// not "what did this account officially do".
export default function AdminUserActivity() {
    const toast = useToast();
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [deviceType, setDeviceType] = useState('');
    const [suspiciousOnly, setSuspiciousOnly] = useState(false);
    const [ipFilter, setIpFilter] = useState('');
    const [ipInput, setIpInput] = useState('');
    const [view, setView] = useViewMode('admin-activity');

    useEffect(() => {
        document.title = "User Activity | SCLF - Opol Community College";
    }, []);

    const load = useCallback(() => {
        setLoading(true);
        axios.get('/admin/activity', {
            params: {
                page,
                device_type: deviceType || undefined,
                suspicious_only: suspiciousOnly ? 1 : undefined,
                ip_address: ipFilter || undefined,
            },
        })
            .then((res) => {
                setRows(res.data.data || []);
                setMeta(res.data);
            })
            .catch((err) => {
                toast.error(err?.response?.data?.message || 'Could not load activity.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, deviceType, suspiciousOnly, ipFilter]);

    useEffect(load, [load]);

    return (
        <DashboardShell
            eyebrow="Admin"
            title="User Activity"
            subtitle="Every request hitting the app, with the device and IP address it came from — flagged automatically when the volume looks like spam or abuse rather than normal browsing."
            actions={
                <button type="button" className="ds-btn ds-btn-secondary" onClick={load} disabled={loading}>
                    <RefreshCw size={16} style={{ verticalAlign: -3, marginRight: 4 }} /> Refresh
                </button>
            }
        >
            <div className="ds-card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="ds-field" style={{ minWidth: 180 }}>
                    <label>Device</label>
                    <select value={deviceType} onChange={(e) => { setPage(1); setDeviceType(e.target.value); }}>
                        {DEVICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div className="ds-field" style={{ minWidth: 200 }}>
                    <label>IP address</label>
                    <input
                        type="text"
                        placeholder="e.g. 192.168.1.10"
                        value={ipInput}
                        onChange={(e) => setIpInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setIpFilter(ipInput.trim()); } }}
                        onBlur={() => { setPage(1); setIpFilter(ipInput.trim()); }}
                    />
                </div>
                <label className="ds-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <input
                        type="checkbox"
                        checked={suspiciousOnly}
                        onChange={(e) => { setPage(1); setSuspiciousOnly(e.target.checked); }}
                    />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ShieldAlert size={14} /> Flagged only
                    </span>
                </label>
            </div>

            <div className="ds-card">
                <div className="ds-list-head-row" style={{ justifyContent: 'flex-end' }}>
                    <ViewToggle mode={view} onChange={setView} />
                </div>

                {loading && <div className="ds-skeleton" />}
                {!loading && rows.length === 0 && (
                    <div className="ds-empty">
                        <Activity size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        No activity matches these filters.
                    </div>
                )}
                {!loading && rows.length > 0 && view === 'table' && (
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Device</th>
                                    <th>IP Address</th>
                                    <th>Request</th>
                                    <th>Flag</th>
                                    <th>When</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id}>
                                        <td className="ds-table-nowrap">
                                            {r.user
                                                ? <Link to={`/app/admin/users/${r.user.id}`}>{r.user.name}</Link>
                                                : <span className="ds-list-item-meta">Guest</span>}
                                        </td>
                                        <td className="ds-table-nowrap">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                <DeviceIcon deviceType={r.device_type} size={14} />
                                                {[r.platform, r.browser].filter(Boolean).join(' · ') || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="ds-table-nowrap">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                <Globe size={14} /> {r.ip_address || '—'}
                                            </span>
                                        </td>
                                        <td className="ds-table-sub">
                                            <span className="ds-badge ds-badge-default" style={{ marginRight: 6 }}>{r.method}</span>
                                            {r.path}
                                        </td>
                                        <td className="ds-table-nowrap">
                                            {r.is_suspicious
                                                ? (
                                                    <span className="ds-badge ds-badge-rejected ds-badge-icon" title={r.flag_reason || ''}>
                                                        <ShieldAlert size={12} /> {r.flag_reason || 'Flagged'}
                                                    </span>
                                                )
                                                : <span className="ds-list-item-meta">—</span>}
                                        </td>
                                        <td className="ds-table-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && rows.length > 0 && view === 'cards' && (
                    <ul className="ds-list">
                        {rows.map((r) => (
                            <li key={r.id} className="ds-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <div className="ds-list-item-main" style={{ minWidth: 0, justifyContent: 'space-between' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <p className="ds-list-item-title">
                                            {r.user
                                                ? <Link to={`/app/admin/users/${r.user.id}`}>{r.user.name}</Link>
                                                : 'Guest'}
                                        </p>
                                        <p className="ds-list-item-meta">
                                            <span className="ds-badge ds-badge-default" style={{ marginRight: 6 }}>{r.method}</span>
                                            {r.path}
                                        </p>
                                    </div>
                                    {r.is_suspicious && (
                                        <span className="ds-badge ds-badge-rejected ds-badge-icon" title={r.flag_reason || ''}>
                                            <ShieldAlert size={12} /> Flagged
                                        </span>
                                    )}
                                </div>
                                <p className="ds-list-item-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <DeviceIcon deviceType={r.device_type} size={13} />
                                        {[r.platform, r.browser].filter(Boolean).join(' · ') || 'Unknown'}
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <Globe size={13} /> {r.ip_address || '—'}
                                    </span>
                                </p>
                                {r.is_suspicious && r.flag_reason && (
                                    <p className="ds-list-item-meta" style={{ marginTop: 2, color: '#dc2626' }}>{r.flag_reason}</p>
                                )}
                                <p className="ds-list-item-meta" style={{ marginTop: 4 }}>{new Date(r.created_at).toLocaleString()}</p>
                            </li>
                        ))}
                    </ul>
                )}

                <Pagination meta={meta} onPage={setPage} />
            </div>

            <p className="ds-card-desc" style={{ marginTop: 4 }}>
                Looking for a specific person's full device/IP history? Open <Link to="/app/admin/users">Users</Link>, pick the account, and check its "Devices &amp; IP Addresses" section.
            </p>
        </DashboardShell>
    );
}
