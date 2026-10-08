import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import { X, ExternalLink } from '../icons';
import './StaffRequestDetails.css';

const STATUS_BADGE = {
    pending: 'ds-badge ds-badge-pending',
    approved: 'ds-badge ds-badge-found',
    rejected: 'ds-badge ds-badge-rejected',
    executed: 'ds-badge ds-badge-default',
};
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', executed: 'Done' };

const METHOD_LABEL = { POST: 'Create / do', PUT: 'Edit', PATCH: 'Edit', DELETE: 'Delete' };

// Where the record a request points at can be opened in the app.
const RECORD_LINKS = [
    ['api/admin/users/', (id) => `/app/admin/users/${id}`, 'account'],
    ['api/security-incidents/', (id) => `/app/incidents/${id}`, 'incident'],
    ['api/service-requests/', (id) => `/app/service-requests/${id}`, 'service request'],
    ['api/claims/', (id) => `/app/claims/${id}`, 'claim'],
    ['api/found-items/', (id) => `/app/found-items/${id}`, 'found item'],
    ['api/assets/', (id) => `/app/assets/${id}`, 'asset'],
];

const humanize = (key) => String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatValue = (key, value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key === 'role') return humanize(value);
    return String(value);
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');

const targetId = (row) => {
    const m = row.subject_key?.match(/(?:^|&)(?:[A-Za-z]+)=(\d+)/);
    return m ? m[1] : null;
};

/**
 * Full view of one staff approval request: who asked, what exactly they want
 * to do, why, every field they were about to send, the record it targets
 * (with current-vs-requested values for account edits), and the review
 * history. The admin can approve / hold / reject straight from here.
 *
 * Rendered through a portal into <body>, so it re-wraps itself in the
 * .ds-shell theme classes the opener passes in (`shellClass`) — that keeps
 * buttons, badges and card colors on the active theme.
 */
export default function StaffRequestDetailsModal({ row, shellClass = 'light', isAdmin, busy, onReview, onClose }) {
    const [note, setNote] = useState('');
    const [target, setTarget] = useState(null); // current state of the targeted account, when known
    const [targetLoading, setTargetLoading] = useState(false);

    const id = targetId(row);
    const isUserRoute = row.route_uri?.startsWith('api/admin/users/') && id;
    const link = useMemo(() => {
        if (!id) return null;
        const hit = RECORD_LINKS.find(([prefix]) => row.route_uri?.startsWith(prefix));
        return hit ? { to: hit[1](id), label: hit[2] } : null;
    }, [row.route_uri, id]);

    useEffect(() => { setNote(''); }, [row.id]);

    // Close on Escape.
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // For requests that touch an account, load it so the admin sees WHO it
    // affects and, for an edit, what changes from → to.
    useEffect(() => {
        if (!isAdmin || !isUserRoute) { setTarget(null); return undefined; }
        let cancelled = false;
        setTargetLoading(true);
        axios.get(`/admin/users/${id}`, { silent: true })
            .then((res) => { if (!cancelled) setTarget(res.data.data); })
            .catch(() => { if (!cancelled) setTarget(null); })
            .finally(() => { if (!cancelled) setTargetLoading(false); });
        return () => { cancelled = true; };
    }, [isAdmin, isUserRoute, id]);

    const currentValue = (field) => {
        if (!target) return undefined;
        if (field === 'role') return target.roles?.[0]?.name;
        return target[field];
    };

    const payloadEntries = Object.entries(row.payload || {});
    const isEdit = ['PUT', 'PATCH'].includes(row.method);
    const showCompare = isEdit && !!target;
    const canReview = isAdmin && row.status !== 'executed';

    return createPortal(
        <div className={`ds-shell ${shellClass} srd-root`}>
            <div className="srd-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="ds-card srd-card" role="dialog" aria-modal="true" aria-labelledby="srd-title">
                    <div className="srd-head">
                        <div>
                            <div className="srd-eyebrow">Request #{row.id} · {METHOD_LABEL[row.method] || row.method}</div>
                            <h3 id="srd-title" className="srd-title">{row.summary}</h3>
                        </div>
                        <div className="srd-head-right">
                            <span className={STATUS_BADGE[row.status] || STATUS_BADGE.executed}>{STATUS_LABEL[row.status] || row.status}</span>
                            <button type="button" className="srd-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
                        </div>
                    </div>

                    <div className="srd-body">
                        {/* ---- who ---- */}
                        <section className="srd-section">
                            <h4>Requested by</h4>
                            <dl className="srd-dl">
                                <div><dt>Name</dt><dd>{row.requester?.name || '—'}</dd></div>
                                <div><dt>Staff ID</dt><dd>{row.requester?.staff_id || '—'}</dd></div>
                                <div><dt>Email</dt><dd>{row.requester?.email || '—'}</dd></div>
                                <div><dt>Sent</dt><dd>{fmtDate(row.created_at)}</dd></div>
                            </dl>
                        </section>

                        {/* ---- why ---- */}
                        <section className="srd-section">
                            <h4>Reason given</h4>
                            <p className="srd-reason">{row.reason || 'No reason was given.'}</p>
                        </section>

                        {/* ---- what ---- */}
                        <section className="srd-section">
                            <h4>What they want to do</h4>
                            <p className="srd-what">{row.summary}</p>
                            <div className="srd-tech">
                                <code>{row.method} /{String(row.route_uri || '').replace(/^api\//, '')}</code>
                                {row.subject_key && <code>{row.subject_key.replace(/=/g, ' #').replace(/&/g, ' · ')}</code>}
                            </div>
                        </section>

                        {/* ---- the record it affects ---- */}
                        {isUserRoute && (
                            <section className="srd-section">
                                <h4>Account this affects</h4>
                                {targetLoading && <p className="srd-muted">Loading account…</p>}
                                {!targetLoading && !target && <p className="srd-muted">Account #{id} could not be loaded (it may have been removed).</p>}
                                {target && (
                                    <dl className="srd-dl">
                                        <div><dt>Name</dt><dd>{target.name}</dd></div>
                                        <div><dt>Email</dt><dd>{target.email}</dd></div>
                                        <div><dt>Role</dt><dd>{formatValue('role', target.roles?.[0]?.name)}</dd></div>
                                        <div><dt>Account</dt><dd>{target.is_active === false || target.deleted_at ? 'Disabled' : 'Active'}</dd></div>
                                    </dl>
                                )}
                            </section>
                        )}

                        {/* ---- full payload ---- */}
                        <section className="srd-section">
                            <h4>{showCompare ? 'Requested changes' : 'Details they submitted'}</h4>
                            {payloadEntries.length === 0 ? (
                                <p className="srd-muted">
                                    {row.method === 'DELETE'
                                        ? 'No extra details — this is a delete request for the record above.'
                                        : 'No extra fields were attached to this request.'}
                                </p>
                            ) : (
                                <div className="srd-table-wrap">
                                    <table className="srd-table">
                                        <thead>
                                            <tr>
                                                <th>Field</th>
                                                {showCompare && <th>Current</th>}
                                                <th>{showCompare ? 'Requested' : 'Value'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payloadEntries.map(([k, v]) => {
                                                const cur = currentValue(k);
                                                const changed = showCompare && cur !== undefined && String(cur ?? '') !== String(v ?? '');
                                                return (
                                                    <tr key={k} className={changed ? 'is-changed' : ''}>
                                                        <th scope="row">{humanize(k)}</th>
                                                        {showCompare && <td>{cur === undefined ? '—' : formatValue(k, cur)}</td>}
                                                        <td>{formatValue(k, v)}{changed && <span className="srd-changed">changed</span>}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="srd-muted srd-fine">Passwords, codes and tokens are never stored in a request.</p>
                        </section>

                        {/* ---- review history ---- */}
                        <section className="srd-section">
                            <h4>Review</h4>
                            <dl className="srd-dl">
                                <div><dt>Reviewed by</dt><dd>{row.reviewer?.name || '—'}</dd></div>
                                <div><dt>Reviewed at</dt><dd>{fmtDate(row.reviewed_at)}</dd></div>
                                {row.status === 'approved' && <div><dt>Approval expires</dt><dd>{fmtDate(row.expires_at)}</dd></div>}
                                {row.executed_at && <div><dt>Carried out</dt><dd>{fmtDate(row.executed_at)}</dd></div>}
                            </dl>
                            {row.review_note && (
                                <p className="srd-reason" style={{ marginTop: 8 }}><strong>Note to staff:</strong> {row.review_note}</p>
                            )}
                        </section>

                        {canReview && (
                            <section className="srd-section">
                                <h4>Your decision</h4>
                                <textarea
                                    className="srd-note"
                                    rows={2}
                                    maxLength={500}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Optional note to the staff member (shown in their notification)…"
                                />
                            </section>
                        )}
                    </div>

                    <div className="srd-foot">
                        {link && (
                            <Link to={link.to} className="ds-btn ds-btn-secondary ds-btn-sm" onClick={onClose}>
                                <ExternalLink size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Open {link.label}
                            </Link>
                        )}
                        <span className="srd-spacer" />
                        {canReview && (
                            <>
                                <button className="ds-btn ds-btn-sm ds-btn-success" disabled={busy || row.status === 'approved'} onClick={() => onReview(row, 'approved', note.trim() || null)}>Approve</button>
                                <button className="ds-btn ds-btn-sm ds-btn-secondary" disabled={busy || row.status === 'pending'} onClick={() => onReview(row, 'pending', note.trim() || null)}>Pending</button>
                                <button className="ds-btn ds-btn-sm ds-btn-danger" disabled={busy || row.status === 'rejected'} onClick={() => onReview(row, 'rejected', note.trim() || null)}>Reject</button>
                            </>
                        )}
                        <button type="button" className="ds-btn ds-btn-sm ds-btn-secondary" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
