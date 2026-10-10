import React, { useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import { UserCheck, UserX, Users, Clock, LogOut, Pencil, Trash2, Check, X, Search, GraduationCap, AlertTriangle, Tag, Eye } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { COURSE_GROUPS } from '../../config/courseGroups';
import { roleAndName } from '../../utils/roleLabel';
import VisitorDetailsModal from '../../Components/shared/VisitorDetailsModal';
import VisitorBadgeFlip, { dayColorFor } from '../../Components/shared/VisitorBadgeFlip';
import { filterPhoneInput, isValidPhone, FORMAT_ERRORS, FORMAT_HINTS } from '../../utils/validators';
import { PH_ID_GROUPS, PH_ID_OPTIONS, OTHER_ID_VALUE } from '../../config/philippineIds';

const PURPOSE_OPTIONS = [
    { value: 'meeting', label: 'Meeting' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'event', label: 'Event' },
    { value: 'interview', label: 'Interview' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'parent_guardian', label: 'Parent / Guardian visit' },
    { value: 'other', label: 'Other' },
];

const RELATIONSHIP_OPTIONS = [
    { value: 'parent', label: 'Parent' },
    { value: 'guardian', label: 'Guardian' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'relative', label: 'Relative' },
    { value: 'other', label: 'Other' },
];

const STATUS_FILTERS = [
    { value: 'inside', label: 'Inside campus (badge not returned)' },
    { value: 'checked_out', label: 'Checked out' },
    { value: 'all', label: 'All' },
];

// Past this many hours inside, a visitor is flagged so security can follow up.
const OVERDUE_HOURS = 4;

const EMPTY_FORM = {
    full_name: '', id_presented: '', id_number: '', contact_number: '', purpose: 'meeting',
    host_name: '', host_department: '', badge_number: '', notes: '',
    student_user_id: '', student_label: '', relationship: 'parent',
};

const durationLabel = (from, to = Date.now()) => {
    const mins = Math.max(0, Math.floor((new Date(to) - new Date(from)) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const isOverdue = (visitor) => visitor.status === 'checked_in'
    && (Date.now() - new Date(visitor.checked_in_at).getTime()) > OVERDUE_HOURS * 3600000;

// Badge picker: today's pool (M-01..M-200 on Monday, T-01..T-200 on Tuesday, ...).
//  - red  = still with a visitor (not checked out)
//  - grey = issued this round and already returned: locked until the whole
//           pool has been issued, then numbering starts again from the low end
//  - white = available
function BadgePicker({ value, onChange, includeVisitorId, refreshKey = 0, error }) {
    const [pool, setPool] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const [prefix, setPrefix] = useState(''); // '' = server default (today's letter)

    useEffect(() => {
        let cancelled = false;
        const params = {};
        if (includeVisitorId) params.visitor_id = includeVisitorId;
        if (prefix) params.prefix = prefix;
        axios.get('/visitors/badges', { params, silent: true })
            .then((res) => { if (!cancelled) { setPool(res.data.data); setLoadError(false); } })
            .catch(() => { if (!cancelled) setLoadError(true); });
        return () => { cancelled = true; };
    }, [refreshKey, includeVisitorId, prefix]);

    if (loadError) return <p className="ds-field-error">Could not load the badge list. Refresh the page.</p>;
    if (!pool) return <div className="ds-skeleton" style={{ height: 80 }} />;

    const styleFor = (b) => {
        const selected = value === b.label;
        const base = {
            minWidth: 58, padding: '5px 6px', fontSize: 12, fontWeight: 700, borderRadius: 8,
            border: '1.5px solid #c3ccdb', background: 'transparent', color: 'inherit', cursor: 'pointer',
        };
        if (selected) { const dc = dayColorFor(b.label); return { ...base, background: dc, borderColor: dc, color: '#fff', transition: 'background 0.3s' }; }
        if (b.state === 'in_use') return { ...base, background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)', color: '#dc2626', cursor: 'not-allowed' };
        if (b.state === 'returned') return { ...base, opacity: 0.4, cursor: 'not-allowed', textDecoration: 'line-through' };
        return base;
    };

    const titleFor = (b) => {
        if (b.state === 'in_use') return `${b.label} — with ${b.holder} (not checked out)`;
        if (b.state === 'returned') return `${b.label} — returned, available again next round`;
        return `${b.label} — available`;
    };

    return (
        <div>
            <div className="ds-chip-row" style={{ marginTop: 0, marginBottom: 8 }}>
                <select value={pool.prefix} aria-label="Badge set"
                    style={{ width: 'auto', minWidth: 190 }}
                    onChange={(e) => {
                        const next = e.target.value;
                        setPrefix(next);
                        if (value && !value.startsWith(`${next}-`)) onChange('');
                    }}>
                    {pool.sets.map((st) => (
                        <option key={st.prefix} value={st.prefix}>
                            {st.day} ({st.prefix}-01…){st.prefix === pool.today_prefix ? ' — today' : ''}
                        </option>
                    ))}
                </select>
                <span className="ds-chip ds-chip-accent">Round {pool.round}</span>
                <span className="ds-chip">Available: <strong>{pool.counts.available}</strong></span>
                <span className="ds-chip">Not checked out: <strong>{pool.counts.in_use}</strong></span>
                <span className="ds-chip">Locked until next round: <strong>{pool.counts.waiting}</strong></span>
                {pool.next && (
                    <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={() => onChange(pool.next)}>
                        Use next: {pool.next}
                    </button>
                )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 400, overflowY: 'auto', padding: 4, border: '1px solid #c3ccdb', borderRadius: 10, alignContent: 'flex-start' }}>
                    {pool.badges.map((b) => (
                        <button key={b.label} type="button" style={styleFor(b)} title={titleFor(b)}
                            aria-pressed={value === b.label}
                            disabled={b.state !== 'available' && value !== b.label}
                            onClick={() => onChange(b.label)}>
                            {b.label}
                        </button>
                    ))}
                </div>
                {/* Full badge (front/back). Follows the selection: pick S-23 and it
                    becomes S-23 in Saturday's colour; before a pick it previews the
                    next badge of the chosen day set. */}
                <VisitorBadgeFlip
                    label={value || pool.next || `${pool.prefix}-01`}
                    preview={!value}
                    width={230}
                />
            </div>
            <p className="ds-list-item-meta" style={{ marginTop: 6 }}>
                {value ? <>Selected badge: <strong>{value}</strong></> : 'Tap a badge to select it.'}
                <br />
                Red = not checked out · Faded = returned, locked until the pool is used up.
            </p>
            {error && <p className="ds-field-error">{error}</p>}
        </div>
    );
}

// Typeahead: find the student (the visitor's child) by name or student ID.
function StudentPicker({ valueId, valueLabel, onSelect, onClear, error }) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [searching, setSearching] = useState(false);
    const timer = useRef(null);

    useEffect(() => {
        clearTimeout(timer.current);
        if (valueId || q.trim().length < 2) { setResults([]); return undefined; }
        timer.current = setTimeout(() => {
            setSearching(true);
            axios.get('/visitors/student-search', { params: { q: q.trim() }, silent: true })
                .then((res) => { setResults(res.data.data || []); setOpen(true); })
                .catch(() => setResults([]))
                .finally(() => setSearching(false));
        }, 250);
        return () => clearTimeout(timer.current);
    }, [q, valueId]);

    if (valueId) {
        return (
            <div className="ds-chip-row" style={{ marginTop: 0 }}>
                <span className="ds-chip ds-chip-accent">
                    <GraduationCap size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {valueLabel}
                </span>
                <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={onClear}>
                    <X size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> Change
                </button>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            <input
                value={q}
                placeholder="Search student name or student ID"
                aria-label="Search student"
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => results.length && setOpen(true)}
                aria-invalid={!!error}
            />
            {open && (q.trim().length >= 2) && (
                <ul className="ds-list" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, maxHeight: 240, overflowY: 'auto', background: 'var(--ds-surface, #fff)', border: '1px solid #c3ccdb', borderRadius: 10 }}>
                    {searching && <li className="ds-list-item"><span className="ds-list-item-meta">Searching…</span></li>}
                    {!searching && results.length === 0 && <li className="ds-list-item"><span className="ds-list-item-meta">No matching student.</span></li>}
                    {results.map((st) => (
                        <li key={st.id} className="ds-list-item" style={{ cursor: 'pointer' }}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onSelect(st);
                                setQ(''); setOpen(false);
                            }}>
                            <div>
                                <p className="ds-list-item-title">{st.name}</p>
                                <p className="ds-list-item-meta">{st.student_id || 'No student ID'}{st.course ? ` · ${st.course}` : ''}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {error && <p className="ds-field-error">{error}</p>}
        </div>
    );
}

// "ID presented" picker: a select of Philippine IDs plus "Other (specify)",
// which reveals a text box. A value that isn't in the list (an older
// free-text entry, or something typed under Other) is shown under Other so
// editing an existing visitor never blanks it out.
function IdPresentedSelect({ value, onChange, name }) {
    const known = PH_ID_OPTIONS.includes(value);
    const [otherPicked, setOtherPicked] = useState(false);
    const isOther = otherPicked || (!!value && !known);

    const handleSelect = (e) => {
        const next = e.target.value;
        if (next === OTHER_ID_VALUE) {
            setOtherPicked(true);
            onChange(known ? '' : value);
        } else {
            setOtherPicked(false);
            onChange(next);
        }
    };

    return (
        <>
            <select name={name} value={isOther ? OTHER_ID_VALUE : value} onChange={handleSelect}>
                <option value="">Select ID presented</option>
                {PH_ID_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                        {group.ids.map((id) => <option key={id} value={id}>{id}</option>)}
                    </optgroup>
                ))}
                <option value={OTHER_ID_VALUE}>Other (specify)</option>
            </select>
            {isOther && (
                <input
                    style={{ marginTop: 8 }}
                    value={value}
                    maxLength={100}
                    placeholder="Type the ID presented"
                    aria-label="Other ID presented"
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
        </>
    );
}

function DepartmentSelect({ value, onChange, name }) {
    // Keep any older free-text value selectable so editing an existing visitor doesn't blank it out.
    const known = COURSE_GROUPS.some((g) => g.courses.includes(value));
    return (
        <select name={name} value={value} onChange={onChange}>
            <option value="">Select department / course</option>
            {value && !known && <option value={value}>{value}</option>}
            {COURSE_GROUPS.map((group) => (
                <optgroup key={group.college} label={group.college}>
                    {group.courses.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}

const TABLE_COLUMNS = 7;

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '—');
const purposeLabel = (value) => PURPOSE_OPTIONS.find((o) => o.value === value)?.label || value || '—';

// One visitor record, rendered either as a card row ("cards" view) or a
// table row ("table" view). All the check-out / edit / delete logic is
// shared; only the markup at the bottom differs.
function VisitorRow({ visitor, onCheckedOut, onUpdated, onDeleted, isAdmin, view = 'cards' }) {
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [contactError, setContactError] = useState('');
    const [viewing, setViewing] = useState(null); // theme classes of the page while the details modal is open
    const toast = useToast();
    const confirm = useConfirm();

    // The details modal is portaled to <body>, so carry the page's theme over.
    const openView = (e) => {
        const shell = e.currentTarget.closest('.ds-shell');
        const classes = ['maroon', 'blue', 'yellow'].filter((c) => shell?.classList.contains(c));
        classes.push(shell?.classList.contains('dark') ? 'dark' : 'light');
        setViewing(classes.join(' '));
    };
    const detailsModal = viewing
        ? <VisitorDetailsModal visitor={visitor} shellClass={viewing} onClose={() => setViewing(null)} />
        : null;

    const checkOut = async () => {
        const ok = await confirm({
            title: 'Check out and collect badge?',
            message: visitor.badge_number
                ? `Make sure you have received badge #${visitor.badge_number} back from ${visitor.full_name}.`
                : `Check ${visitor.full_name} out?`,
            confirmLabel: 'Badge received — check out',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await axios.post(`/visitors/${visitor.id}/check-out`, {});
            toast.success(`${visitor.full_name} checked out.`, { title: 'Checked out' });
            onCheckedOut(res.data.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not check this visitor out.', { title: 'Could not check out' });
        } finally {
            setBusy(false);
        }
    };

    const startEditing = () => {
        setForm({
            full_name: visitor.full_name || '',
            id_presented: visitor.id_presented || '',
            id_number: visitor.id_number || '',
            purpose: visitor.purpose || 'meeting',
            host_name: visitor.host_name || '',
            host_department: visitor.host_department || '',
            badge_number: visitor.badge_number || '',
            contact_number: filterPhoneInput(visitor.contact_number || ''),
            student_user_id: visitor.student_user_id || '',
            student_label: visitor.student_name ? `${visitor.student_name}${visitor.student_number ? ` (${visitor.student_number})` : ''}` : '',
            relationship: visitor.relationship || 'parent',
            notes: visitor.notes || '',
        });
        setEditing(true);
    };

    const save = async () => {
        const phone = String(form.contact_number || '').trim();
        if (!phone) { setContactError('Contact number is required.'); return; }
        if (!isValidPhone(phone)) { setContactError(FORMAT_ERRORS.phone); return; }
        setContactError('');
        setSaving(true);
        try {
            const { student_label, ...payload } = form;
            if (payload.purpose !== 'parent_guardian') { payload.student_user_id = null; payload.relationship = null; }
            const res = await axios.patch(`/visitors/${visitor.id}`, payload);
            toast.success('Visitor entry updated.', { title: 'Saved' });
            setEditing(false);
            onUpdated(res.data.data);
        } catch (err) {
            const errors = err?.response?.data?.errors;
            const message = errors ? Object.values(errors).flat().join('\n') : (err?.response?.data?.message || 'Could not update this entry.');
            toast.error(message, { title: 'Could not save' });
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        const ok = await confirm({
            title: 'Delete this visitor entry?',
            message: `Remove the log entry for ${visitor.full_name} entirely? This cannot be undone.`,
            confirmLabel: 'Delete entry',
            tone: 'danger',
        });
        if (!ok) return;

        setDeleting(true);
        try {
            await axios.delete(`/visitors/${visitor.id}`);
            toast.success('Visitor entry deleted.', { title: 'Deleted' });
            onDeleted(visitor.id);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not delete this entry.', { title: 'Delete failed' });
        } finally {
            setDeleting(false);
        }
    };

    const editForm = !editing || !form ? null : (
        <>
                <div className="ds-form-row ds-form-row-2">
                    <div className="ds-field">
                        <label>Full name</label>
                        <input value={form.full_name} maxLength={150} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                    </div>
                    <div className="ds-field">
                        <label>Purpose</label>
                        <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
                            {PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="ds-form-row ds-form-row-2">
                    <div className="ds-field">
                        <label>ID presented</label>
                        <IdPresentedSelect value={form.id_presented} onChange={(v) => setForm({ ...form, id_presented: v })} />
                    </div>
                    <div className="ds-field">
                        <label>ID number</label>
                        <input value={form.id_number} maxLength={100} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
                    </div>
                </div>
                <div className="ds-form-row ds-form-row-2">
                    <div className="ds-field">
                        <label>Host</label>
                        <input value={form.host_name} maxLength={150} onChange={(e) => setForm({ ...form, host_name: e.target.value })} />
                    </div>
                    <div className="ds-field">
                        <label>Host's department</label>
                        <DepartmentSelect value={form.host_department} onChange={(e) => setForm({ ...form, host_department: e.target.value })} />
                    </div>
                </div>
                <div className="ds-form-row">
                    <div className="ds-field">
                        <label>Badge number *</label>
                        {visitor.status === 'checked_in'
                            ? <BadgePicker value={form.badge_number} includeVisitorId={visitor.id}
                                onChange={(label) => setForm({ ...form, badge_number: label })} />
                            : <input value={form.badge_number} disabled aria-label="Badge number (returned)" />}
                    </div>
                </div>
                <div className="ds-form-row ds-form-row-2">
                    <div className="ds-field">
                        <label>Contact number *</label>
                        <input value={form.contact_number} inputMode="numeric" maxLength={11} placeholder="09XXXXXXXXX"
                            title={FORMAT_HINTS.phone} autoComplete="tel" required
                            aria-invalid={!!contactError}
                            onChange={(e) => { setContactError(''); setForm({ ...form, contact_number: filterPhoneInput(e.target.value) }); }} />
                        {contactError && <p className="ds-field-error">{contactError}</p>}
                    </div>
                </div>
                {form.purpose === 'parent_guardian' && (
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Child / student being visited *</label>
                            <StudentPicker valueId={form.student_user_id} valueLabel={form.student_label}
                                onSelect={(st) => setForm({ ...form, student_user_id: st.id, student_label: `${st.name}${st.student_id ? ` (${st.student_id})` : ''}` })}
                                onClear={() => setForm({ ...form, student_user_id: '', student_label: '' })} />
                        </div>
                        <div className="ds-field">
                            <label>Relationship</label>
                            <select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
                                {RELATIONSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>
                )}
                <div className="ds-form-row">
                    <div className="ds-field">
                        <label>Notes</label>
                        <input value={form.notes} maxLength={1000} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>
                </div>
                <div className="ds-visitor-edit-actions">
                    <button type="button" className="ds-btn ds-btn-primary ds-btn-sm" disabled={saving} onClick={save}>
                        <Check size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> Save
                    </button>
                    <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" disabled={saving} onClick={() => setEditing(false)}>
                        <X size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> Cancel
                    </button>
                </div>
        </>
    );

    const actionButtons = (
        <>
            <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={openView} title="View all details" aria-label="View all details">
                <Eye size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> View
            </button>
            {visitor.status === 'checked_in' && (
                <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" disabled={busy} onClick={checkOut}>
                    <LogOut size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Check Out
                </button>
            )}
            <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={startEditing} title="Edit entry" aria-label="Edit entry">
                <Pencil size={13} />
            </button>
            {isAdmin && (
                <button type="button" className="ds-btn ds-btn-danger ds-btn-sm" disabled={deleting} onClick={remove} title="Delete entry" aria-label="Delete entry">
                    <Trash2 size={13} />
                </button>
            )}
        </>
    );

    if (view === 'table') {
        if (editing) {
            return (
                <tr className="ds-visitor-edit-row">
                    <td colSpan={TABLE_COLUMNS}>{editForm}</td>
                </tr>
            );
        }
        const hostLine = [visitor.host_name, visitor.host_department && `(${visitor.host_department})`].filter(Boolean).join(' ');
        return (
            <tr>
                <td>
                    <div className="ds-table-title">{visitor.full_name}</div>
                    <div className="ds-table-sub">
                        {visitor.id_presented ? `${visitor.id_presented}${visitor.id_number ? ` · ${visitor.id_number}` : ''}` : 'No ID recorded'}
                    </div>
                    {visitor.contact_number && <div className="ds-table-sub">{visitor.contact_number}</div>}
                    {visitor.student_name && (
                        <div className="ds-table-sub">
                            <GraduationCap size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                            {visitor.relationship ? `${visitor.relationship} of ` : 'Visiting '}{visitor.student_name}{visitor.student_number ? ` (${visitor.student_number})` : ''}
                        </div>
                    )}
                </td>
                <td className="ds-table-nowrap" style={{ textTransform: 'capitalize' }}>{purposeLabel(visitor.purpose)}</td>
                <td>
                    <div className="ds-table-title" title={hostLine}>{visitor.host_name || '—'}</div>
                    {visitor.host_department && <div className="ds-table-sub" title={visitor.host_department}>{visitor.host_department}</div>}
                </td>
                <td className="ds-table-nowrap">
                    {visitor.badge_number
                        ? <span className={`ds-badge ${visitor.status === 'checked_in' ? 'ds-badge-pending' : 'ds-badge-default'}`}>#{visitor.badge_number}</span>
                        : '—'}
                    {visitor.status === 'checked_in' && <div className="ds-table-sub">not returned</div>}
                </td>
                <td className="ds-table-nowrap">
                    <div>{formatDateTime(visitor.checked_in_at)}</div>
                    <div className="ds-table-sub">by {roleAndName(visitor.checked_in_by)}</div>
                </td>
                <td className="ds-table-nowrap">
                    {visitor.status === 'checked_out'
                        ? (
                            <>
                                <span className="ds-badge ds-badge-default">Checked out</span>
                                {visitor.checked_out_at && <div className="ds-table-sub" style={{ marginTop: 4 }}>{formatDateTime(visitor.checked_out_at)}</div>}
                            </>
                        )
                        : (
                            <>
                                <span className="ds-badge ds-badge-found">On campus</span>
                                <div className="ds-table-sub" style={{ marginTop: 4, color: isOverdue(visitor) ? '#ef4444' : undefined }}>
                                    {isOverdue(visitor) && <AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}
                                    {durationLabel(visitor.checked_in_at)} inside
                                </div>
                            </>
                        )}
                </td>
                <td><div className="ds-table-actions">{actionButtons}</div>{detailsModal}</td>
            </tr>
        );
    }

    if (editing) {
        return (
            <li className="ds-list-item ds-visitor-edit-item">
                {editForm}
            </li>
        );
    }

    return (
        <li className="ds-list-item">
            <div className="ds-list-item-main" style={{ minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                    <p className="ds-list-item-title">{visitor.full_name}</p>
                    <p className="ds-list-item-meta">
                        {visitor.purpose}
                        {visitor.host_name ? ` · Visiting ${visitor.host_name}` : ''}
                        {visitor.host_department ? ` (${visitor.host_department})` : ''}
                        {visitor.badge_number ? ` · Badge #${visitor.badge_number}` : ''}
                        {visitor.contact_number ? ` · ${visitor.contact_number}` : ''}
                    </p>
                    {visitor.student_name && (
                        <p className="ds-list-item-meta">
                            <GraduationCap size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                            {visitor.relationship ? `${visitor.relationship} of ` : 'Visiting '}{visitor.student_name}{visitor.student_number ? ` (${visitor.student_number})` : ''}
                        </p>
                    )}
                    {visitor.status === 'checked_in' && (
                        <p className="ds-list-item-meta" style={{ color: isOverdue(visitor) ? '#ef4444' : undefined }}>
                            {isOverdue(visitor) && <AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}
                            {durationLabel(visitor.checked_in_at)} inside · badge not returned
                        </p>
                    )}
                    <p className="ds-list-item-meta">
                        <Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                        Checked in {new Date(visitor.checked_in_at).toLocaleString()} by {roleAndName(visitor.checked_in_by)}
                        {visitor.status === 'checked_out' && visitor.checked_out_at && (
                            ` · Checked out ${new Date(visitor.checked_out_at).toLocaleString()}`
                        )}
                    </p>
                </div>
            </div>
            <div className="ds-list-item-side">
                <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={openView} title="View all details">
                    <Eye size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> View
                </button>
                {detailsModal}
                {visitor.status === 'checked_in' && (
                    <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={checkOut}>
                        <LogOut size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Check Out
                    </button>
                )}
                {visitor.status === 'checked_out' && (
                    <span className="ds-badge ds-badge-default">Checked out</span>
                )}
                <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={startEditing} title="Edit entry">
                    <Pencil size={13} />
                </button>
                {isAdmin && (
                    <button type="button" className="ds-btn ds-btn-danger ds-btn-sm" disabled={deleting} onClick={remove} title="Delete entry">
                        <Trash2 size={13} />
                    </button>
                )}
            </div>
        </li>
    );
}

export default function SecurityVisitors() {
    const { roles } = useAuth();
    const isAdmin = Array.isArray(roles) && (roles.includes('admin') || roles.includes('staff'));
    const [form, setForm] = useState(EMPTY_FORM);
    const [badgeRefresh, setBadgeRefresh] = useState(0); // bumped after check-in/out so the badge grid reloads
    const [formKey, setFormKey] = useState(0); // bumped on reset so the ID picker drops its "Other" state
    const [visitors, setVisitors] = useState([]);
    const [onCampusCount, setOnCampusCount] = useState(0);
    const [statusFilter, setStatusFilter] = useState('inside');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [outstanding, setOutstanding] = useState([]);
    const [stats, setStats] = useState({ checked_in_today: 0, checked_out_today: 0 });
    const [view, setView] = useViewMode('visitors');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const toast = useToast();

    useEffect(() => {
        document.title = "Visitor Management | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/visitors', { params: { status: statusFilter, ...(search ? { search } : {}) } })
            .then((res) => {
                setVisitors(res.data.data?.data || []);
                setOnCampusCount(res.data.currently_on_campus || 0);
                setOutstanding(res.data.outstanding_badges || []);
                setStats(res.data.stats || { checked_in_today: 0, checked_out_today: 0 });
            })
            .catch((err) => {
                toast.error(err?.response?.data?.message || 'Could not load visitors.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, [statusFilter, search]);

    // Debounce the search box so we don't hit the API on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (fieldErrors[e.target.name]) {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[e.target.name]; return next; });
        }
    };

    const handleCheckIn = async (e) => {
        e.preventDefault();
        if (!form.badge_number) {
            setFieldErrors({ badge_number: 'Select the physical badge you are handing to this visitor.' });
            toast.error('Select a badge first.', { title: 'Badge required' });
            return;
        }
        if (!isValidPhone(form.contact_number)) {
            setFieldErrors({ contact_number: String(form.contact_number || '').trim() ? FORMAT_ERRORS.phone : 'Contact number is required.' });
            toast.error('Enter the visitor\'s Philippine mobile number (09XXXXXXXXX).', { title: 'Contact number required' });
            return;
        }
        setSubmitting(true);
        setFieldErrors({});
        try {
            const { student_label, ...payload } = form;
            if (payload.purpose !== 'parent_guardian') { payload.student_user_id = null; payload.relationship = null; }
            await axios.post('/visitors', payload, { silent: true });
            toast.success(`${form.full_name} checked in.`, { title: 'Checked in' });
            setForm(EMPTY_FORM);
            setFormKey((k) => k + 1);
            setBadgeRefresh((k) => k + 1);
            load();
        } catch (err) {
            if (err?.approvalHandled) return; // approval dialog is showing
            const errors = err?.response?.data?.errors;
            const message = errors
                ? Object.values(errors).flat().join('\n')
                : (err?.response?.data?.message || 'Could not check this visitor in.');
            setFieldErrors(errors ? Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])) : {});
            setBadgeRefresh((k) => k + 1);
            toast.error(message, { title: 'Could not check in' });
        } finally {
            setSubmitting(false);
        }
    };

    const updateAfterCheckOut = (updated) => {
        if (statusFilter === 'inside') {
            setVisitors((prev) => prev.filter((v) => v.id !== updated.id));
        } else {
            setVisitors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
        }
        setOutstanding((prev) => prev.filter((b) => b.id !== updated.id));
        setBadgeRefresh((k) => k + 1);
        setOnCampusCount((c) => Math.max(0, c - 1));
        setStats((st) => ({ ...st, checked_out_today: st.checked_out_today + 1 }));
    };

    const updateAfterEdit = (updated) => {
        setVisitors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    };

    const removeAfterDelete = (visitorId) => {
        setVisitors((prev) => {
            const removed = prev.find((v) => v.id === visitorId);
            if (removed?.status === 'checked_in') {
                setOnCampusCount((c) => Math.max(0, c - 1));
                setOutstanding((o) => o.filter((b) => b.id !== visitorId));
            }
            return prev.filter((v) => v.id !== visitorId);
        });
    };

    const rowProps = (visitor) => ({
        visitor,
        onCheckedOut: updateAfterCheckOut,
        onUpdated: updateAfterEdit,
        onDeleted: removeAfterDelete,
        isAdmin,
    });

    return (
        <DashboardShell onRefresh={() => load()} refreshing={loading}
            eyebrow="Security"
            title="Visitor Management"
            subtitle="Log visitors in and out at the counter, and see who's currently on campus."
            actions={
                <button type="button" className="ds-badge ds-badge-found" style={{ cursor: 'pointer', border: 0 }}
                    onClick={() => { setStatusFilter('inside'); setSearchInput(''); }}
                    title="Show visitors still inside (badge not returned)">
                    <Users size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {onCampusCount} on campus
                </button>
            }
        >
            <div className="ds-card">
                <h3>Check In a Visitor</h3>
                <form onSubmit={handleCheckIn}>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Full name</label>
                            <input name="full_name" value={form.full_name} onChange={handleChange} required maxLength={150}
                                aria-invalid={!!fieldErrors.full_name} />
                            {fieldErrors.full_name && <p className="ds-field-error">{fieldErrors.full_name}</p>}
                        </div>
                        <div className="ds-field">
                            <label>Purpose of visit</label>
                            <select name="purpose" value={form.purpose} onChange={handleChange} required>
                                {PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>ID presented</label>
                            <IdPresentedSelect
                                key={formKey}
                                name="id_presented"
                                value={form.id_presented}
                                onChange={(v) => {
                                    setForm((prev) => ({ ...prev, id_presented: v }));
                                    setFieldErrors((prev) => { const next = { ...prev }; delete next.id_presented; return next; });
                                }}
                            />
                            {fieldErrors.id_presented && <p className="ds-field-error">{fieldErrors.id_presented}</p>}
                        </div>
                        <div className="ds-field">
                            <label>ID number</label>
                            <input name="id_number" value={form.id_number} onChange={handleChange} maxLength={100} />
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Host / person visiting</label>
                            <input name="host_name" value={form.host_name} onChange={handleChange} maxLength={150} />
                        </div>
                        <div className="ds-field">
                            <label>Host's department</label>
                            <DepartmentSelect name="host_department" value={form.host_department} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="ds-form-row">
                        <div className="ds-field">
                            <label>Badge number * (physical badge handed to visitor)</label>
                            <BadgePicker
                                value={form.badge_number}
                                refreshKey={badgeRefresh}
                                error={fieldErrors.badge_number}
                                onChange={(label) => {
                                    setForm((prev) => ({ ...prev, badge_number: label }));
                                    setFieldErrors((prev) => { const next = { ...prev }; delete next.badge_number; return next; });
                                }}
                            />
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Contact number *</label>
                            <input name="contact_number" value={form.contact_number} inputMode="numeric" maxLength={11}
                                placeholder="09XXXXXXXXX" title={FORMAT_HINTS.phone} autoComplete="tel" required
                                aria-invalid={!!fieldErrors.contact_number}
                                onChange={(e) => {
                                    const v = filterPhoneInput(e.target.value);
                                    setForm((prev) => ({ ...prev, contact_number: v }));
                                    setFieldErrors((prev) => { const next = { ...prev }; delete next.contact_number; return next; });
                                }} />
                            {fieldErrors.contact_number && <p className="ds-field-error">{fieldErrors.contact_number}</p>}
                            {!fieldErrors.contact_number && <p className="ds-list-item-meta" style={{ marginTop: 4 }}>Philippine mobile number, e.g. 09171234567.</p>}
                        </div>
                    </div>
                    {form.purpose === 'parent_guardian' && (
                        <div className="ds-form-row ds-form-row-2">
                            <div className="ds-field">
                                <label>Child / student being visited *</label>
                                <StudentPicker
                                    valueId={form.student_user_id}
                                    valueLabel={form.student_label}
                                    error={fieldErrors.student_user_id}
                                    onSelect={(st) => {
                                        setForm((prev) => ({ ...prev, student_user_id: st.id, student_label: `${st.name}${st.student_id ? ` (${st.student_id})` : ''}` }));
                                        setFieldErrors((prev) => { const next = { ...prev }; delete next.student_user_id; return next; });
                                    }}
                                    onClear={() => setForm((prev) => ({ ...prev, student_user_id: '', student_label: '' }))}
                                />
                            </div>
                            <div className="ds-field">
                                <label>Relationship to student</label>
                                <select name="relationship" value={form.relationship} onChange={handleChange}>
                                    {RELATIONSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                    <div className="ds-form-row">
                        <div className="ds-field">
                            <label>Notes (optional)</label>
                            <input name="notes" value={form.notes} onChange={handleChange} maxLength={1000} />
                        </div>
                    </div>
                    <button type="submit" className="ds-btn ds-btn-primary" disabled={submitting}>
                        <UserCheck size={15} style={{ verticalAlign: -2, marginRight: 4 }} />
                        {submitting ? 'Checking in…' : 'Check In'}
                    </button>
                </form>
            </div>

            <div className="ds-card">
                <div className="ds-list-head-row">
                    <h3>
                        {statusFilter === 'inside' ? 'Currently On Campus — Badge Not Checked Out'
                            : statusFilter === 'checked_out' ? 'Checked Out' : 'Full Visitor Log'}
                    </h3>
                    <div className="ds-visitor-head-controls">
                        <ViewToggle mode={view} onChange={setView} />
                    </div>
                </div>

                <div className="ds-chip-row" style={{ marginTop: 0, marginBottom: 12 }}>
                    <span className="ds-chip">Checked in today: <strong>{stats.checked_in_today}</strong></span>
                    <span className="ds-chip">Checked out today: <strong>{stats.checked_out_today}</strong></span>
                    <span className="ds-chip ds-chip-accent">Badges still out: <strong>{outstanding.length}</strong></span>
                </div>

                {outstanding.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                        <p className="ds-list-item-meta" style={{ marginBottom: 6 }}>
                            <Tag size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                            Badges not yet returned (tap to find the visitor):
                        </p>
                        <div className="ds-chip-row" style={{ marginTop: 0 }}>
                            {outstanding.map((b) => (
                                <button key={b.id} type="button" className="ds-filter-chip"
                                    title={`${b.full_name} — in since ${new Date(b.checked_in_at).toLocaleTimeString()}`}
                                    onClick={() => { setStatusFilter('inside'); setSearchInput(b.badge_number); }}>
                                    #{b.badge_number} · {b.full_name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="ds-filter-row">
                    <div style={{ position: 'relative', flex: '1 1 260px' }}>
                        <input
                            type="search"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search badge number, visitor name, or student…"
                            aria-label="Search visitors"
                            style={{ width: '100%', paddingLeft: 34 }}
                        />
                        <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', opacity: 0.6, pointerEvents: 'none' }} />
                    </div>
                    {STATUS_FILTERS.map((f) => (
                        <button key={f.value} type="button"
                            className={`ds-filter-chip${statusFilter === f.value ? ' is-active' : ''}`}
                            onClick={() => setStatusFilter(f.value)}>
                            {f.label}
                        </button>
                    ))}
                </div>
                {loading && <div className="ds-skeleton" />}
                {!loading && visitors.length === 0 && (
                    <div className="ds-empty">
                        <UserX size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        {search ? `No visitors match "${search}".` : statusFilter === 'inside' ? 'Nobody is currently checked in — all badges are returned.' : 'No visitors logged yet.'}
                    </div>
                )}
                {!loading && visitors.length > 0 && view === 'cards' && (
                    <ul className="ds-list">
                        {visitors.map((v) => (
                            <VisitorRow key={v.id} {...rowProps(v)} view="cards" />
                        ))}
                    </ul>
                )}
                {!loading && visitors.length > 0 && view === 'table' && (
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Visitor</th>
                                    <th>Purpose</th>
                                    <th>Host</th>
                                    <th>Badge</th>
                                    <th>Checked in</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visitors.map((v) => (
                                    <VisitorRow key={v.id} {...rowProps(v)} view="table" />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
