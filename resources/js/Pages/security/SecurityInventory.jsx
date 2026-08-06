import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';
import { UserCircle, PackageCheck, PackageOpen, QrCode, CheckCircle2 } from 'lucide-react';

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
    const released = location.released_count || 0;
    const stillHere = onShelf + claimed + pendingRelease;

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
            {released > 0 && (
                <span className="ds-badge ds-badge-default ds-badge-icon">
                    <PackageCheck size={12} /> {released} already released (history only)
                </span>
            )}
        </div>
    );
}

export default function SecurityInventory() {
    const [storageLocations, setStorageLocations] = useState([]);
    const [counterLocations, setCounterLocations] = useState([]);
    const [unstored, setUnstored] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assign, setAssign] = useState({}); // itemId -> locationId
    const [busyId, setBusyId] = useState(null);
    const [newLoc, setNewLoc] = useState({ campus_id: '', type: 'storage', label: '', room: '', cabinet: '', shelf: '', box: '', code: '' });
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
            axios.get('/campuses'),
        ])
            .then(([storeRes, counterRes, itemRes, campRes]) => {
                setStorageLocations(storeRes.data);
                setCounterLocations(counterRes.data);
                setUnstored(itemRes.data.data);
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

    const createLocation = async (e) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});
        try {
            await axios.post('/storage-locations', newLoc);
            setNewLoc({ ...newLoc, label: '', room: '', cabinet: '', shelf: '', box: '', code: '' });
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
                <h3>Lost &amp; Found Storage</h3>
                <p className="ds-card-desc">
                    Room / cabinet / shelf / box shelving for unmatched found items going through the normal
                    report → verify → match → claim flow. Each spot shows what's actually still there right now,
                    not just how many items were ever shelved here.
                </p>
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
                            <LocationStatusChips location={l} />
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
                        </>
                    )}
                    <button className="ds-btn ds-btn-primary">Add Location</button>
                </form>
            </div>
        </DashboardShell>
    );
}