import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';

export default function SecurityFoundItemsReview() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [notes, setNotes] = useState({});
    const toast = useToast();

    useEffect(() => {
        document.title = "Found Item Reviews | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/found-items', { params: { status: 'pending_review' } })
            .then(res => setItems(res.data.data))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const verify = async (id, approved) => {
        setBusyId(id);
        try {
            await axios.post(`/found-items/${id}/verify`, { approved, notes: notes[id] || '' });
            toast.success(approved ? 'Found item report approved.' : 'Found item report rejected.', {
                title: approved ? 'Approved' : 'Rejected',
            });
            load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not update this report.', { title: 'Could not update' });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <DashboardShell
            eyebrow="Security"
            title="Found Item Reviews"
            subtitle="Verify incoming found-item reports before they're stored and matched."
        >
            <div className="ds-card">
                {loading && (<><div className="ds-skeleton" /><div className="ds-skeleton" /></>)}
                {!loading && items.length === 0 && <div className="ds-empty">Nothing waiting for review.</div>}
                {!loading && items.length > 0 && (
                    <ul className="ds-list">
                        {items.map(item => (
                            <li key={item.id} className="ds-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                    <div>
                                        <p className="ds-list-item-title">{item.item_name}</p>
                                        <p className="ds-list-item-meta">
                                            {item.category || 'Uncategorized'} · Found by {item.finder?.name} near {item.location_found || 'campus'}
                                        </p>
                                    </div>
                                </div>
                                <input
                                    placeholder="Notes (optional)"
                                    value={notes[item.id] || ''}
                                    onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                                    style={{ margin: '8px 0' }}
                                />
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="ds-btn ds-btn-success" disabled={busyId === item.id} onClick={() => verify(item.id, true)}>
                                        Approve
                                    </button>
                                    <button className="ds-btn ds-btn-danger" disabled={busyId === item.id} onClick={() => verify(item.id, false)}>
                                        Reject
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
