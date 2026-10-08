import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';

// The handlers' match queue (Security Officer, Admin, Staff). The matching
// engine records every lost <-> found pairing it scores 40+; this page is
// where a person actually works them: confirm one looks real and tell the
// owner, or rule it out. Ownership is still only ever decided by the claim
// verification flow — a match here is never a release.

const TABS = [
    { key: 'pending', label: 'Needs review' },
    { key: 'notified', label: 'Owner notified' },
    { key: 'claimed', label: 'Claimed' },
    { key: 'dismissed', label: 'Dismissed' },
];

const EMPTY_TEXT = {
    pending: 'No matches waiting for review. New ones appear when a lost report lines up with a stored found item.',
    notified: 'No matches have been sent to an owner yet.',
    claimed: 'No matches have turned into a claim yet.',
    dismissed: 'Nothing has been dismissed.',
};

const levelBadge = (level) => {
    const map = {
        very_high: 'ds-badge ds-badge-found',
        high: 'ds-badge ds-badge-found',
        possible: 'ds-badge ds-badge-pending',
        low: 'ds-badge ds-badge-default',
    };
    return map[level] || 'ds-badge ds-badge-default';
};

const levelLabel = (level) => (level || 'low').replace('_', ' ');

const BREAKDOWN_LABELS = {
    category: 'Category',
    item_name: 'Name',
    brand: 'Brand',
    color: 'Color',
    location: 'Place',
    date: 'Date',
    description: 'Description',
    unique_characteristics: 'Unique marks',
};

export default function SecurityMatches() {
    const toast = useToast();
    const [tab, setTab] = useState('pending');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        document.title = 'Matches | SCLF - Opol Community College';
    }, []);

    const load = () => {
        setLoading(true);
        setError('');
        axios.get('/matches', { params: { status: tab, q: query || undefined, page } })
            .then((res) => {
                setRows(res.data.data || []);
                setMeta({
                    current_page: res.data.current_page,
                    last_page: res.data.last_page,
                    total: res.data.total,
                });
            })
            .catch(() => setError('Could not load matches right now.'))
            .finally(() => setLoading(false));
    };

    // Re-load on tab / page change, and (debounced) while typing a search.
    useEffect(() => {
        const t = setTimeout(load, query ? 300 : 0);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, page, query]);

    const changeTab = (key) => {
        setTab(key);
        setPage(1);
    };

    const act = async (match, action) => {
        setBusyId(match.id);
        try {
            if (action === 'notify') {
                await axios.post(`/matches/${match.id}/notify-owner`);
                toast.success('The owner has been notified.', { title: 'Owner notified' });
            } else {
                await axios.post(`/matches/${match.id}/dismiss`);
                toast.success('Match dismissed.', { title: 'Dismissed' });
            }
            load();
        } catch (err) {
            // Staff writes that need admin approval are handled by the
            // axios interceptor (approval modal) — don't double-toast it.
            if (err?.response?.data?.code !== 'approval_required') {
                toast.error(err?.response?.data?.message || 'Could not update this match.', { title: 'Could not update' });
            }
        } finally {
            setBusyId(null);
        }
    };

    return (
        <DashboardShell onRefresh={() => load()} refreshing={loading}
            eyebrow="Lost & Found"
            title="Matches"
            subtitle="Possible pairings between lost reports and found items. Confirm the ones that look real and tell the owner — ownership is still verified through the claim."
        >
            <div className="ds-card">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            className={`ds-btn ${tab === t.key ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                            onClick={() => changeTab(t.key)}
                            aria-pressed={tab === t.key}
                        >
                            {t.label}
                        </button>
                    ))}
                    <input
                        type="search"
                        placeholder="Search item name…"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                        style={{ marginLeft: 'auto', minWidth: 200 }}
                        aria-label="Search matches by item name"
                    />
                </div>

                {error && <div className="ds-error">{error}</div>}
                {loading && (<><div className="ds-skeleton" /><div className="ds-skeleton" /></>)}

                {!loading && !error && rows.length === 0 && (
                    <div className="ds-empty">{query ? 'No matches for that search.' : EMPTY_TEXT[tab]}</div>
                )}

                {!loading && rows.length > 0 && (
                    <ul className="ds-list">
                        {rows.map((m) => {
                            const open = m.status === 'pending' || m.status === 'notified';
                            const parts = Object.entries(m.score_breakdown || {}).filter(([, v]) => Number(v) > 0);

                            return (
                                <li key={m.id} className="ds-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                        <div style={{ flex: '1 1 240px' }}>
                                            <p className="ds-list-item-meta" style={{ margin: 0 }}>LOST</p>
                                            <p className="ds-list-item-title">{m.lost_item?.item_name || 'Lost item'}</p>
                                            <p className="ds-list-item-meta">
                                                {m.lost_item?.category || 'Uncategorized'}
                                                {m.lost_item?.user?.name ? ` · Reported by ${m.lost_item.user.name}` : ''}
                                                {m.lost_item?.location_lost ? ` · near ${m.lost_item.location_lost}` : ''}
                                            </p>
                                        </div>
                                        <div style={{ flex: '1 1 240px' }}>
                                            <p className="ds-list-item-meta" style={{ margin: 0 }}>FOUND</p>
                                            <p className="ds-list-item-title">{m.found_item?.item_name || 'Found item'}</p>
                                            <p className="ds-list-item-meta">
                                                {m.found_item?.category || 'Uncategorized'}
                                                {m.found_item?.location_found ? ` · found near ${m.found_item.location_found}` : ''}
                                                {m.found_item?.status ? ` · ${String(m.found_item.status).replace(/_/g, ' ')}` : ''}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span className={levelBadge(m.match_level)}>{levelLabel(m.match_level)}</span>
                                            <p className="ds-list-item-meta" style={{ marginTop: 6 }}>Score {m.score}/100</p>
                                        </div>
                                    </div>

                                    {parts.length > 0 && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {parts.map(([k, v]) => (
                                                <span key={k} className="ds-badge ds-badge-default">
                                                    {BREAKDOWN_LABELS[k] || k} +{v}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <Link to={`/app/found-items/${m.found_item_id}`} className="ds-btn ds-btn-secondary">
                                            View found item
                                        </Link>
                                        {open && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="ds-btn ds-btn-primary"
                                                    disabled={busyId === m.id}
                                                    onClick={() => act(m, 'notify')}
                                                >
                                                    {m.status === 'notified' ? 'Remind owner' : 'Notify owner'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ds-btn ds-btn-danger"
                                                    disabled={busyId === m.id}
                                                    onClick={() => act(m, 'dismiss')}
                                                >
                                                    Not a match
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {meta.last_page > 1 && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
                        <button type="button" className="ds-btn ds-btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                            Previous
                        </button>
                        <span className="ds-list-item-meta">Page {meta.current_page} of {meta.last_page}</span>
                        <button type="button" className="ds-btn ds-btn-secondary" disabled={page >= meta.last_page || loading} onClick={() => setPage((p) => p + 1)}>
                            Next
                        </button>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
