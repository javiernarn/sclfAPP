import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import { Package, ChevronRight, Eye } from 'lucide-react';
import DashboardShell from '../../Components/shared/DashboardShell';

const badgeClass = (status) => {
    const key = (status || '').toLowerCase();
    if (key === 'pending_review') return 'ds-badge ds-badge-pending';
    if (key === 'stored' || key === 'accepted') return 'ds-badge ds-badge-found';
    if (key === 'claimed' || key === 'release_pending') return 'ds-badge ds-badge-claimed';
    if (key === 'released') return 'ds-badge ds-badge-default';
    if (key === 'rejected') return 'ds-badge ds-badge-default';
    return 'ds-badge ds-badge-default';
};

export default function FoundItemsList() {
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
                        {items.map(item => (
                            <li key={item.id} className="ds-list-item">
                                <Link
                                    to={`/found-items/${item.id}`}
                                    style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                        <span className={badgeClass(item.status)}>{(item.status || '').replace(/_/g, ' ')}</span>
                                        <span className="ds-btn ds-btn-view ds-btn-sm">
                                            <Eye size={13} /> View Details <ChevronRight size={13} />
                                        </span>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
