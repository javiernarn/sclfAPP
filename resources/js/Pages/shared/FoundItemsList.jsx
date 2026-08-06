import React, { useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link, useNavigate } from 'react-router-dom';
import { Package, ChevronRight, Eye, Lock } from 'lucide-react';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { useToast } from '../../context/ToastContext';
import { itemChannelLabel, itemChannelBadgeClass, itemChannelIcon } from '../../utils/itemChannel';

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
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    const [q, setQ] = useState('');
    const [view, setView] = useViewMode('found-items');
    const searchTimer = useRef(null);
    const requestId = useRef(0);
    const didMount = useRef(false);

    useEffect(() => {
        document.title = "Found Items | SCLF - Opol Community College";
    }, []);

    // `initial` drives the big skeleton (first load only). Every search
    // after that uses the smaller `searching` indicator instead, so the
    // whole list doesn't flash/reset on every keystroke.
    const load = (query, { initial = false } = {}) => {
        const thisRequest = ++requestId.current;
        if (initial) setLoading(true); else setSearching(true);
        axios.get('/found-items', { params: query ? { q: query } : {} })
            .then(res => {
                // Ignore stale responses if a newer search has since fired
                // (fast typing can otherwise let an older reply land last).
                if (thisRequest !== requestId.current) return;
                setItems(res.data.data);
                setError('');
            })
            .catch(() => {
                if (thisRequest !== requestId.current) return;
                setError('Could not load found items right now.');
            })
            .finally(() => {
                if (thisRequest !== requestId.current) return;
                setLoading(false);
                setSearching(false);
            });
    };

    useEffect(() => { load('', { initial: true }); }, []);

    // Debounced live search — waits ~400ms after typing stops before
    // hitting the server, so a fast typist doesn't fire a request per
    // keystroke.
    useEffect(() => {
        // Skip the very first run — the mount effect above already loads
        // the unfiltered list, so this would otherwise fire a duplicate
        // request for the same empty query.
        if (!didMount.current) { didMount.current = true; return; }
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { load(q); }, 400);
        return () => clearTimeout(searchTimer.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    return (
        <DashboardShell
            eyebrow="Lost & Found"
            title="Found Items"
            subtitle="Verified items currently being held by Security, ready to be matched with an owner."
        >
            {/* "Report Found Item" already lives in the sidebar — no need to
                repeat it up here too. */}
            <div className="ds-card">
                <div className="ds-list-head-row" style={{ marginBottom: 0 }}>
                    <form
                        onSubmit={(e) => { e.preventDefault(); clearTimeout(searchTimer.current); load(q); }}
                        className="ds-field"
                        style={{ marginBottom: 16, flex: '1 1 260px', position: 'relative' }}
                    >
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search by name or description…"
                            style={{ paddingRight: searching ? 32 : undefined }}
                        />
                        {searching && (
                            <span
                                className="ds-spinner"
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}
                                aria-label="Searching…"
                            />
                        )}
                    </form>
                    <ViewToggle mode={view} onChange={setView} className="mb-16" />
                </div>

                {error && <div className="ds-error">{error}</div>}

                {loading && (<><div className="ds-skeleton" /><div className="ds-skeleton" /><div className="ds-skeleton" /></>)}

                {!loading && !error && items.length === 0 && (
                    <div className="ds-empty">No found items reported yet.</div>
                )}

                {!loading && items.length > 0 && view === 'table' && (
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th>Found Near</th>
                                    <th>Source</th>
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
                                                'This item was already closed and found — it\'s no longer available to view.',
                                                { title: 'Item unavailable' }
                                            );
                                        } else {
                                            navigate(`/found-items/${item.id}`);
                                        }
                                    };
                                    const ChannelIcon = itemChannelIcon(item.intake_channel);
                                    return (
                                        <tr
                                            key={item.id}
                                            className={`is-clickable ${closed ? 'is-closed' : ''}`}
                                            onClick={goTo}
                                        >
                                            <td>
                                                <div className="ds-table-cell-main">
                                                    <span className="ds-thumb">
                                                        {item.image_url
                                                            ? <img src={item.image_url} alt="" />
                                                            : <Package size={17} />}
                                                    </span>
                                                    <span className="ds-table-title">{item.item_name}</span>
                                                </div>
                                            </td>
                                            <td className="ds-table-nowrap">{item.category || 'Uncategorized'}</td>
                                            <td className="ds-table-nowrap">{item.location_found || 'campus'}</td>
                                            <td className="ds-table-nowrap">
                                                <span className={`${itemChannelBadgeClass(item.intake_channel)} ds-badge-icon`}>
                                                    <ChannelIcon size={13} />
                                                    {itemChannelLabel(item.intake_channel)}
                                                </span>
                                            </td>
                                            <td><span className={badgeClass(item.status)}>{(item.status || '').replace(/_/g, ' ')}</span></td>
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
                            const ChannelIcon = itemChannelIcon(item.intake_channel);
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
                                        <span className={`${itemChannelBadgeClass(item.intake_channel)} ds-badge-icon`}>
                                            <ChannelIcon size={13} />
                                            {itemChannelLabel(item.intake_channel)}
                                        </span>
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
