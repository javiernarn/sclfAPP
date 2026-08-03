import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import DashboardShell from '../../Components/shared/DashboardShell';

const badgeClass = (status) => {
    const key = (status || '').toLowerCase();
    if (key === 'pending') return 'ds-badge ds-badge-pending';
    if (key === 'found') return 'ds-badge ds-badge-found';
    if (key === 'claimed') return 'ds-badge ds-badge-claimed';
    return 'ds-badge ds-badge-default';
};

export default function LostItemsList() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        document.title = "Lost Items | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        axios.get('/lost-items')
            .then(res => setItems(res.data.data))
            .catch(() => setError('Could not load lost items right now.'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <DashboardShell
            eyebrow="Lost & Found"
            title="Lost Items"
            subtitle="Everything the community has reported lost around campus."
            actions={
                <Link to="/lost-items/create" className="ds-btn ds-btn-primary">
                    <Plus size={16} strokeWidth={2.5} /> Report Lost Item
                </Link>
            }
        >
            <div className="ds-card">
                {error && <div className="ds-error">{error}</div>}

                {loading && (
                    <>
                        <div className="ds-skeleton" />
                        <div className="ds-skeleton" />
                        <div className="ds-skeleton" />
                    </>
                )}

                {!loading && !error && items.length === 0 && (
                    <div className="ds-empty">No lost items reported yet.</div>
                )}

                {!loading && items.length > 0 && (
                    <ul className="ds-list">
                        {items.map(item => (
                            <li key={item.id} className="ds-list-item">
                                <Link to={`/lost-items/${item.id}/matches`} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                                    <div>
                                        <p className="ds-list-item-title">{item.item_name}</p>
                                        <p className="ds-list-item-meta">
                                            {item.category || 'Uncategorized'} · Reported by {item.reporter}
                                        </p>
                                    </div>
                                    <span className={badgeClass(item.status)}>{item.status || 'pending'}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
