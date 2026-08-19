import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';
import { UserCircle, PackageCheck, PackageOpen, QrCode, CheckCircle2, Archive, AlertTriangle } from '../../Components/icons';

// Per-location status breakdown, so a guard glancing at this list — not
// just the one who shelved it — can tell at a glance whether what's listed
// at a spot is still sitting there, about to walk out the door, or already
// gone. `found_items_count` alone can't answer that: storage_location_id is
// kept on a found item's record even after it's released, so a location
// that looks "full" from the raw count may really be empty on the shelf.
function LocationStatusChips({ location }) {
    const onShelf = location.on_shelf_count || 0;
    const claimed = location.claimed_count || 0;
    const pendingRelease = location.pending_release_count || 0;
    const unclaimed = location.unclaimed_count || 0;
    const released = location.released_count || 0;
    const stillHere = onShelf + claimed + pendingRelease + unclaimed;

    if (!stillHere && !released) {
        return <span className="ds-badge ds-badge-default">Empty — no items assigned yet</span>;
    }

    return (
        <div className="ds-chip-row" style={{ marginTop: 6 }}>
            {onShelf > 0 && (
                <span className="ds-badge ds-badge-found ds-badge-icon">
                    <PackageOpen size={12} /> {onShelf} on shelf, not yet claimed
                </span>
            )}
            {claimed > 0 && (
                <span className="ds-badge ds-badge-claimed ds-badge-icon">
                    <CheckCircle2 size={12} /> {claimed} claimed, awaiting release code
                </span>
            )}
            {pendingRelease > 0 && (
                <span className="ds-badge ds-badge-pending ds-badge-icon">
                    <QrCode size={12} /> {pendingRelease} release pending — expect pickup soon
                </span>
            )}
            {unclaimed > 0 && (
                <span className="ds-badge ds-badge-rejected ds-badge-icon">
                    <AlertTriangle size={12} /> {unclaimed} unclaimed — retention expired
                </span>
            )}
            {released > 0 && (
                <span className="ds-badge ds-badge-default ds-badge-icon">
                    <PackageCheck size={12} /> {released} already released (history only)
                </span>
            )}
        </div>
    );
}

// Capacity is opt-in per location (see the Phase 3 migration) — shows
// nothing for locations nobody's bothered to measure, and a plain X/Y
// count that turns to a warning badge once genuinely full.
function CapacityBadge({ location }) {
    if (location.capacity === null || location.capacity === undefined) {
        return null;
    }
    const occupied = (location.on_shelf_count || 0) + (location.claimed_count || 0)
        + (location.pending_release_count || 0) + (location.unclaimed_count || 0);

    return (
        <span className={`ds-badge ${location.is_at_capacity ? 'ds-badge-rejected' : 'ds-badge-default'} ds-badge-icon`}>
            <Archive size={12} /> {occupied}/{location.capacity} slots {location.is_at_capacity ? '— full' : 'used'}
        </span>
    );
}

// Inline "set capacity" control on each storage card — capacity is set
// after the fact (see the PATCH /storage-locations/{id}/capacity route),
// not required at creation, since an officer measuring actual shelf slots
// usually happens later than initial setup.
function CapacityEditor({ location, onSaved }) {
    const [value, setValue] = useState(location.capacity ?? '');
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    const save = async () => {
        setSaving(true);
        try {
            await axios.patch(`/storage-locations/${location.id}/capacity`, {
                capacity: value === '' ? null : Number(value),
            });
            toast.success('Capacity updated.', { title: 'Saved' });
            onSaved();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not update capacity.', { title: 'Could not save' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="ds-list-item-side" style={{ marginTop: 8 }}>
            <input
                type="number"
                min="1"
                placeholder="No limit"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                style={{ width: 90 }}
            />
            <button className="ds-btn ds-btn-secondary" disabled={saving} onClick={save}>
                Set capacity
            </button>
        </div>
    );
}

export default function SecurityInventory() {
    const [storageLocations, setStorageLocations] = useState([]);
    const [counterLocations, setCounterLocations] = useState([]);
    const [unstored, setUnstored] = useState([]);
    const [stored, setStored] = useState([]); // already-shelved items, movable to a new location
    const [loading, setLoading] = useState(true);
    const [assign, setAssign] = useState({}); // itemId -> locationId
    const [move, setMove] = useState({}); // itemId -> new locationId
    const [busyId, setBusyId] = useState(null);
    const [historyForId, setHistoryForId] = useState(null);
    const [historyEntries, setHistoryEntries] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [newLoc, setNewLoc] = useState({ campus_id: '', type: 'storage', label: '', room: '', cabinet: '', shelf: '', box: '', code: '', capacity: '' });
    const [campuses, setCampuses] = useState([]);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const toast = useToast();

    useEffect(() => {
        document.title = "Inventory | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        Promise.all([
            axios.get('/storage-locations', { params: { type: 'storage' } }),
            axios.get('/storage-locations', { params: { type: 'counter' } }),
            axios.get('/found-items', { params: { status: 'accepted' } }),
            // Already shelved, still on the shelf — eligible to be moved to
            // a different location (e.g. consolidating or re-organizing).
            axios.get('/found-items', { params: { status: 'stored' } }),
            axios.get('/campuses'),
        ])
            .then(([storeRes, counterRes, itemRes, storedRes, campRes]) => {
                setStorageLocations(storeRes.data);
                setCounterLocations(counterRes.data);
                setUnstored(itemRes.data.data);
                setStored(storedRes.data.data);
                setCampuses(campRes.data);
                if (campRes.data[0]) setNewLoc(f => ({ ...f, campus_id: f.campus_id || campRes.data[0].id }));
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const assignStorage = async (itemId) => {
        const storage_location_id = assign[itemId];
        if (!storage_location_id) return;
        setBusyId(itemId);
        try {
            await axios.post(`/found-items/${itemId}/assign-storage`, { storage_location_id });
            toast.success('Item shelved and marked stored.', { title: 'Stored' });
            load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not store this item.', { title: 'Could not store' });
        } finally {
            setBusyId(null);
        }
    };

    const moveStorage = async (itemId) => {
        const storage_location_id = move[itemId];
        if (!storage_location_id) return;
        setBusyId(itemId);
        try {
            await axios.post(`/found-items/${itemId}/move-storage`, { storage_location_id });
            toast.success('Item moved to the new location.', { title: 'Moved' });
            load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not move this item.', { title: 'Could not move' });
        } finally {
            setBusyId(null);
        }
    };

    const toggleHistory = async (itemId) => {
        if (historyForId === itemId) {
            setHistoryForId(null);
            return;
        }
        setHistoryForId(itemId);
        setHistoryLoading(true);
        try {
            const res = await axios.get(`/found-items/${itemId}/movements`);
            setHistoryEntries(res.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not load movement history.', { title: 'Could not load history' });
            setHistoryEntries([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const createLocation = async (e) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});
        try {
            await axios.post('/storage-locations', { ...newLoc, capacity: newLoc.capacity === '' ? null : Number(newLoc.capacity) });
            setNewLoc({ ...newLoc, label: '', room: '', cabinet: '', shelf: '', box: '', code: '', capacity: '' });
            toast.success('Storage location added.', { title: 'Location created' });
            load();
        } catch (err) {
            const errors = err?.response?.data?.errors;
            const message = errors
                ? Object.values(errors).flat().join('\n')
                : (err?.response?.data?.message || 'Could not create storage location.');
            setError(message);
            // Same red-outline-on-invalid treatment as the rest of the app —
            // mirrors the backend's `campus_id`/`code` required rules.
            setFieldErrors(
                errors ? Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])) : {}
            );
            toast.error(message, { title: 'Could not create location' });
        }
    };

    return (
        <DashboardShell eyebrow="Security" title="Inventory" subtitle="Storage locations and items awaiting shelving.">
            <div className="ds-card">
                <h3>Items Awaiting Storage</h3>
                {loading && <div className="ds-skeleton" />}
                {!loading && unstored.length === 0 && <div className="ds-empty">Nothing waiting to be shelved.</div>}
                {!loading && unstored.length > 0 && (
                    <ul className="ds-list">
                        {unstored.map(item => (
                            <li key={item.id} className="ds-list-item">
                                <div className="ds-list-item-main">
                                    <div style={{ minWidth: 0 }}>
                                        <p className="ds-list-item-title">{item.item_name}</p>
                                        <p className="ds-list-item-meta">{item.category}</p>
                                    </div>
                                </div>
                                <div className="ds-list-item-side">
                                    <select
                                        value={assign[item.id] || ''}
                                        onChange={(e) => setAssign({ ...assign, [item.id]: e.target.value })}
                                        style={{ flex: 1, minWidth: 0 }}
                                    >
                                        <option value="">Choose location…</option>
                                        {storageLocations.map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
                                    </select>
                                    <button className="ds-btn ds-btn-primary" disabled={busyId === item.id} onClick={() => assignStorage(item.id)}>
                                        Store
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="ds-card">
                <h3>Stored Items</h3>
                <p className="ds-card-desc">
                    Already shelved. Move an item to a different location, or check its movement history.
                </p>
                {loading && <div className="ds-skeleton" />}
                {!loading && stored.length === 0 && <div className="ds-empty">Nothing on the shelf right now.</div>}
                {!loading && stored.length > 0 && (
                    <ul className="ds-list">
                        {stored.map(item => (
                            <li key={item.id} className="ds-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <div className="ds-list-item-main">
                                    <div style={{ minWidth: 0 }}>
                                        <p className="ds-list-item-title">{item.item_name}</p>
                                        <p className="ds-list-item-meta">
                                            {item.category}
                                            {item.storage_location?.code ? ` · Currently at ${item.storage_location.code}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="ds-list-item-side">
                                    <select
                                        value={move[item.id] || ''}
                                        onChange={(e) => setMove({ ...move, [item.id]: e.target.value })}
                                        style={{ flex: 1, minWidth: 0 }}
                                    >
                                        <option value="">Move to…</option>
                                        {storageLocations
                                            .filter(l => l.id !== item.storage_location_id)
                                            .map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
                                    </select>
                                    <button className="ds-btn ds-btn-primary" disabled={busyId === item.id} onClick={() => moveStorage(item.id)}>
                                        Move
                                    </button>
                                    <button className="ds-btn ds-btn-secondary" onClick={() => toggleHistory(item.id)}>
                                        {historyForId === item.id ? 'Hide history' : 'History'}
                                    </button>
                                </div>
                                {historyForId === item.id && (
                                    <div className="ds-card" style={{ marginTop: 8, marginBottom: 0 }}>
                                        {historyLoading && <div className="ds-skeleton" />}
                                        {!historyLoading && historyEntries.length === 0 && (
                                            <div className="ds-empty">No movement history recorded.</div>
                                        )}
                                        {!historyLoading && historyEntries.length > 0 && (
                                            <ul className="ds-list">
                                                {historyEntries.map(entry => (
                                                    <li key={entry.id} className="ds-list-item">
                                                        <div style={{ minWidth: 0 }}>
                                                            <p className="ds-list-item-title" style={{ textTransform: 'capitalize' }}>
                                                                {entry.action?.replace(/_/g, ' ')}
                                                                {entry.storage_location?.code ? ` — ${entry.storage_location.code}` : ''}
                                                            </p>
                                                            <p className="ds-list-item-meta">
                                                                {entry.mover?.name || 'Unknown staff'} · {new Date(entry.created_at).toLocaleString()}
                                                            </p>
                                                            {entry.notes && <p className="ds-list-item-meta">{entry.notes}</p>}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="ds-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <h3 style={{ marginBottom: 4 }}>Lost &amp; Found Storage</h3>
                        <p className="ds-card-desc">
                            Room / cabinet / shelf / box shelving for unmatched found items going through the normal
                            report → verify → match → claim flow. Each spot shows what's actually still there right now,
                            not just how many items were ever shelved here.
                        </p>
                    </div>
                    <a href="/app/security/unclaimed-items" className="ds-btn ds-btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                        Unclaimed Items
                    </a>
                </div>
                {!loading && storageLocations.length === 0 && (
                    <div className="ds-empty">No lost &amp; found storage locations yet — add one below.</div>
                )}
                <div className="ds-location-grid">
                    {storageLocations.map(l => (
                        <div key={l.id} className="ds-location-card">
                            <p className="ds-list-item-title">{l.code}</p>
                            <p className="ds-list-item-meta">
                                {[l.building?.name, l.room, l.cabinet, l.shelf, l.box].filter(Boolean).join(' · ')}
                            </p>
                            <p className="ds-list-item-meta">
                                <UserCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                                Added by {l.creator?.name || 'Unknown (legacy entry)'}
                            </p>
                            <div className="ds-chip-row" style={{ marginTop: 6 }}>
                                <CapacityBadge location={l} />
                            </div>
                            <LocationStatusChips location={l} />
                            <CapacityEditor location={l} onSaved={load} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="ds-card">
                <h3>Counter Storage</h3>
                <p className="ds-card-desc">
                    Front-desk spots for items checked in with a known owner at the Counter — expected back
                    same-day, not part of the lost &amp; found shelving above.
                </p>
                {!loading && counterLocations.length === 0 && (
                    <div className="ds-empty">No counter locations yet — add one below and set its type to Counter.</div>
                )}
                <div className="ds-location-grid">
                    {counterLocations.map(l => (
                        <div key={l.id} className="ds-location-card">
                            <p className="ds-list-item-title">{l.code}</p>
                            <p className="ds-list-item-meta">
                                {l.label || [l.building?.name, l.room, l.cabinet, l.shelf, l.box].filter(Boolean).join(' · ')}
                            </p>
                            <p className="ds-list-item-meta">
                                <UserCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                                Added by {l.creator?.name || 'Unknown (legacy entry)'}
                            </p>
                            <LocationStatusChips location={l} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="ds-card">
                <h4 style={{ marginTop: 0 }}>What the badges mean</h4>
                <p className="ds-card-desc" style={{ marginBottom: 10 }}>
                    Quick reference for reading a location's status chips above.
                </p>
                <div className="ds-legend-grid">
                    <div className="ds-legend-row">
                        <span className="ds-badge ds-badge-found ds-badge-icon"><PackageOpen size={12} /> On shelf</span>
                        <span className="ds-list-item-meta">— physically here, not yet matched to a claimant.</span>
                    </div>
                    <div className="ds-legend-row">
                        <span className="ds-badge ds-badge-claimed ds-badge-icon"><CheckCircle2 size={12} /> Claimed</span>
                        <span className="ds-list-item-meta">— a claim was approved, still sitting here until release is generated.</span>
                    </div>
                    <div className="ds-legend-row">
                        <span className="ds-badge ds-badge-pending ds-badge-icon"><QrCode size={12} /> Release pending</span>
                        <span className="ds-list-item-meta">— a release code/QR is out; hand it over once you scan a valid one.</span>
                    </div>
                    <div className="ds-legend-row">
                        <span className="ds-badge ds-badge-default ds-badge-icon"><PackageCheck size={12} /> Released</span>
                        <span className="ds-list-item-meta">— already picked up. History only, not physically at this spot anymore.</span>
                    </div>
                </div>
            </div>

            <div className="ds-card">
                <form onSubmit={createLocation}>
                    <h4>Add Storage Location</h4>
                    {error && <div className="ds-error">{error}</div>}
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Type <span className="ds-required">*</span></label>
                            <select value={newLoc.type} onChange={(e) => setNewLoc({ ...newLoc, type: e.target.value })} required>
                                <option value="storage">Lost &amp; Found Storage (room/cabinet/shelf/box)</option>
                                <option value="counter">Counter (front-desk, known-owner check-in)</option>
                            </select>
                            <p className="ds-field-hint">Which list this shows up in — Lost &amp; Found Storage or Counter Storage above.</p>
                        </div>
                        <div className="ds-field">
                            <label>Campus <span className="ds-required">*</span></label>
                            <select value={newLoc.campus_id} onChange={(e) => setNewLoc({ ...newLoc, campus_id: e.target.value })} aria-invalid={!!fieldErrors.campus_id} required>
                                {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <p className="ds-field-hint">Which campus this spot physically belongs to.</p>
                            {fieldErrors.campus_id && <div className="ds-field-error">{fieldErrors.campus_id}</div>}
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Code (unique) <span className="ds-required">*</span></label>
                            <input value={newLoc.code} onChange={(e) => setNewLoc({ ...newLoc, code: e.target.value })}
                                placeholder={newLoc.type === 'counter' ? 'e.g. CTR-MAIN-02' : 'e.g. STORE-A-3-5'} aria-invalid={!!fieldErrors.code} required />
                            <p className="ds-field-hint">A short internal ID — nothing else on this campus can use the same code.</p>
                            {fieldErrors.code && <div className="ds-field-error">{fieldErrors.code}</div>}
                        </div>
                        {newLoc.type === 'counter' && (
                            <div className="ds-field">
                                <label>Label <span className="ds-required">*</span></label>
                                <input value={newLoc.label} onChange={(e) => setNewLoc({ ...newLoc, label: e.target.value })}
                                    placeholder="e.g. Counter 2 / Guard House Front Desk" aria-invalid={!!fieldErrors.label} required />
                                <p className="ds-field-hint">A friendly name shown to students on their release notice.</p>
                                {fieldErrors.label && <div className="ds-field-error">{fieldErrors.label}</div>}
                            </div>
                        )}
                    </div>
                    {newLoc.type === 'storage' && (
                        <>
                            <div className="ds-form-row ds-form-row-2">
                                <div className="ds-field">
                                    <label>Room</label>
                                    <input value={newLoc.room} onChange={(e) => setNewLoc({ ...newLoc, room: e.target.value })} placeholder="e.g. Security Office" />
                                    <p className="ds-field-hint">Optional — the room this location is inside.</p>
                                </div>
                                <div className="ds-field">
                                    <label>Cabinet</label>
                                    <input value={newLoc.cabinet} onChange={(e) => setNewLoc({ ...newLoc, cabinet: e.target.value })} placeholder="e.g. Cabinet 2" />
                                    <p className="ds-field-hint">Optional — narrows it down further within the room.</p>
                                </div>
                            </div>
                            <div className="ds-form-row ds-form-row-2">
                                <div className="ds-field">
                                    <label>Shelf</label>
                                    <input value={newLoc.shelf} onChange={(e) => setNewLoc({ ...newLoc, shelf: e.target.value })} placeholder="e.g. Shelf B" />
                                    <p className="ds-field-hint">Optional — leave blank if the cabinet has no shelves.</p>
                                </div>
                                <div className="ds-field">
                                    <label>Box</label>
                                    <input value={newLoc.box} onChange={(e) => setNewLoc({ ...newLoc, box: e.target.value })} placeholder="e.g. Box 5" />
                                    <p className="ds-field-hint">Optional — the most specific level, e.g. a labeled bin.</p>
                                </div>
                            </div>
                            <div className="ds-form-row ds-form-row-2">
                                <div className="ds-field">
                                    <label>Capacity</label>
                                    <input type="number" min="1" value={newLoc.capacity}
                                        onChange={(e) => setNewLoc({ ...newLoc, capacity: e.target.value })} placeholder="No limit" />
                                    <p className="ds-field-hint">Optional — max items this spot can hold. Leave blank for no limit; can be set later too.</p>
                                </div>
                            </div>
                        </>
                    )}
                    <button className="ds-btn ds-btn-primary">Add Location</button>
                </form>
            </div>
        </DashboardShell>
    );
}