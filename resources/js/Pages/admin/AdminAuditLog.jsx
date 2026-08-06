import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';

// This page is sign-in activity only (auth.login / auth.logout), across
// every account. Everything else an account does — claim status changes,
// item reports, storage moves, etc. — lives on that specific account's own
// Activity tab instead (Admin > Users > that user > All activity). Mixing
// every action from every user into one global feed is what made this page
// confusing to scan; scoping the rest to the account it belongs to keeps
// this list to what's actually useful to skim at a glance.
const AUTH_ACTIONS = ['auth.login', 'auth.logout'];

export default function AdminAuditLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useViewMode('audit-log');

    useEffect(() => {
        document.title = "Audit Log | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        axios.get('/audit-logs', { params: { actions: AUTH_ACTIONS } })
            .then(res => setLogs(res.data.data))
            .finally(() => setLoading(false));
    }, []);

    return (
        <DashboardShell
            eyebrow="Admin"
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
                                    <th>When</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(l => (
                                    <tr key={l.id}>
                                        <td className="ds-table-title">{l.action}</td>
                                        <td className="ds-table-sub" style={{ maxWidth: 320, whiteSpace: 'normal' }}>{l.description}</td>
                                        <td className="ds-table-nowrap">{l.user ? l.user.name : '—'}</td>
                                        <td className="ds-table-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && logs.length > 0 && view === 'cards' && (
                    <ul className="ds-list">
                        {logs.map(l => (
                            <li key={l.id} className="ds-list-item">
                                <div>
                                    <p className="ds-list-item-title">{l.action}</p>
                                    <p className="ds-list-item-meta">
                                        {l.description} {l.user ? `· by ${l.user.name}` : ''}
                                    </p>
                                </div>
                                <span className="ds-list-item-meta">{new Date(l.created_at).toLocaleString()}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {!loading && (
                <p className="ds-card-desc" style={{ marginTop: 4 }}>
                    Looking for claim, item, or storage activity? Open <Link to="/admin/users">Users</Link>, pick the account, and check its Activity tab — it's scoped to that one account so it's easier to review.
                </p>
            )}
        </DashboardShell>
    );
}
