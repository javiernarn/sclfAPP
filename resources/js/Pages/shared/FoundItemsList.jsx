import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import { Package, ChevronRight, Eye, Lock } from 'lucide-react';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';

const badgeClass = (status) => {
    const key = (status || '').toLowerCase();
    if (key === 'pending_review') return 'ds-badge ds-badge-pending';
    if (key === 'stored' || key === 'accepted') return 'ds-badge ds-badge-found';
    if (key === 'claimed' || key === 'release_pending') return 'ds-badge ds-badge-claimed';
    if (key === 'released') return 'ds-badge ds-badge-default';
    if (key === 'rejected') return 'ds-badge ds-badge-default';
    return 'ds-badge ds-badge-default';
};

// Items in these statuses are already spoken for (claim approved/being
// released) or fully wrapped up (handed back to the owner) — there's
// nothing left for another user to do with them, so the row is no longer
// clickable.
const CLOSED_STATUSES = ['claimed', 'release_pending', 'released'];
const isClosed = (status) => CLOSED_STATUSES.includes((status || '').toLowerCase());

export default function FoundItemsList() {
    const toast = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [q, setQ] = useState('');

    useEffect(() => {
        document.title = "Found Items | SCLF - Opol Community College";
    }, []);

    const load = (query) => {
        setLoading(true);
        axios.get('/found-items', { params: query ? { q: query } : {} })
            .then(res => setItems(res.data.data))
            .catch(() => setError('Could not load found items right now.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(''); }, []);

    return (
        <DashboardShell
            eyebrow="Lost & Found"
            title="Found Items"
            subtitle="Verified items currently being held by Security, ready to be matched with an owner."
        >
            {/* "Report Found Item" already lives in the sidebar — no need to
                repeat it up here too. */}
            <div className="ds-card">
                <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="ds-field" style={{ marginBottom: 16 }}>
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or description…" />
                </form>

                {error && <div className="ds-error">{error}</div>}

                {loading && (<><div className="ds-skeleton" /><div className="ds-skeleton" /><div className="ds-skeleton" /></>)}

                {!loading && !error && items.length === 0 && (
                    <div className="ds-empty">No found items reported yet.</div>
                )}

                {!loading && items.length > 0 && (
                    <ul className="ds-list">
                        {items.map(item => {
                            const closed = isClosed(item.status);
                            const rowContent = (
                                <>
                                    <div className="ds-list-item-main">
                                        <span className="ds-thumb">
                                            {item.image_url
                                                ? <img src={item.image_url} alt="" />
                                                : <Package size={19} />}
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <p className="ds-list-item-title">{item.item_name}</p>
                                            <p className="ds-list-item-meta">
                                                {item.category || 'Uncategorized'} · Found near {item.location_found || 'campus'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ds-list-item-side">
                                        <span className={badgeClass(item.status)}>{(item.status || '').replace(/_/g, ' ')}</span>
                                        {closed ? (
                                            <span className="ds-btn ds-btn-sm" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                                                <Lock size={13} /> Closed
                                            </span>
                                        ) : (
                                            <span className="ds-btn ds-btn-view ds-btn-sm">
                                                <Eye size={13} /> View Details <ChevronRight size={13} />
                                            </span>
                                        )}
                                    </div>
                                </>
                            );

                            if (closed) {
                                return (
                                    <li key={item.id} className="ds-list-item" style={{ opacity: 0.65 }}>
                                        <button
                                            type="button"
                                            onClick={() => toast.info(
                                                'This item was already closed and found — it\'s no longer available to view.',
                                                { title: 'Item unavailable' }
                                            )}
                                            className="ds-list-item-link"
                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
                                        >
                                            {rowContent}
                                        </button>
                                    </li>
                                );
                            }

                            return (
                                <li key={item.id} className="ds-list-item">
                                    <Link
                                        to={`/found-items/${item.id}`}
                                        className="ds-list-item-link"
                                    >
                                        {rowContent}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
