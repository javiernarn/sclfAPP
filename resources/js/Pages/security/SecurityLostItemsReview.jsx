import React, { useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';

/**
 * Lost reports waiting for approval. Approving is instant on screen: the
 * row disappears at once and the POST returns in milliseconds, while the
 * server sends the "your classmate lost an item" emails in the background
 * (see BroadcastLostItemJob). If the request fails the row comes back.
 */
export default function SecurityLostItemsReview() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState({});
    const inFlight = useRef(new Set()); // blocks double-clicks
    const toast = useToast();

    useEffect(() => {
        document.title = 'Lost Item Reviews | SCLF - Opol Community College';
    }, []);

    const load = (silent = false) => {
        if (!silent) setLoading(true);
        return axios.get('/lost-items', { params: { approval: 'pending' } })
            .then((res) => setItems(res.data.data))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const approve = async (item) => {
        if (inFlight.current.has(item.id)) return;
        inFlight.current.add(item.id);

        // Optimistic: show it as approved immediately.
        const index = items.findIndex((i) => i.id === item.id);
        setItems((list) => list.filter((i) => i.id !== item.id));

        try {
            const res = await axios.post(`/lost-items/${item.id}/approve`, { note: notes[item.id] || '' });
            toast.success(
                res.data?.already_approved
                    ? 'This report was already approved.'
                    : res.data?.emails_enabled === false
                        ? 'Approved. Email broadcast is turned off.'
                        : 'Approved. Students are being emailed in the background.',
                { title: 'Approved' },
            );
            setNotes((n) => { const { [item.id]: _drop, ...rest } = n; return rest; });
            load(true); // quiet refresh to pull in the next page of pending items
        } catch (err) {
            // Roll back so nothing looks approved that isn't.
            setItems((list) => {
                const copy = [...list];
                copy.splice(Math.max(index, 0), 0, item);
                return copy;
            });
            toast.error(err?.response?.data?.message || 'Could not approve this report.', { title: 'Could not approve' });
        } finally {
            inFlight.current.delete(item.id);
        }
    };

    return (
        <DashboardShell onRefresh={() => load()} refreshing={loading}
            eyebrow="Security"
            title="Lost Item Reviews"
            subtitle="Approve a lost report to let students and instructors know, so someone who has seen it can report it found."
        >
            <div className="ds-card">
                {loading && (<><div className="ds-skeleton" /><div className="ds-skeleton" /></>)}
                {!loading && items.length === 0 && <div className="ds-empty">No lost reports waiting for approval.</div>}
                {!loading && items.length > 0 && (
                    <ul className="ds-list">
                        {items.map((item) => (
                            <li key={item.id} className="ds-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <div>
                                    <p className="ds-list-item-title">{item.item_name}</p>
                                    <p className="ds-list-item-meta">
                                        {item.category || 'Uncategorized'} · Lost by {item.reporter}
                                        {item.location_lost ? ` near ${item.location_lost}` : ''}
                                        {item.date_lost ? ` · ${String(item.date_lost).slice(0, 10)}` : ''}
                                    </p>
                                    {(item.brand || item.color) && (
                                        <p className="ds-list-item-meta">{[item.brand, item.color].filter(Boolean).join(' · ')}</p>
                                    )}
                                    {item.description && <p className="ds-list-item-meta">{item.description}</p>}
                                </div>
                                <input
                                    placeholder="Note shown in the email (optional)"
                                    value={notes[item.id] || ''}
                                    maxLength={500}
                                    onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                                    style={{ margin: '8px 0' }}
                                />
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="ds-btn ds-btn-success" onClick={() => approve(item)}>
                                        Approve &amp; notify students
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
