import React, { useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';
import { Search, UserCircle, PackageCheck, Info, RotateCcw, ArrowRight } from '../../Components/icons';

// The counter check-in flow, in three steps: find the owner, describe the
// item + pick where it's being held, submit. Kept as one page (not a
// wizard) since a guard doing this ten times a shift benefits more from
// everything being visible at once than from extra clicks between steps.
export default function SecurityCounter() {
    const toast = useToast();
    const navigate = useNavigate();

    // --- Step 1: find the owner -------------------------------------
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [owner, setOwner] = useState(null);
    const searchTimer = useRef(null);

    // --- Step 2: counters list + "add a counter" mini-form -----------
    const [counters, setCounters] = useState([]);
    const [campuses, setCampuses] = useState([]);
    const [loadingCounters, setLoadingCounters] = useState(true);
    const [newCounter, setNewCounter] = useState({ campus_id: '', label: '', code: '' });
    const [addingCounter, setAddingCounter] = useState(false);

    // --- Step 3: item details + submit --------------------------------
    const [form, setForm] = useState({ item_name: '', description: '', category: '', storage_location_id: '' });
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [result, setResult] = useState(null); // the freshly checked-in item/claim

    useEffect(() => {
        document.title = 'Counter | SCLF - Opol Community College';
    }, []);

    const loadCounters = () => {
        setLoadingCounters(true);
        Promise.all([
            axios.get('/storage-locations', { params: { type: 'counter' } }),
            axios.get('/campuses'),
        ])
            .then(([locRes, campRes]) => {
                setCounters(locRes.data);
                setCampuses(campRes.data);
                if (campRes.data[0]) setNewCounter((f) => ({ ...f, campus_id: f.campus_id || campRes.data[0].id }));
            })
            .finally(() => setLoadingCounters(false));
    };
    useEffect(loadCounters, []);

    // Debounced owner search — fires ~300ms after typing stops, and only
    // once there's enough to actually narrow things down.
    useEffect(() => {
        clearTimeout(searchTimer.current);
        if (query.trim().length < 2) { setResults([]); return; }
        searchTimer.current = setTimeout(() => {
            setSearching(true);
            axios.get('/counter/owners', { params: { q: query.trim() } })
                .then((res) => setResults(res.data.data))
                .finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(searchTimer.current);
    }, [query]);

    const pickOwner = (u) => {
        setOwner(u);
        setResults([]);
        setQuery('');
    };

    const addCounter = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/storage-locations', { ...newCounter, type: 'counter' });
            toast.success('Counter added.', { title: 'Counter created' });
            setNewCounter((f) => ({ ...f, label: '', code: '' }));
            loadCounters();
        } catch (err) {
            const errors = err?.response?.data?.errors;
            toast.error(errors ? Object.values(errors).flat().join('\n') : 'Could not add counter.', { title: 'Could not add counter' });
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!owner) { toast.error('Search for and select the owner first.', { title: 'No owner selected' }); return; }
        setSubmitting(true);
        setFieldErrors({});
        try {
            const res = await axios.post('/counter/check-in', { ...form, owner_id: owner.id });
            setResult(res.data.data);
            toast.success(res.data.message, { title: 'Item checked in' });
        } catch (err) {
            const errors = err?.response?.data?.errors;
            const message = errors ? Object.values(errors).flat().join('\n') : (err?.response?.data?.message || 'Could not check in this item.');
            setFieldErrors(errors ? Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])) : {});
            toast.error(message, { title: 'Could not check in' });
        } finally {
            setSubmitting(false);
        }
    };

    const resetForCounterNext = () => {
        setOwner(null);
        setForm({ item_name: '', description: '', category: '', storage_location_id: form.storage_location_id });
        setResult(null);
    };

    return (
        <DashboardShell
            eyebrow="Security"
            title="Counter"
            subtitle="Log an item handed to you directly by its owner. Their claim is auto-approved; the release pass is generated later, when they come to pick it up."
        >
            <div className="ds-card" style={{ borderLeft: '3px solid var(--accent, #1B1F3B)' }}>
                <div className="ds-card-title">
                    <span className="ds-card-title-icon"><Info size={17} /> What this is for</span>
                </div>
                <p className="ds-card-desc" style={{ marginBottom: 0 }}>
                    Use the <strong>Counter</strong> when someone hands you an item in person and you already
                    know whose it is — like a bag-check desk. It's different from <strong>Inventory</strong>,
                    which is for items a stranger found and turned in, where the owner isn't known yet. Once
                    you submit here, the item is logged and the owner is notified immediately — their claim
                    is auto-approved since you identified them in person. The pickup pass itself isn't
                    generated yet: when they come back to collect it, open the claim from{' '}
                    <strong>Claims</strong> and generate the release code there, the same as any other item.
                </p>
            </div>

            {result ? (
                <div className="ds-card">
                    <div className="ds-card-title">
                        <span className="ds-card-title-icon"><PackageCheck size={17} /> Checked in</span>
                    </div>
                    <p className="ds-card-desc">
                        {form.item_name} is logged for {owner?.name}. They've already been notified — no pass
                        has been generated yet. When they come back to pick it up, open their claim and
                        generate the release code from there.
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="ds-btn ds-btn-primary" onClick={() => navigate(`/app/claims/${result.claim.id}`)}>
                            Open this claim <ArrowRight size={16} />
                        </button>
                        <button className="ds-btn ds-btn-secondary" onClick={resetForCounterNext}>
                            <RotateCcw size={16} /> Check in another item
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="ds-card">
                        <h3>1. Find the owner</h3>
                        <p className="ds-card-desc">Search by school ID or name.</p>
                        {!owner ? (
                            <>
                                <div className="ds-field">
                                    <div style={{ position: 'relative' }}>
                                        <Search size={15} style={{ position: 'absolute', left: 10, top: 11, opacity: 0.5 }} />
                                        <input
                                            style={{ paddingLeft: 32 }}
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="e.g. 2021-2-04062 or Juan Dela Cruz"
                                        />
                                    </div>
                                </div>
                                {searching && <div className="ds-skeleton" />}
                                {!searching && results.length > 0 && (
                                    <ul className="ds-list">
                                        {results.map((u) => (
                                            <li key={u.id} className="ds-list-item" style={{ cursor: 'pointer' }} onClick={() => pickOwner(u)}>
                                                <div className="ds-list-item-main">
                                                    <UserCircle size={22} style={{ opacity: 0.6, marginRight: 8 }} />
                                                    <div>
                                                        <p className="ds-list-item-title">{u.name}</p>
                                                        <p className="ds-list-item-meta">{u.student_id || 'No ID on file'}{u.course ? ` · ${u.course}` : ''}</p>
                                                    </div>
                                                </div>
                                                <button type="button" className="ds-btn ds-btn-primary">Select</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {!searching && query.trim().length >= 2 && results.length === 0 && (
                                    <div className="ds-empty">No matching student or instructor found.</div>
                                )}
                            </>
                        ) : (
                            <div className="ds-list-item">
                                <div className="ds-list-item-main">
                                    <UserCircle size={22} style={{ opacity: 0.6, marginRight: 8 }} />
                                    <div>
                                        <p className="ds-list-item-title">{owner.name}</p>
                                        <p className="ds-list-item-meta">{owner.student_id || 'No ID on file'}{owner.course ? ` · ${owner.course}` : ''}</p>
                                    </div>
                                </div>
                                <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setOwner(null)}>Change</button>
                            </div>
                        )}
                    </div>

                    <div className="ds-card">
                        <form onSubmit={submit}>
                            <h3>2. Item details</h3>
                            <div className="ds-field">
                                <label>Item name <span className="ds-required">*</span></label>
                                <input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                                    placeholder="e.g. Blue motorcycle helmet" aria-invalid={!!fieldErrors.item_name} required />
                                <p className="ds-field-hint">What the owner handed over.</p>
                                {fieldErrors.item_name && <div className="ds-field-error">{fieldErrors.item_name}</div>}
                            </div>
                            <div className="ds-form-row ds-form-row-2">
                                <div className="ds-field">
                                    <label>Category</label>
                                    <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Helmet, Bag, Gadget" />
                                    <p className="ds-field-hint">Optional — helps with search later.</p>
                                </div>
                                <div className="ds-field">
                                    <label>Counter <span className="ds-required">*</span></label>
                                    <select value={form.storage_location_id} onChange={(e) => setForm({ ...form, storage_location_id: e.target.value })}
                                        aria-invalid={!!fieldErrors.storage_location_id} required>
                                        <option value="">Choose where it's held…</option>
                                        {counters.map((c) => <option key={c.id} value={c.id}>{c.label || c.code}</option>)}
                                    </select>
                                    <p className="ds-field-hint">Which counter/desk it's physically sitting at right now.</p>
                                    {fieldErrors.storage_location_id && <div className="ds-field-error">{fieldErrors.storage_location_id}</div>}
                                </div>
                            </div>
                            <div className="ds-field">
                                <label>Notes</label>
                                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Optional — condition, distinguishing details, anything worth noting." />
                            </div>
                            <button className="ds-btn ds-btn-primary" disabled={submitting || !owner}>
                                {submitting ? 'Checking in…' : 'Check In'}
                            </button>
                            {!owner && <p className="ds-field-hint" style={{ marginTop: 8 }}>Select an owner above first.</p>}
                        </form>
                    </div>
                </>
            )}

            <div className="ds-card">
                <h4 style={{ marginTop: 0 }}>Counters at this campus</h4>
                {loadingCounters && <div className="ds-skeleton" />}
                {!loadingCounters && counters.length === 0 && <div className="ds-empty">No counters set up yet — add one below.</div>}
                {!loadingCounters && counters.length > 0 && (
                    <div className="ds-location-grid">
                        {counters.map((c) => (
                            <div key={c.id} className="ds-location-card">
                                <p className="ds-list-item-title">{c.label || c.code}</p>
                                <p className="ds-list-item-meta">{c.campus?.name}</p>
                            </div>
                        ))}
                    </div>
                )}
                <hr className="ds-divider" />
                <form onSubmit={addCounter}>
                    <h4>Add a Counter</h4>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Campus <span className="ds-required">*</span></label>
                            <select value={newCounter.campus_id} onChange={(e) => setNewCounter({ ...newCounter, campus_id: e.target.value })} required>
                                {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="ds-field">
                            <label>Label <span className="ds-required">*</span></label>
                            <input value={newCounter.label} onChange={(e) => setNewCounter({ ...newCounter, label: e.target.value })}
                                placeholder="e.g. Front Desk Counter 1" required />
                            <p className="ds-field-hint">What you'll see in the dropdown above.</p>
                        </div>
                    </div>
                    <div className="ds-field">
                        <label>Code (unique) <span className="ds-required">*</span></label>
                        <input value={newCounter.code} onChange={(e) => setNewCounter({ ...newCounter, code: e.target.value })}
                            placeholder="e.g. CTR-1" required />
                        <p className="ds-field-hint">A short internal ID — nothing else on this campus can use the same code.</p>
                    </div>
                    <button className="ds-btn ds-btn-secondary">Add Counter</button>
                </form>
            </div>
        </DashboardShell>
    );
}
