import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

const STATUS_BADGE = {
    pending: 'ds-badge ds-badge-pending',
    approved: 'ds-badge ds-badge-found',
    rejected: 'ds-badge ds-badge-rejected',
    executed: 'ds-badge ds-badge-default',
};
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', executed: 'Done' };
const FILTERS = [['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['executed', 'Done']];

/**
 * Admin: the queue of staff requests, with Approve / Pending / Reject.
 * Staff:  the same page, read-only, showing only their own requests.
 */
export default function AdminActionRequests() {
    const { roles } = useAuth();
    const isAdmin = Array.isArray(roles) && roles.includes('admin');
    const toast = useToast();
    const confirm = useConfirm();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    // Arriving from a bell notification (?request=ID): show every status so the
    // request is visible whatever state it is in, and highlight its row.
    const [searchParams] = useSearchParams();
    const focusId = Number(searchParams.get('request')) || null;
    const [status, setStatus] = useState(isAdmin && !focusId ? 'pending' : '');
    const [busyId, setBusyId] = useState(null);

    useEffect(() => { document.title = 'Staff Requests | SCLF - Opol Community College'; }, []);

    const load = useCallback(() => {
        setLoading(true);
        axios.get('/action-requests', { params: status ? { status } : {} })
            .then((res) => setRows(res.data.data))
            .finally(() => setLoading(false));
    }, [status]);

    useEffect(() => { load(); }, [load]);

    const review = async (row, next) => {
        let note = null;
        if (next === 'rejected') {
            const ok = await confirm({
                title: 'Reject this request?',
                message: `${row.requester?.name} will not be able to do: ${row.summary}`,
                confirmLabel: 'Reject',
                tone: 'danger',
            });
            if (!ok) return;
        }
        setBusyId(row.id);
        try {
            await axios.patch(`/admin/action-requests/${row.id}`, { status: next, review_note: note });
            toast.success(next === 'approved'
                ? 'Approved. Staff can now do it once.'
                : next === 'rejected' ? 'Request rejected.' : 'Moved back to pending.');
            load();
        } finally {
            setBusyId(null);
        }
    };

    const withdraw = async (row) => {
        const ok = await confirm({ title: 'Withdraw request?', message: row.summary, confirmLabel: 'Withdraw', tone: 'danger' });
        if (!ok) return;
        setBusyId(row.id);
        try {
            await axios.delete(`/action-requests/${row.id}`);
            toast.success('Request withdrawn.');
            load();
        } finally {
            setBusyId(null);
        }
    };

    return (
        <DashboardShell onRefresh={() => load()} refreshing={loading}
            eyebrow={isAdmin ? 'Admin' : 'Staff'}
            title={isAdmin ? 'Staff Requests' : 'My Requests'}
            subtitle={isAdmin
                ? 'Staff can view everything but need your approval to change anything. An approval works once, for that exact action, and expires after a day.'
                : 'Changes you asked the admin for. When one is Approved, go back and repeat the action — it works once.'}
        >
            <div className="ds-card">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {FILTERS.map(([value, label]) => (
                        <button
                            key={value || 'all'}
                            type="button"
                            className={`ds-btn ds-btn-sm ${status === value ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                            onClick={() => setStatus(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {loading && <div className="ds-skeleton" />}
                {!loading && rows.length === 0 && <div className="ds-empty">No requests here.</div>}

                {!loading && rows.length > 0 && (
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    {isAdmin && <th>Staff</th>}
                                    <th>Request</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th>Sent</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} style={r.id === focusId ? { outline: '2px solid var(--ds-accent, #2563eb)', outlineOffset: -2 } : undefined}>
                                        {isAdmin && (
                                            <td className="ds-table-nowrap">
                                                {r.requester?.name}
                                                <div className="ds-table-sub">{r.requester?.staff_id || r.requester?.email}</div>
                                            </td>
                                        )}
                                        <td style={{ whiteSpace: 'normal', maxWidth: 260 }}>
                                            <div className="ds-table-title">{r.summary}</div>
                                            {r.payload && (
                                                <div className="ds-table-sub">
                                                    {Object.entries(r.payload).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="ds-table-sub" style={{ whiteSpace: 'normal', maxWidth: 240 }}>{r.reason || '—'}</td>
                                        <td className="ds-table-nowrap">
                                            <span className={STATUS_BADGE[r.status] || STATUS_BADGE.executed}>{STATUS_LABEL[r.status] || r.status}</span>
                                        </td>
                                        <td className="ds-table-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {isAdmin && r.status !== 'executed' && (
                                                    <>
                                                        <button className="ds-btn ds-btn-sm ds-btn-success" disabled={busyId === r.id || r.status === 'approved'} onClick={() => review(r, 'approved')}>Approve</button>
                                                        <button className="ds-btn ds-btn-sm ds-btn-secondary" disabled={busyId === r.id || r.status === 'pending'} onClick={() => review(r, 'pending')}>Pending</button>
                                                        <button className="ds-btn ds-btn-sm ds-btn-danger" disabled={busyId === r.id || r.status === 'rejected'} onClick={() => review(r, 'rejected')}>Reject</button>
                                                    </>
                                                )}
                                                {!isAdmin && r.status === 'pending' && (
                                                    <button className="ds-btn ds-btn-sm ds-btn-secondary" disabled={busyId === r.id} onClick={() => withdraw(r)}>Withdraw</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
