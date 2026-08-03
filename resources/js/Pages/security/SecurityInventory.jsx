import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';

export default function SecurityInventory() {
    const [locations, setLocations] = useState([]);
    const [unstored, setUnstored] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assign, setAssign] = useState({}); // itemId -> locationId
    const [busyId, setBusyId] = useState(null);
    const [newLoc, setNewLoc] = useState({ campus_id: '', room: '', cabinet: '', shelf: '', box: '', code: '' });
    const [campuses, setCampuses] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        document.title = "Inventory | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        Promise.all([
            axios.get('/storage-locations'),
            axios.get('/found-items', { params: { status: 'accepted' } }),
            axios.get('/campuses'),
        ])
            .then(([locRes, itemRes, campRes]) => {
                setLocations(locRes.data);
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
            load();
        } finally {
            setBusyId(null);
        }
    };

    const createLocation = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await axios.post('/storage-locations', newLoc);
            setNewLoc({ ...newLoc, room: '', cabinet: '', shelf: '', box: '', code: '' });
            load();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not create storage location.');
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
                                <div>
                                    <p className="ds-list-item-title">{item.item_name}</p>
                                    <p className="ds-list-item-meta">{item.category}</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <select value={assign[item.id] || ''} onChange={(e) => setAssign({ ...assign, [item.id]: e.target.value })}>
                                        <option value="">Choose location…</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
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
                <h3>Storage Locations</h3>
                <ul className="ds-list">
                    {locations.map(l => (
                        <li key={l.id} className="ds-list-item">
                            <div>
                                <p className="ds-list-item-title">{l.code}</p>
                                <p className="ds-list-item-meta">
                                    {[l.building?.name, l.room, l.cabinet, l.shelf, l.box].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                            <span className="ds-badge ds-badge-default">{l.found_items_count} item(s)</span>
                        </li>
                    ))}
                </ul>

                <form onSubmit={createLocation} style={{ marginTop: 16 }}>
                    <h4>Add Storage Location</h4>
                    {error && <div className="ds-error">{error}</div>}
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Campus <span className="ds-required">*</span></label>
                            <select value={newLoc.campus_id} onChange={(e) => setNewLoc({ ...newLoc, campus_id: e.target.value })} required>
                                {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="ds-field">
                            <label>Code (unique) <span className="ds-required">*</span></label>
                            <input value={newLoc.code} onChange={(e) => setNewLoc({ ...newLoc, code: e.target.value })}
                                placeholder="e.g. STORE-A-3-5" required />
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Room</label>
                            <input value={newLoc.room} onChange={(e) => setNewLoc({ ...newLoc, room: e.target.value })} />
                        </div>
                        <div className="ds-field">
                            <label>Cabinet</label>
                            <input value={newLoc.cabinet} onChange={(e) => setNewLoc({ ...newLoc, cabinet: e.target.value })} />
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Shelf</label>
                            <input value={newLoc.shelf} onChange={(e) => setNewLoc({ ...newLoc, shelf: e.target.value })} />
                        </div>
                        <div className="ds-field">
                            <label>Box</label>
                            <input value={newLoc.box} onChange={(e) => setNewLoc({ ...newLoc, box: e.target.value })} />
                        </div>
                    </div>
                    <button className="ds-btn ds-btn-primary">Add Location</button>
                </form>
            </div>
        </DashboardShell>
    );
}
