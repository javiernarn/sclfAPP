import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';

export default function AdminAuditLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = "Audit Log | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        axios.get('/audit-logs')
            .then(res => setLogs(res.data.data))
            .finally(() => setLoading(false));
    }, []);

    return (
        <DashboardShell eyebrow="Admin" title="Audit Log" subtitle="Every sensitive action taken across SCLF, most recent first.">
            <div className="ds-card">
                {loading && <div className="ds-skeleton" />}
                {!loading && logs.length === 0 && <div className="ds-empty">No audit entries yet.</div>}
                {!loading && logs.length > 0 && (
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
        </DashboardShell>
    );
}
