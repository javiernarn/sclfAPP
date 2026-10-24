import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronRight, Eye, Lock, Plus } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import LostItemForm from './LostItemForm';
import LostItemReviewPanel from '../../Components/shared/LostItemReviewPanel';

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
    const { roles } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Admin / staff / security only review reports; students and
    // instructors are the ones who file them.
    const canCreate = !(Array.isArray(roles) && (roles.includes('admin') || roles.includes('staff') || roles.includes('security_officer')));
    // "Create" swaps this page's list for the report form (kept in the URL
    // as ?new=1 so the browser Back button and old links behave).
    const creating = canCreate && searchParams.get('new') === '1';
    // Admin / staff / security also review pending reports right here
    // (the old separate "Lost Item Reviews" page), on their own tab.
    const isReviewer = !canCreate;
    const tab = isReviewer && searchParams.get('tab') === 'review' ? 'review' : 'all';
    const setTab = (t) => setSearchParams(t === 'review' ? { tab: 'review' } : {});
    const [pendingCount, setPendingCount] = useState(0);
    const [reviewKey, setReviewKey] = useState(0);
    const loadPending = () => {
        if (!isReviewer) return;
        axios.get('/lost-items', { params: { approval: 'pending' } })
            .then(res => setPendingCount((res.data.data || []).length))
            .catch(() => {});
    };
    const openCreate = () => setSearchParams({ new: '1' });
    const closeCreate = () => setSearchParams({}, { replace: true });

    useEffect(() => {
        document.title = creating
            ? "Report a Lost Item | SCLF - Opol Community College"
            : "Lost Items | SCLF - Opol Community College";
    }, [creating]);

    const load = () => {
        setLoading(true);
        setError('');
        axios.get('/lost-items')
            .then(res => setItems(res.data.data))
            .catch(() => setError('Could not load lost items right now.'))
            .finally(() => setLoading(false));
        loadPending();
    };

    useEffect(load, []);

    return (
        <DashboardShell onRefresh={creating ? undefined : () => { if (tab === 'review') { setReviewKey((k) => k + 1); loadPending(); } else load(); }} refreshing={loading}
            eyebrow="Lost & Found"
            title={creating ? "Report a Lost Item" : "Lost Items"}
            subtitle={creating
                ? "Give as much detail as you can — it helps the community find a match faster."
                : "Everything the community has reported lost around campus."}
        >
            {isReviewer && !creating && (
                <div className="ds-tabs" role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <button type="button" role="tab" aria-selected={tab === 'all'}
                        className={`ds-btn ${tab === 'all' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                        onClick={() => setTab('all')}>
                        All lost items
                    </button>
                    <button type="button" role="tab" aria-selected={tab === 'review'}
                        className={`ds-btn ${tab === 'review' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                        onClick={() => setTab('review')}>
                        Pending review{pendingCount > 0 ? ` (${pendingCount})` : ''}
                    </button>
                </div>
            )}
            {creating ? (
                <LostItemForm
                    onCancel={closeCreate}
                    onCreated={() => { closeCreate(); load(); }}
                />
            ) : tab === 'review' ? (
                <LostItemReviewPanel key={reviewKey} onChanged={() => { loadPending(); load(); }} />
            ) : (
            <div className="ds-card">
                <div className="ds-list-head-row" style={{ justifyContent: 'flex-end' }}>
                    <div className="ds-head-actions">
                        <ViewToggle mode={view} onChange={setView} />
                        {canCreate && (
                            <button type="button" className="ds-btn ds-btn-primary" onClick={openCreate}>
                                <Plus size={15} /> Create
                            </button>
                        )}
                    </div>
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
                                            <td>
                                                <span className={badgeClass(item.status)}>{item.status || 'pending'}</span>
                                                {!item.approved_at && <span className="ds-badge ds-badge-default" style={{ marginLeft: 6 }} title="Only you and Security can see this report until it is approved.">Awaiting review</span>}
                                            </td>
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
                                        {!item.approved_at && <span className="ds-badge ds-badge-default" title="Only you and Security can see this report until it is approved.">Awaiting review</span>}
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
            )}
        </DashboardShell>
    );
}
