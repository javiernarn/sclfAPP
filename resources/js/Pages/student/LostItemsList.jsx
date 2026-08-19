import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronRight, Eye, Lock } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { useToast } from '../../context/ToastContext';

const badgeClass = (status) => {
    const key = (status || '').toLowerCase();
    if (key === 'pending') return 'ds-badge ds-badge-pending';
    if (key === 'found') return 'ds-badge ds-badge-found';
    if (key === 'matched') return 'ds-badge ds-badge-found';
    if (key === 'claimed') return 'ds-badge ds-badge-claimed';
    if (key === 'closed') return 'ds-badge ds-badge-default';
    return 'ds-badge ds-badge-default';
};

// Once a lost item is closed, it's already been matched, claimed, and
// handed back — there's nothing left to view, so the row is no longer
// clickable. Mirrors the same treatment on the Found Items list.
const isClosed = (status) => (status || '').toLowerCase() === 'closed';

export default function LostItemsList() {
    const toast = useToast();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useViewMode('lost-items');

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
        >
            {/* "Report Lost Item" already lives in the sidebar — no need to
                repeat it up here too. */}
            <div className="ds-card">
                <div className="ds-list-head-row" style={{ justifyContent: 'flex-end' }}>
                    <ViewToggle mode={view} onChange={setView} />
                </div>

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

                {!loading && items.length > 0 && view === 'table' && (
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th>Reported By</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => {
                                    const closed = isClosed(item.status);
                                    const goTo = () => {
                                        if (closed) {
                                            toast.info(
                                                'This lost item is closed because it was already found — it\'s no longer available to view.',
                                                { title: 'Item unavailable' }
                                            );
                                        } else {
                                            navigate(`/app/lost-items/${item.id}/matches`);
                                        }
                                    };
                                    return (
                                        <tr
                                            key={item.id}
                                            className={`is-clickable ${closed ? 'is-closed' : ''}`}
                                            onClick={goTo}
                                        >
                                            <td>
                                                <div className="ds-table-cell-main">
                                                    <span className="ds-thumb"><Search size={15} /></span>
                                                    <span className="ds-table-title">{item.item_name}</span>
                                                </div>
                                            </td>
                                            <td className="ds-table-nowrap">{item.category || 'Uncategorized'}</td>
                                            <td className="ds-table-nowrap">{item.reporter}</td>
                                            <td><span className={badgeClass(item.status)}>{item.status || 'pending'}</span></td>
                                            <td>
                                                {closed ? (
                                                    <span className="ds-btn ds-btn-sm" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                                                        <Lock size={13} /> Closed
                                                    </span>
                                                ) : (
                                                    <span className="ds-btn ds-btn-view ds-btn-sm">
                                                        <Eye size={13} /> View
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && items.length > 0 && view === 'cards' && (
                    <ul className="ds-list">
                        {items.map(item => {
                            const closed = isClosed(item.status);
                            const rowContent = (
                                <>
                                    <div className="ds-list-item-main">
                                        <span className="ds-thumb">
                                            <Search size={17} />
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <p className="ds-list-item-title">{item.item_name}</p>
                                            <p className="ds-list-item-meta">
                                                {item.category || 'Uncategorized'} · Reported by {item.reporter}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ds-list-item-side">
                                        <span className={badgeClass(item.status)}>{item.status || 'pending'}</span>
                                        {closed ? (
                                            <span className="ds-btn ds-btn-sm" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                                                <Lock size={13} /> Closed
                                            </span>
                                        ) : (
                                            <span className="ds-btn ds-btn-view ds-btn-sm">
                                                <Eye size={13} /> View Matches <ChevronRight size={13} />
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
                                                'This lost item is closed because it was already found — it\'s no longer available to view.',
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
                                        to={`/app/lost-items/${item.id}/matches`}
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
