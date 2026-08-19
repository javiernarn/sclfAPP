import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';
import {
    History,
    PackageCheck,
    QrCode,
    UserCheck,
    Search,
    ChevronLeft,
    ChevronRight,
} from '../../Components/icons';

// Two tabs, mirroring the two release flows that actually exist in the
// backend (see HistoryController):
//  - "counter"     -> CounterIntakeService::checkIn() + ItemReleaseService,
//                     scoped to items checked in at the Counter.
//  - "lost-found"  -> the full report -> verify -> match -> claim ->
//                     evidence -> review -> approve -> release pipeline,
//                     across every intake channel.
const TABS = [
    { key: 'counter', label: 'Counter Release History', icon: PackageCheck },
    { key: 'lost-found', label: 'Lost & Found Release History', icon: History },
];

function ReleaseMethodBadge({ method }) {
    if (method === 'qr_scan') {
        return (
            <span className="ds-badge ds-badge-found ds-badge-icon">
                <QrCode size={12} /> QR scan
            </span>
        );
    }
    if (method === 'manual') {
        return (
            <span className="ds-badge ds-badge-pending ds-badge-icon">
                <UserCheck size={12} /> Manual release
            </span>
        );
    }
    return <span className="ds-badge ds-badge-default">Not released yet</span>;
}

function Pagination({ meta, onPage }) {
    if (!meta || meta.last_page <= 1) return null;
    return (
        <div className="ds-list-item-side" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button
                type="button"
                className="ds-btn ds-btn-secondary ds-btn-sm"
                disabled={meta.current_page <= 1}
                onClick={() => onPage(meta.current_page - 1)}
            >
                <ChevronLeft size={14} /> Prev
            </button>
            <span className="ds-list-item-meta">
                Page {meta.current_page} of {meta.last_page} · {meta.total} total
            </span>
            <button
                type="button"
                className="ds-btn ds-btn-secondary ds-btn-sm"
                disabled={meta.current_page >= meta.last_page}
                onClick={() => onPage(meta.current_page + 1)}
            >
                Next <ChevronRight size={14} />
            </button>
        </div>
    );
}

function CounterHistoryTab() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);

    const load = (targetPage = page) => {
        setLoading(true);
        axios.get('/history/counter-releases', {
            params: {
                q: q || undefined,
                status: status || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                page: targetPage,
            },
        })
            .then(res => {
                setRows(res.data.data);
                setMeta(res.data);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(1); setPage(1); /* eslint-disable-next-line */ }, [status, dateFrom, dateTo]);
    useEffect(() => {
        const t = setTimeout(() => { load(1); setPage(1); }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line
    }, [q]);
    useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

    return (
        <div className="ds-card">
            <p className="ds-card-desc">
                Items checked in at the Counter for a known owner (CounterIntakeService), and — once picked up —
                who released them and how. Checking an item in and releasing it are always two separate, separately
                audited actions, even when the same officer does both.
            </p>

            <div className="ds-filter-row" style={{ alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }} />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search item, owner name, or school ID…"
                        style={{ paddingLeft: 32, width: '100%' }}
                    />
                </div>
                <button type="button" className={`ds-filter-chip ${status === '' ? 'is-active' : ''}`} onClick={() => setStatus('')}>All</button>
                <button type="button" className={`ds-filter-chip ${status === 'released' ? 'is-active' : ''}`} onClick={() => setStatus('released')}>Released</button>
                <button type="button" className={`ds-filter-chip ${status === 'pending' ? 'is-active' : ''}`} onClick={() => setStatus('pending')}>Not yet released</button>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Checked in from" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Checked in to" />
            </div>

            {loading && <div className="ds-skeleton" />}
            {!loading && rows.length === 0 && <div className="ds-empty">No counter check-ins match these filters.</div>}

            {!loading && rows.length > 0 && (
                <>
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Owner</th>
                                    <th>Checked in</th>
                                    <th>Counter</th>
                                    <th>Released</th>
                                    <th>Method</th>
                                    <th>Code</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.found_item_id}>
                                        <td>
                                            <div className="ds-table-title">{r.item_name}</div>
                                            <div className="ds-table-sub">{r.category || '—'}</div>
                                        </td>
                                        <td>
                                            <div className="ds-table-title">{r.owner?.name || '—'}</div>
                                            <div className="ds-table-sub">{r.owner?.student_id || ''}</div>
                                        </td>
                                        <td className="ds-table-nowrap">
                                            <div>{r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : '—'}</div>
                                            <div className="ds-table-sub">by {r.checked_in_by || 'Unknown'}</div>
                                        </td>
                                        <td className="ds-table-nowrap">{r.counter || '—'}</td>
                                        <td className="ds-table-nowrap">
                                            {r.released_at ? (
                                                <>
                                                    <div>{new Date(r.released_at).toLocaleString()}</div>
                                                    <div className="ds-table-sub">by {r.released_by || 'Unknown'}</div>
                                                </>
                                            ) : '—'}
                                        </td>
                                        <td className="ds-table-nowrap"><ReleaseMethodBadge method={r.release_method} /></td>
                                        <td className="ds-table-nowrap">{r.public_code || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile-only stacked cards — same rows, no sideways scrolling. */}
                    <div className="ds-history-cards">
                        {rows.map(r => (
                            <div className="ds-history-card" key={r.found_item_id}>
                                <div className="ds-history-card-head">
                                    <div>
                                        <div className="ds-table-title">{r.item_name}</div>
                                        <div className="ds-table-sub">{r.category || '—'}</div>
                                    </div>
                                    <ReleaseMethodBadge method={r.release_method} />
                                </div>
                                <div className="ds-history-card-row">
                                    <span className="ds-history-card-label">Owner</span>
                                    <span className="ds-history-card-value">
                                        <div className="ds-table-title">{r.owner?.name || '—'}</div>
                                        <div className="ds-table-sub">{r.owner?.student_id || ''}</div>
                                    </span>
                                </div>
                                <div className="ds-history-card-row">
                                    <span className="ds-history-card-label">Checked in</span>
                                    <span className="ds-history-card-value">
                                        <div>{r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : '—'}</div>
                                        <div className="ds-table-sub">by {r.checked_in_by || 'Unknown'}</div>
                                    </span>
                                </div>
                                <div className="ds-history-card-row">
                                    <span className="ds-history-card-label">Counter</span>
                                    <span className="ds-history-card-value">{r.counter || '—'}</span>
                                </div>
                                <div className="ds-history-card-row">
                                    <span className="ds-history-card-label">Released</span>
                                    <span className="ds-history-card-value">
                                        {r.released_at ? (
                                            <>
                                                <div>{new Date(r.released_at).toLocaleString()}</div>
                                                <div className="ds-table-sub">by {r.released_by || 'Unknown'}</div>
                                            </>
                                        ) : '—'}
                                    </span>
                                </div>
                                <div className="ds-history-card-row">
                                    <span className="ds-history-card-label">Code</span>
                                    <span className="ds-history-card-value">{r.public_code || '—'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <Pagination meta={meta} onPage={setPage} />
        </div>
    );
}

// Lost & Found history is its own channel now — it always scopes to
// FoundItem::CHANNEL_ONLINE_REPORT (items strangers turned in online and
// that went through the full report -> verify -> match -> claim ->
// evidence -> review -> approve -> release pipeline). Counter check-ins
// have their own tab (CounterHistoryTab) with their own checked-in/
// released/not-yet-released view, so the two stop blending together here.
const LOST_FOUND_CHANNEL = 'online_report';

function LostFoundHistoryTab() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);

    const load = (targetPage = page) => {
        setLoading(true);
        axios.get('/history/lost-found-releases', {
            params: {
                q: q || undefined,
                channel: LOST_FOUND_CHANNEL,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                page: targetPage,
            },
        })
            .then(res => {
                setRows(res.data.data);
                setMeta(res.data);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(1); setPage(1); /* eslint-disable-next-line */ }, [dateFrom, dateTo]);
    useEffect(() => {
        const t = setTimeout(() => { load(1); setPage(1); }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line
    }, [q]);
    useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

    return (
        <div className="ds-card">
            <p className="ds-card-desc">
                Completed releases from the full claim pipeline (report → verify → match → claim → evidence →
                review → approve → release) — items strangers turned in online only. Counter check-ins have
                their own tab. A release here always comes from a claim that reached <strong>released</strong> status
                via <code>ItemReleaseService::scanAndRelease()</code> (a valid QR scan) or
                <code> ::manualRelease()</code> (an officer override with a required reason).
            </p>

            <div className="ds-filter-row" style={{ alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }} />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search item, claimant name, or school ID…"
                        style={{ paddingLeft: 32, width: '100%' }}
                    />
                </div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Released from" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Released to" />
            </div>

            {loading && <div className="ds-skeleton" />}
            {!loading && rows.length === 0 && <div className="ds-empty">No completed releases match these filters.</div>}

            {!loading && rows.length > 0 && (
                <>
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Claimant</th>
                                    <th>Reviewed</th>
                                    <th>Released</th>
                                    <th>Method</th>
                                    <th>Code</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.claim_id}>
                                        <td>
                                            <div className="ds-table-title">{r.item?.item_name || '—'}</div>
                                            <div className="ds-table-sub">{r.item?.category || ''}</div>
                                        </td>
                                        <td>
                                            <div className="ds-table-title">{r.claimant?.name || '—'}</div>
                                            <div className="ds-table-sub">{r.claimant?.student_id || ''}</div>
                                        </td>
                                        <td className="ds-table-nowrap">
                                            {r.reviewed_at ? (
                                                <>
                                                    <div>{new Date(r.reviewed_at).toLocaleString()}</div>
                                                    <div className="ds-table-sub">by {r.reviewed_by || 'Unknown'}</div>
                                                </>
                                            ) : '—'}
                                        </td>
                                        <td className="ds-table-nowrap">
                                            {r.released_at ? (
                                                <>
                                                    <div>{new Date(r.released_at).toLocaleString()}</div>
                                                    <div className="ds-table-sub">by {r.released_by || 'Unknown'}</div>
                                                </>
                                            ) : '—'}
                                        </td>
                                        <td className="ds-table-nowrap"><ReleaseMethodBadge method={r.release_method} /></td>
                                        <td className="ds-table-nowrap">{r.public_code || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile-only stacked cards — same rows, no sideways scrolling. */}
                    <div className="ds-history-cards">
                        {rows.map(r => (
                            <div className="ds-history-card" key={r.claim_id}>
                                <div className="ds-history-card-head">
                                    <div>
                                        <div className="ds-table-title">{r.item?.item_name || '—'}</div>
                                        <div className="ds-table-sub">{r.item?.category || ''}</div>
                                    </div>
                                    <ReleaseMethodBadge method={r.release_method} />
                                </div>
                                <div className="ds-history-card-row">
                                    <span className="ds-history-card-label">Claimant</span>
                                    <span className="ds-history-card-value">
                                        <div className="ds-table-title">{r.claimant?.name || '—'}</div>
                                        <div className="ds-table-sub">{r.claimant?.student_id || ''}</div>
                                    </span>
                                </div>
                                <div className="ds-history-card-row">
                                    <span className="ds-history-card-label">Reviewed</span>
                                    <span className="ds-history-card-value">
                                        {r.reviewed_at ? (
                                            <>
                                                <div>{new Date(r.reviewed_at).toLocaleString()}</div>
                                                <div className="ds-table-sub">by {r.reviewed_by || 'Unknown'}</div>
                                            </>
                                        ) : '—'}
                                    </span>
                                </div>
                                <div className="ds-history-card-row">
                                    <span className="ds-history-card-label">Released</span>
                                    <span className="ds-history-card-value">
                                        {r.released_at ? (
                                            <>
                                                <div>{new Date(r.released_at).toLocaleString()}</div>
                                                <div className="ds-table-sub">by {r.released_by || 'Unknown'}</div>
                                            </>
                                        ) : '—'}
                                    </span>
                                </div>
                                <div className="ds-history-card-row">
                                    <span className="ds-history-card-label">Code</span>
                                    <span className="ds-history-card-value">{r.public_code || '—'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <Pagination meta={meta} onPage={setPage} />
        </div>
    );
}

export default function SecurityHistory() {
    const [tab, setTab] = useState('counter');
    const { roles } = useAuth();
    const isAdminOnly = Array.isArray(roles) && roles.includes('admin') && !roles.includes('security_officer');
    const activeTabDef = TABS.find(t => t.key === tab) ?? TABS[0];

    useEffect(() => {
        document.title = "History | SCLF - Opol Community College";
    }, []);

    return (
        <DashboardShell
            eyebrow={isAdminOnly ? "Admin" : "Security"}
            title="History"
            subtitle={isAdminOnly
                ? "Security's release history — counter check-ins and the full Lost & Found claim pipeline, visible to admins for oversight."
                : "Detailed release history — counter check-ins and the full Lost & Found claim pipeline."}
        >
            <div className="ds-card">
                {/* Segmented switch on the left decides which panel renders below;
                    the label on the right always mirrors that same choice (same
                    `tab` state drives both), so there's no reading one button while
                    a different table is actually showing. */}
                <div className="ds-list-head-row" style={{ marginBottom: 0 }}>
                    <div className="ds-view-toggle" role="group" aria-label="Switch history type">
                        {TABS.map(t => {
                            const Icon = t.icon;
                            const isActive = tab === t.key;
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    className={`ds-view-toggle-btn ${isActive ? 'is-active' : ''}`}
                                    aria-pressed={isActive}
                                    onClick={() => setTab(t.key)}
                                >
                                    <Icon size={14} /> {t.key === 'counter' ? 'Counter' : 'Lost & Found'}
                                </button>
                            );
                        })}
                    </div>
                    <h3>{activeTabDef.label}</h3>
                </div>
            </div>

            {tab === 'counter' ? <CounterHistoryTab /> : <LostFoundHistoryTab />}
        </DashboardShell>
    );
}