import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../icons';
import { roleAndName } from '../../utils/roleLabel';
import VisitorBadgeFlip from './VisitorBadgeFlip';
import './StaffRequestDetails.css'; // shared modal chrome (srd-*)
import './VisitorDetailsModal.css';

const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');
const val = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
const humanize = (v) => String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const duration = (from, to) => {
    const mins = Math.max(0, Math.floor(((to ? new Date(to) : new Date()) - new Date(from)) / 60000));
    const d = Math.floor(mins / 1440); const h = Math.floor((mins % 1440) / 60); const m = mins % 60;
    return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`].filter(Boolean).join(' ');
};

function Field({ label, children }) {
    return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

/**
 * Read-only, full record of one visitor entry — for admin, staff and security.
 * Portaled into <body>, so the opener passes its theme classes (`shellClass`).
 */
export default function VisitorDetailsModal({ visitor: v, shellClass = 'light', onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const inside = v.status === 'checked_in';
    const hasStudent = !!(v.student_name || v.student);

    return createPortal(
        <div className={`ds-shell ${shellClass} srd-root`}>
            <div className="srd-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="ds-card srd-card vdm-card" role="dialog" aria-modal="true" aria-labelledby="vdm-title">
                    <div className="srd-head">
                        <div>
                            <div className="srd-eyebrow">Visitor entry #{v.id}</div>
                            <h3 id="vdm-title" className="srd-title">{v.full_name}</h3>
                        </div>
                        <div className="srd-head-right">
                            <span className={`ds-badge ${inside ? 'ds-badge-found' : 'ds-badge-default'}`}>{inside ? 'On campus' : 'Checked out'}</span>
                            <button type="button" className="srd-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
                        </div>
                    </div>

                    <div className="srd-body vdm-body">
                        <div className="vdm-main">
                            <section className="srd-section">
                                <h4>Visitor</h4>
                                <dl className="srd-dl">
                                    <Field label="Full name">{val(v.full_name)}</Field>
                                    <Field label="ID presented">{val(v.id_presented)}</Field>
                                    <Field label="ID number">{val(v.id_number)}</Field>
                                    <Field label="Contact number">{val(v.contact_number)}</Field>
                                </dl>
                            </section>

                            <section className="srd-section">
                                <h4>Visit</h4>
                                <dl className="srd-dl">
                                    <Field label="Purpose">{humanize(v.purpose) || '—'}</Field>
                                    <Field label="Host / person visiting">{val(v.host_name)}</Field>
                                    <Field label="Host's department">{val(v.host_department)}</Field>
                                    <Field label="Campus">{val(v.campus?.name)}</Field>
                                </dl>
                                <p className="srd-muted" style={{ marginTop: 10 }}><strong>Notes:</strong> {v.notes ? v.notes : 'None'}</p>
                            </section>

                            {hasStudent && (
                                <section className="srd-section">
                                    <h4>Student being visited</h4>
                                    <dl className="srd-dl">
                                        <Field label="Name">{val(v.student_name || v.student?.name)}</Field>
                                        <Field label="Student ID">{val(v.student_number || v.student?.student_id)}</Field>
                                        <Field label="Course">{val(v.student?.course)}</Field>
                                        <Field label="Relationship">{humanize(v.relationship) || '—'}</Field>
                                    </dl>
                                </section>
                            )}

                            <section className="srd-section">
                                <h4>Check-in / check-out</h4>
                                <dl className="srd-dl">
                                    <Field label="Checked in">{fmt(v.checked_in_at)}</Field>
                                    <Field label="Checked in by">{v.checked_in_by ? roleAndName(v.checked_in_by) : '—'}</Field>
                                    <Field label="Checked out">{inside ? 'Not yet — badge not returned' : fmt(v.checked_out_at)}</Field>
                                    <Field label="Checked out by">{v.checked_out_by ? roleAndName(v.checked_out_by) : '—'}</Field>
                                    <Field label={inside ? 'Time inside so far' : 'Total time on campus'}>{duration(v.checked_in_at, inside ? null : v.checked_out_at)}</Field>
                                    <Field label="Badge cycle (round)">{val(v.badge_cycle)}</Field>
                                </dl>
                            </section>
                        </div>

                        <aside className="vdm-badge">
                            <h4>Badge {v.badge_number ? `#${v.badge_number}` : ''}</h4>
                            {v.badge_number
                                ? <VisitorBadgeFlip label={v.badge_number} width={170} />
                                : <p className="srd-muted">No badge recorded.</p>}
                        </aside>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
