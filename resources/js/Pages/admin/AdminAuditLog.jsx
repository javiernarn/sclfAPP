import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import useRoleLabel from '../../hooks/useRoleLabel';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import DeviceIcon from '../../Components/shared/DeviceIcon';
import useViewMode from '../../hooks/useViewMode';
import { parseUserAgent } from '../../utils/userAgent';

// This page is sign-in activity only (auth.login / auth.logout), across
// every account. Everything else an account does — claim status changes,
// item reports, storage moves, etc. — lives on that specific account's own
// Activity tab instead (Admin > Users > that user > All activity). Mixing
// every action from every user into one global feed is what made this page
// confusing to scan; scoping the rest to the account it belongs to keeps
// this list to what's actually useful to skim at a glance.
const AUTH_ACTIONS = ['auth.login', 'auth.logout'];

export default function AdminAuditLog() {
    const { label: roleLabel } = useRoleLabel();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useViewMode('audit-log');

    useEffect(() => {
        document.title = "Audit Log | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/audit-logs', { params: { actions: AUTH_ACTIONS } })
            .then(res => setLogs(res.data.data))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    return (
        <DashboardShell onRefresh={() => load()} refreshing={loading}
            eyebrow={roleLabel || 'Admin'}
            title="Audit Log"
            subtitle="Sign-in activity across every account, most recent first. For everything else an account has done, open that user's page and check its Activity tab."
        >
            <div className="ds-card">
                <div className="ds-list-head-row" style={{ justifyContent: 'flex-end' }}>
                    <ViewToggle mode={view} onChange={setView} />
                </div>

                {loading && <div className="ds-skeleton" />}
                {!loading && logs.length === 0 && <div className="ds-empty">No sign-in activity yet.</div>}

                {!loading && logs.length > 0 && view === 'table' && (
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Action</th>
                                    <th>Description</th>
                                    <th>User</th>
                                    <th>Device</th>
                                    <th>IP Address</th>
                                    <th>When</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(l => {
                                    const ua = parseUserAgent(l.user_agent);
                                    return (
                                    <tr key={l.id}>
                                        <td className="ds-table-title">{l.action}</td>
                                        <td className="ds-table-sub" style={{ maxWidth: 320, whiteSpace: 'normal' }}>{l.description}</td>
                                        <td className="ds-table-nowrap">{l.user ? l.user.name : '—'}</td>
                                        <td className="ds-table-nowrap">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                <DeviceIcon deviceType={ua.deviceType} size={14} />
                                                {ua.label}
                                            </span>
                                        </td>
                                        <td className="ds-table-nowrap">{l.ip_address || '—'}</td>
                                        <td className="ds-table-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && logs.length > 0 && view === 'cards' && (
                    <ul className="ds-list">
                        {logs.map(l => {
                            const ua = parseUserAgent(l.user_agent);
                            return (
                            <li key={l.id} className="ds-list-item">
                                <div>
                                    <p className="ds-list-item-title">{l.action}</p>
                                    <p className="ds-list-item-meta">
                                        {l.description} {l.user ? `· by ${l.user.name}` : ''}
                                    </p>
                                    <p className="ds-list-item-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        <DeviceIcon deviceType={ua.deviceType} size={13} />
                                        {ua.label} {l.ip_address ? `· ${l.ip_address}` : ''}
                                    </p>
                                </div>
                                <span className="ds-list-item-meta">{new Date(l.created_at).toLocaleString()}</span>
                            </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            {!loading && (
                <p className="ds-card-desc" style={{ marginTop: 4 }}>
                    Looking for claim, item, or storage activity? Open <Link to="/app/admin/users">Users</Link>, pick the account, and check its Activity tab — it's scoped to that one account so it's easier to review.
                </p>
            )}
        </DashboardShell>
    );
}
