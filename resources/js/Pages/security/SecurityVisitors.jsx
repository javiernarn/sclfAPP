import React, { useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import { UserCheck, UserX, Users, Clock, LogOut, Pencil, Check, X, Search, GraduationCap, AlertTriangle, Tag, Eye } from '../../Components/icons';
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
import PurposeDetailsFields, { usePurposeDefs, defFor, missingDetails, detailRows, allowedMinutes } from '../../Components/shared/PurposeDetailsFields';
import '../../Components/shared/PurposeDetailsFields.css';

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

const EMPTY_FORM = {
    first_name: '', last_name: '', id_presented: '', id_number: '', contact_number: '', purpose: 'meeting',
    host_name: '', host_department: '', badge_number: '', notes: '',
    student_user_id: '', student_label: '', relationship: 'parent',
    purpose_details: {},
};

const durationLabel = (from, to = Date.now()) => {
    const mins = Math.max(0, Math.floor((new Date(to) - new Date(from)) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
// Flagged once they have stayed longer than the time they declared (plus a short grace).
const isOverdue = (visitor) => visitor.status === 'checked_in'
    && (Date.now() - new Date(visitor.checked_in_at).getTime()) > allowedMinutes(visitor.purpose_details) * 60000;

// Badge picker: today's pool (M-01..M-200 on Monday, T-01..T-200 on Tuesday, ...).
//  - red  = still with a visitor (not checked out)
//  - grey = issued this round and already returned: locked until the whole
//           pool has been issued, then numbering starts again from the low end
//  - white = available
// Any badge can be clicked to LOOK at its card. Only an available one becomes the
// visitor's badge; a taken one just opens the card with a "taken" note (viewLabel).
function BadgePicker({ value, onChange, includeVisitorId, refreshKey = 0, error }) {
    const [pool, setPool] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const [prefix, setPrefix] = useState(''); // '' = server default (today's letter)
    const [viewLabel, setViewLabel] = useState(null); // a taken badge opened just for viewing

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
        const viewing = viewLabel === b.label;
        const base = {
            minWidth: 58, padding: '5px 6px', fontSize: 12, fontWeight: 700, borderRadius: 8,
            border: '1.5px solid #c3ccdb', background: 'transparent', color: 'inherit', cursor: 'pointer',
        };
        if (selected) { const dc = dayColorFor(b.label); return { ...base, background: dc, borderColor: dc, color: '#fff', transition: 'background 0.3s' }; }
        const ring = viewing ? { outline: `3px solid ${dayColorFor(b.label)}`, outlineOffset: 1 } : {};
        if (b.state === 'in_use') return { ...base, ...ring, background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)', color: '#dc2626' };
        if (b.state === 'returned') return { ...base, ...ring, opacity: viewing ? 0.85 : 0.4, textDecoration: 'line-through' };
        return base;
    };

    const titleFor = (b) => {
        if (b.state === 'in_use') return `${b.label} — taken: with ${b.holder} (not checked out). Click to view the card only.`;
        if (b.state === 'returned') return `${b.label} — returned, locked until next round. Click to view the card only.`;
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
                        setViewLabel(null);
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
                    <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={() => { setViewLabel(null); onChange(pool.next); }}>
                        Use next: {pool.next}
                    </button>
                )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 400, overflowY: 'auto', padding: 4, border: '1px solid #c3ccdb', borderRadius: 10, alignContent: 'flex-start' }}>
                    {pool.badges.map((b) => (
                        <button key={b.label} type="button" style={styleFor(b)} title={titleFor(b)}
                            aria-pressed={value === b.label || viewLabel === b.label}
                            onClick={() => {
                                // Available -> becomes this visitor's badge. Taken -> only opens its card.
                                if (b.state === 'available') { setViewLabel(null); onChange(b.label); } else { setViewLabel(b.label); }
                            }}>
                            {b.label}
                        </button>
                    ))}
                </div>
                {/* Full badge (front/back). Follows the selection: pick S-23 and it
                    becomes S-23 in Saturday's colour; before a pick it previews the
                    next badge of the chosen day set. */}
                {(() => {
                    const shown = viewLabel || value || pool.next || `${pool.prefix}-01`;
                    const shownBadge = pool.badges.find((b) => b.label === shown);
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <VisitorBadgeFlip
                                label={shown}
                                qrValue={shownBadge?.url || ''}
                                preview={!value && !viewLabel}
                                width={230}
                            />
                            {viewLabel && shownBadge && (
                                <div className="ds-chip-row" style={{ marginTop: 0, justifyContent: 'center', textAlign: 'center' }}>
                                    <span className="ds-chip" style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}>
                                        {shownBadge.state === 'in_use'
                                            ? `Taken — with ${shownBadge.holder}`
                                            : 'Taken — returned, locked until next round'}
                                    </span>
                                    <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={() => setViewLabel(null)}>
                                        Close preview
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
            <p className="ds-list-item-meta" style={{ marginTop: 6 }}>
                {value ? <>Selected badge: <strong>{value}</strong></> : 'Tap an available badge to select it.'}
                {viewLabel && <> · Viewing <strong>{viewLabel}</strong> only (taken — not selected for this visitor)</>}
                <br />
                Red = taken, not checked out · Faded = returned, locked until the pool is used up. You can tap a taken badge to view its card; it will not be assigned.
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
function VisitorRow({ visitor, onCheckedOut, onUpdated, canManage, view = 'cards' }) {
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [contactError, setContactError] = useState('');
    const purposeDefs = usePurposeDefs();
    const [editErrors, setEditErrors] = useState({});
    const visitDef = defFor(purposeDefs, visitor.purpose);
    // Badge QR activity: did the visitor open their welcome page, and did someone report the badge as found?
    const scanChips = visitor.status === 'checked_in' && (visitor.welcomed_at || visitor.badge_found_reported_at) ? (
        <p className="ds-visit-detail">
            {visitor.welcomed_at && <span className="ds-live-chip" title={`Opened ${new Date(visitor.welcomed_at).toLocaleString()}`}>Opened welcome page</span>}
            {visitor.badge_found_reported_at && (
                <span className="ds-live-chip is-overdue" style={{ marginLeft: 6 }} title={`Reported ${new Date(visitor.badge_found_reported_at).toLocaleString()}`}>
                    <AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Badge reported as not theirs / found
                </span>
            )}
        </p>
    ) : null;
    const visitSummary = detailRows(visitDef, visitor.purpose_details).filter((r) => r.value !== 'Yes').slice(0, 3).map((r) => r.value).join(' · ');
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
        ? <VisitorDetailsModal visitor={visitor} purposeDef={visitDef} shellClass={viewing} onClose={() => setViewing(null)} />
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
            first_name: visitor.first_name || visitor.full_name?.split(/\s+/).slice(0, -1).join(' ') || visitor.full_name || '',
            last_name: visitor.last_name || (visitor.full_name?.includes(' ') ? visitor.full_name.split(/\s+/).slice(-1)[0] : ''),
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
            purpose_details: visitor.purpose_details || {},
            notes: visitor.notes || '',
        });
        setEditErrors({});
        setEditing(true);
    };

    const save = async () => {
        const phone = String(form.contact_number || '').trim();
        if (!phone) { setContactError('Contact number is required.'); return; }
        if (!isValidPhone(phone)) { setContactError(FORMAT_ERRORS.phone); return; }
        setContactError('');
        const missing = missingDetails(defFor(purposeDefs, form.purpose), form.purpose_details, form.host_name);
        if (Object.keys(missing).length) {
            setEditErrors(missing);
            toast.error('Complete the visit details for this purpose.', { title: 'Details required' });
            return;
        }
        setEditErrors({});
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
            if (errors) setEditErrors(Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])));
            const message = errors ? Object.values(errors).flat().join('\n') : (err?.response?.data?.message || 'Could not update this entry.');
            toast.error(message, { title: 'Could not save' });
        } finally {
            setSaving(false);
        }
    };

    const editForm = !editing || !form ? null : (
        <>
                <div className="ds-form-row ds-form-row-2">
                    <div className="ds-field">
                        <label>First name *</label>
                        <input value={form.first_name} maxLength={100} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                        {editErrors.first_name && <p className="ds-field-error">{editErrors.first_name}</p>}
                        <label style={{ marginTop: 8 }}>Last name *</label>
                        <input value={form.last_name} maxLength={100} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                        {editErrors.last_name && <p className="ds-field-error">{editErrors.last_name}</p>}
                    </div>
                    <div className="ds-field">
                        <label>Purpose</label>
                        <select value={form.purpose} onChange={(e) => { setEditErrors({}); setForm({ ...form, purpose: e.target.value, purpose_details: e.target.value === visitor.purpose ? (visitor.purpose_details || {}) : {} }); }}>
                            {PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="ds-form-row ds-form-row-2">
                    <div className="ds-field">
                        <label>ID presented *</label>
                        <IdPresentedSelect value={form.id_presented} onChange={(v) => setForm({ ...form, id_presented: v })} />
                    </div>
                    <div className="ds-field">
                        <label>ID number *</label>
                        <input value={form.id_number} maxLength={100} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
                    </div>
                </div>
                <div className="ds-form-row ds-form-row-2">
                    <div className="ds-field">
                        <label>{(visitDef && form.purpose === visitor.purpose ? visitDef.host_label : (defFor(purposeDefs, form.purpose)?.host_label || 'Host')) + (defFor(purposeDefs, form.purpose)?.requires_host ? ' *' : '')}</label>
                        <input value={form.host_name} maxLength={150} onChange={(e) => setForm({ ...form, host_name: e.target.value })} />
                        {editErrors.host_name && <p className="ds-field-error">{editErrors.host_name}</p>}
                    </div>
                    <div className="ds-field">
                        <label>Host's department</label>
                        <DepartmentSelect value={form.host_department} onChange={(e) => setForm({ ...form, host_department: e.target.value })} />
                    </div>
                </div>
                <PurposeDetailsFields def={defFor(purposeDefs, form.purpose)} values={form.purpose_details || {}} errors={editErrors}
                    onChange={(details) => setForm({ ...form, purpose_details: details })} />
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
            {canManage && visitor.status === 'checked_in' && (
                <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" disabled={busy} onClick={checkOut}>
                    <LogOut size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Check Out
                </button>
            )}
            {canManage && (
                <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={startEditing} title="Edit entry" aria-label="Edit entry">
                    <Pencil size={13} />
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
                <td style={{ textTransform: 'capitalize' }}>
                    <div className="ds-table-nowrap">{purposeLabel(visitor.purpose)}</div>
                    {visitSummary && <div className="ds-table-sub" style={{ textTransform: 'none' }} title={visitSummary}>{visitSummary}</div>}
                </td>
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
                                {scanChips}
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

    const fmt = (d) => new Date(d).toLocaleString();
    const hostLine = visitor.host_name
        ? `${visitor.host_name}${visitor.host_department ? ` (${visitor.host_department})` : ''}`
        : null;
    const studentLine = visitor.student_name
        ? `${visitor.relationship ? `${visitor.relationship} of ` : ''}${visitor.student_name}${visitor.student_number ? ` (${visitor.student_number})` : ''}`
        : null;
    const infoRows = [
        { label: 'Purpose', value: visitor.purpose ? purposeLabel(visitor.purpose) : null },
        { label: 'Visiting', value: hostLine },
        { label: 'Student', value: studentLine },
        { label: 'Contact', value: visitor.contact_number },
        { label: 'Details', value: visitSummary },
    ].filter((r) => r.value);

    return (
        <li className="ds-list-item ds-visitor-card">
            <div className="ds-visitor-card-head">
                <div className="ds-visitor-card-title">
                    <p className="ds-list-item-title">{visitor.full_name}</p>
                    {visitor.badge_number && (
                        <span className="ds-badge ds-badge-icon ds-visitor-badge-no" title="Visitor badge">
                            <Tag size={12} /> Badge #{visitor.badge_number}
                        </span>
                    )}
                </div>
                {visitor.status === 'checked_in' ? (
                    <span className={`ds-badge ds-badge-icon ${isOverdue(visitor) ? 'ds-badge-rejected' : 'ds-badge-found'}`}>
                        {isOverdue(visitor) && <AlertTriangle size={12} />}
                        {durationLabel(visitor.checked_in_at)} inside
                    </span>
                ) : (
                    <span className="ds-badge ds-badge-default">Checked out</span>
                )}
            </div>

            {infoRows.length > 0 && (
                <dl className="ds-visitor-info">
                    {infoRows.map((r) => (
                        <div key={r.label} className="ds-visitor-info-row">
                            <dt>{r.label}</dt>
                            <dd>{r.value}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {scanChips}

            <div className="ds-visitor-times">
                <div className="ds-visitor-time">
                    <Clock size={13} />
                    <span className="ds-visitor-time-label">Checked in</span>
                    <span className="ds-visitor-time-value">{fmt(visitor.checked_in_at)}</span>
                    <span className="ds-visitor-time-by">by {roleAndName(visitor.checked_in_by)}</span>
                </div>
                {visitor.status === 'checked_out' && visitor.checked_out_at && (
                    <div className="ds-visitor-time">
                        <LogOut size={13} />
                        <span className="ds-visitor-time-label">Checked out</span>
                        <span className="ds-visitor-time-value">{fmt(visitor.checked_out_at)}</span>
                    </div>
                )}
                {visitor.status === 'checked_in' && (
                    <div className="ds-visitor-time" style={{ color: isOverdue(visitor) ? '#ef4444' : undefined }}>
                        {isOverdue(visitor) ? <AlertTriangle size={13} /> : <Tag size={13} />}
                        <span className="ds-visitor-time-label">Badge</span>
                        <span className="ds-visitor-time-value">not returned{isOverdue(visitor) ? ' — past expected stay' : ''}</span>
                    </div>
                )}
            </div>

            <div className="ds-visitor-actions">
                <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={openView} title="View all details">
                    <Eye size={13} /> View
                </button>
                {detailsModal}
                {canManage && visitor.status === 'checked_in' && (
                    <button type="button" className="ds-btn ds-btn-primary ds-btn-sm" disabled={busy} onClick={checkOut}>
                        <LogOut size={13} /> Check Out
                    </button>
                )}
                <span className="ds-visitor-actions-spacer" />
                {canManage && (
                    <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={startEditing} title="Edit entry">
                        <Pencil size={13} /> Edit
                    </button>
                )}
            </div>
        </li>
    );
}

export default function SecurityVisitors() {
    const { roles } = useAuth();
    // Only the Security Officer runs the visitor desk (check in / edit / check out). Admin and Staff
    // get a read-only view of the full history - the server enforces the same rule (VisitorController).
    const canManage = Array.isArray(roles) && roles.includes('security_officer');
    const [form, setForm] = useState(EMPTY_FORM);
    const [badgeRefresh, setBadgeRefresh] = useState(0); // bumped after check-in/out so the badge grid reloads
    const [formKey, setFormKey] = useState(0); // bumped on reset so the ID picker drops its "Other" state
    const [visitors, setVisitors] = useState([]);
    const [onCampusCount, setOnCampusCount] = useState(0);
    const [statusFilter, setStatusFilter] = useState(canManage ? 'inside' : 'all'); // viewers start on the full history
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [outstanding, setOutstanding] = useState([]);
    const [stats, setStats] = useState({ checked_in_today: 0, checked_out_today: 0 });
    const [view, setView] = useViewMode('visitors');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const toast = useToast();
    const purposeDefs = usePurposeDefs();
    const [live, setLive] = useState({ by_purpose: {}, overdue: 0 });
    const [updatedAt, setUpdatedAt] = useState(null);

    useEffect(() => {
        document.title = "Visitor Management | SCLF - Opol Community College";
    }, []);

    // silent = background refresh (no spinner, no error popup)
    const load = (silent = false) => {
        if (!silent) setLoading(true);
        axios.get('/visitors', { params: { status: statusFilter, ...(search ? { search } : {}) } })
            .then((res) => {
                setVisitors(res.data.data?.data || []);
                setOnCampusCount(res.data.currently_on_campus || 0);
                setOutstanding(res.data.outstanding_badges || []);
                setStats(res.data.stats || { checked_in_today: 0, checked_out_today: 0 });
                setLive(res.data.live || { by_purpose: {}, overdue: 0 });
                setUpdatedAt(new Date());
            })
            .catch((err) => {
                if (silent === true) return;
                toast.error(err?.response?.data?.message || 'Could not load visitors.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [statusFilter, search]);

    // Real-time view: quietly refresh every 10 s while this tab is visible, and
    // straight away when the officer comes back to it.
    useEffect(() => {
        const tick = () => { if (document.visibilityState === 'visible') load(true); };
        const id = setInterval(tick, 10000);
        document.addEventListener('visibilitychange', tick);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
    }, [statusFilter, search]);

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
        // Every visitor must show an ID; the number is recorded with the entry.
        if (!String(form.id_presented || '').trim() || !String(form.id_number || '').trim()) {
            setFieldErrors({
                ...(!String(form.id_presented || '').trim() ? { id_presented: 'Select the ID the visitor presented.' } : {}),
                ...(!String(form.id_number || '').trim() ? { id_number: 'Enter the number on the visitor\'s ID.' } : {}),
            });
            toast.error('Check the visitor\'s ID and record it before they go inside.', { title: 'ID required' });
            return;
        }
        // Each purpose has required details; without them the visitor is not admitted.
        const missing = missingDetails(defFor(purposeDefs, form.purpose), form.purpose_details, form.host_name);
        if (Object.keys(missing).length) {
            setFieldErrors(missing);
            toast.error('Complete the visit details before this visitor can go inside.', { title: 'Details required' });
            return;
        }
        setSubmitting(true);
        setFieldErrors({});
        try {
            const { student_label, ...payload } = form;
            if (payload.purpose !== 'parent_guardian') { payload.student_user_id = null; payload.relationship = null; }
            await axios.post('/visitors', payload, { silent: true });
            toast.success(`${form.first_name} ${form.last_name} checked in.`, { title: 'Checked in' });
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

    const rowProps = (visitor) => ({
        visitor,
        onCheckedOut: updateAfterCheckOut,
        onUpdated: updateAfterEdit,
        canManage,
    });

    return (
        <DashboardShell onRefresh={() => load()} refreshing={loading}
            eyebrow="Security"
            title="Visitor Management"
            subtitle={canManage ? "Log visitors in and out at the counter, and see who's currently on campus." : "The full visitor history — view only. Visitors are logged in and out by the Security Officer."}
            actions={
                <button type="button" className="ds-badge ds-badge-found" style={{ cursor: 'pointer', border: 0 }}
                    onClick={() => { setStatusFilter('inside'); setSearchInput(''); }}
                    title="Show visitors still inside (badge not returned)">
                    <Users size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {onCampusCount} on campus
                </button>
            }
        >
            {!canManage && (
                <div className="ds-card" role="note">
                    <h3><Eye size={16} style={{ verticalAlign: -3, marginRight: 6 }} />View only</h3>
                    <p style={{ margin: 0, opacity: 0.8 }}>
                        Only a Security Officer can check visitors in or out and change their entries. You can search the full
                        history below and open any visitor to see all of their details.
                    </p>
                </div>
            )}

            {canManage && (
            <div className="ds-card">
                <h3>Check In a Visitor</h3>
                <form onSubmit={handleCheckIn}>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>First name *</label>
                            <input name="first_name" value={form.first_name} onChange={handleChange} required maxLength={100}
                                autoComplete="given-name" aria-invalid={!!fieldErrors.first_name} />
                            {fieldErrors.first_name && <p className="ds-field-error">{fieldErrors.first_name}</p>}
                            <label style={{ marginTop: 8 }}>Last name *</label>
                            <input name="last_name" value={form.last_name} onChange={handleChange} required maxLength={100}
                                autoComplete="family-name" aria-invalid={!!fieldErrors.last_name} />
                            {fieldErrors.last_name && <p className="ds-field-error">{fieldErrors.last_name}</p>}
                        </div>
                        <div className="ds-field">
                            <label>Purpose of visit</label>
                            <select name="purpose" value={form.purpose} required
                                onChange={(e) => {
                                    const purpose = e.target.value;
                                    setForm((prev) => ({ ...prev, purpose, purpose_details: {} }));
                                    setFieldErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('purpose_details.') && k !== 'host_name')));
                                }}>
                                {PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>ID presented *</label>
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
                            <label>ID number *</label>
                            <input name="id_number" value={form.id_number} onChange={handleChange} maxLength={100}
                                aria-invalid={!!fieldErrors.id_number} />
                            {fieldErrors.id_number && <p className="ds-field-error">{fieldErrors.id_number}</p>}
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>{(defFor(purposeDefs, form.purpose)?.host_label || 'Host / person visiting') + (defFor(purposeDefs, form.purpose)?.requires_host ? ' *' : '')}</label>
                            <input name="host_name" value={form.host_name} onChange={handleChange} maxLength={150}
                                aria-invalid={!!fieldErrors.host_name} />
                            {fieldErrors.host_name && <p className="ds-field-error">{fieldErrors.host_name}</p>}
                        </div>
                        <div className="ds-field">
                            <label>Host's department</label>
                            <DepartmentSelect name="host_department" value={form.host_department} onChange={handleChange} />
                        </div>
                    </div>
                    <PurposeDetailsFields
                        def={defFor(purposeDefs, form.purpose)}
                        values={form.purpose_details}
                        errors={fieldErrors}
                        onChange={(details) => {
                            setForm((prev) => ({ ...prev, purpose_details: details }));
                            setFieldErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('purpose_details.'))));
                        }}
                    />
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
            )}

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

                <div className="ds-live-board" aria-live="polite">
                    <span className="ds-live-dot">Live{updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ''}</span>
                    {Object.entries(live.by_purpose || {}).map(([purpose, n]) => (
                        <span key={purpose} className="ds-live-chip">{purposeLabel(purpose)}: <strong>{n}</strong></span>
                    ))}
                    {live.overdue > 0 && (
                        <span className="ds-live-chip is-overdue"><AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{live.overdue} past their expected stay</span>
                    )}
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
