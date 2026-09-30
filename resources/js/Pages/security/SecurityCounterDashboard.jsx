import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { OwnerAvatar } from './SecurityCounter';
import {
    ListOrdered,
    UserCircle,
    Search,
    PhoneCall,
    PlayCircle,
    CheckCircle2,
    XCircle,
    UserX,
    ChevronDown,
    ChevronUp,
    Users,
    PackageCheck,
    Hourglass,
    Activity,
} from '../../Components/icons';
import { KpiCard, ChartCard, DonutChart, RankedBars, LiveBadge, usePolling } from '../../Components/charts';

// Status a counter can be in — mirrors StorageLocation::STATUSES on the
// backend exactly (see the status migration + CounterIntakeService,
// which now actually enforces this instead of just storing it).
const STATUS_OPTIONS = [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'inactive', label: 'Inactive' },
];

const STATUS_BADGE_CLASS = {
    open: 'ds-badge-claimed',
    closed: 'ds-badge-default',
    maintenance: 'ds-badge-pending',
    inactive: 'ds-badge-rejected',
};

const QUEUE_LABEL = {
    waiting: 'Waiting',
    called: 'Called',
    serving: 'Serving',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No-show',
};

const PURPOSE_OPTIONS = [
    { value: 'claim_item', label: 'Claim an item' },
    { value: 'report_lost', label: 'Report something lost' },
    { value: 'report_found', label: 'Report something found' },
    { value: 'inquiry', label: 'General inquiry' },
    { value: 'other', label: 'Other' },
];

function StatusBadge({ status }) {
    const cls = STATUS_BADGE_CLASS[status] || 'ds-badge-default';
    return <span className={`ds-badge ${cls}`}>{STATUS_OPTIONS.find((s) => s.value === status)?.label || status}</span>;
}

// One counter's card: status + officers on shift + today's activity,
// with an expandable panel underneath for the actual queue.
function CounterCard({ counter, isAdmin, onStatusChange, onOpenQueue, queueOpen }) {
    const [changingStatus, setChangingStatus] = useState(false);

    const queueCounts = counter.queue_counts || {};
    const waitingCount = Number(queueCounts.waiting || 0);
    const activeCount = waitingCount + Number(queueCounts.called || 0) + Number(queueCounts.serving || 0);

    return (
        <div className="ds-card">
            <div className="ds-card-title" style={{ justifyContent: 'space-between', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span className="ds-card-title-icon">
                    <ListOrdered size={17} /> {counter.label || counter.code}
                </span>
                <StatusBadge status={counter.status} />
            </div>
            <p className="ds-card-desc" style={{ marginBottom: 12 }}>
                {counter.campus?.name || 'No campus set'} · {counter.code}
            </p>

            <div className="ds-stat-grid" style={{ marginBottom: 12 }}>
                <div className="ds-stat-card">
                    <div className="ds-stat-icon"><PackageCheck size={20} strokeWidth={2} /></div>
                    <div className="ds-stat-value">{counter.checked_in_today_count ?? 0}</div>
                    <div className="ds-stat-label">Checked in today</div>
                </div>
                <div className="ds-stat-card">
                    <div className="ds-stat-icon"><Users size={20} strokeWidth={2} /></div>
                    <div className="ds-stat-value">{counter.current_officers?.length ?? 0}</div>
                    <div className="ds-stat-label">Officers on shift</div>
                </div>
                <div className="ds-stat-card">
                    <div className="ds-stat-icon"><ListOrdered size={20} strokeWidth={2} /></div>
                    <div className="ds-stat-value">{activeCount}</div>
                    <div className="ds-stat-label">In queue now</div>
                </div>
            </div>

            {counter.current_officers?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {counter.current_officers.map((o) => (
                        <span key={o.id} className="ds-chip">
                            <UserCircle size={13} style={{ marginRight: 4, opacity: 0.7 }} />
                            {o.name}
                        </span>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                    value={counter.status}
                    disabled={changingStatus}
                    onChange={async (e) => {
                        setChangingStatus(true);
                        await onStatusChange(counter, e.target.value);
                        setChangingStatus(false);
                    }}
                    style={{ maxWidth: 160 }}
                >
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={() => onOpenQueue(counter)}>
                    {queueOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Queue{waitingCount > 0 ? ` (${waitingCount} waiting)` : ''}
                </button>
            </div>
        </div>
    );
}

// The expandable queue panel for one counter — walk-in add form + the
// live list with per-entry actions. Fetched only once expanded, so the
// dashboard's first load stays light even with many counters.
function QueuePanel({ counter, toast }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    // --- add a walk-in -------------------------------------------------
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [picked, setPicked] = useState(null);
    const [purpose, setPurpose] = useState('inquiry');
    const [adding, setAdding] = useState(false);
    const searchTimer = useRef(null);

    const load = () => {
        setLoading(true);
        axios.get(`/storage-locations/${counter.id}/queue`)
            .then((res) => setEntries(res.data.data))
            .catch(() => toast.error('Could not load the queue.', { title: 'Failed to load' }))
            .finally(() => setLoading(false));
    };
    useEffect(load, [counter.id]);

    useEffect(() => {
        clearTimeout(searchTimer.current);
        if (query.trim().length < 2) { setResults([]); return; }
        searchTimer.current = setTimeout(() => {
            setSearching(true);
            axios.get('/counter/owners', { params: { q: query.trim() } })
                .then((res) => setResults(res.data.data))
                .finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(searchTimer.current);
    }, [query]);

    const addWalkIn = async (e) => {
        e.preventDefault();
        if (!picked) { toast.error('Search for and select who is joining the queue first.', { title: 'No one selected' }); return; }
        setAdding(true);
        try {
            await axios.post(`/storage-locations/${counter.id}/queue/join`, { user_id: picked.id, purpose });
            toast.success(`${picked.name} added to the queue.`, { title: 'Added' });
            setPicked(null);
            setQuery('');
            load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not add to the queue.', { title: 'Failed' });
        } finally {
            setAdding(false);
        }
    };

    const act = async (entry, action) => {
        setBusyId(entry.id);
        try {
            if (action === 'cancel') {
                await axios.delete(`/counter/queue/${entry.id}`);
            } else {
                await axios.post(`/counter/queue/${entry.id}/${action}`);
            }
            load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Action failed.', { title: 'Could not update ticket' });
        } finally {
            setBusyId(null);
        }
    };

    const callNext = async () => {
        try {
            const res = await axios.post(`/storage-locations/${counter.id}/queue/call-next`);
            if (!res.data.data) {
                toast.info('Nobody is waiting.', { title: 'Queue empty' });
            } else {
                toast.success(`Ticket #${res.data.data.ticket_number} called.`, { title: 'Called' });
            }
            load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not call next.', { title: 'Failed' });
        }
    };

    return (
        <div className="ds-card" style={{ marginTop: -8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>Queue at {counter.label || counter.code}</h4>
                <button type="button" className="ds-btn ds-btn-primary ds-btn-sm" onClick={callNext}>
                    <PhoneCall size={14} /> Call next
                </button>
            </div>

            <form onSubmit={addWalkIn} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border, #e5e5e5)' }}>
                <p className="ds-card-desc" style={{ marginTop: 0 }}>Add a walk-in who doesn't have the app open.</p>
                <div className="ds-form-row ds-form-row-2">
                    <div className="ds-field">
                        <label>Find person</label>
                        {!picked ? (
                            <div style={{ position: 'relative' }}>
                                <Search size={15} style={{ position: 'absolute', left: 10, top: 11, opacity: 0.5 }} />
                                <input
                                    style={{ paddingLeft: 32 }}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Student/staff ID or name"
                                />
                            </div>
                        ) : (
                            <div className="ds-list-item">
                                <div className="ds-list-item-main">
                                    <OwnerAvatar user={picked} />
                                    <div>
                                        <span className="ds-list-item-title">{picked.name}</span>
                                        {picked.display_id && <p className="ds-list-item-meta">{picked.display_id}</p>}
                                    </div>
                                </div>
                                <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={() => setPicked(null)}>Change</button>
                            </div>
                        )}
                        {!picked && searching && <div className="ds-skeleton" />}
                        {!picked && !searching && results.length > 0 && (
                            <ul className="ds-list">
                                {results.map((u) => (
                                    <li key={u.id} className="ds-list-item" style={{ cursor: 'pointer' }}
                                        onClick={() => { setPicked(u); setResults([]); setQuery(''); }}>
                                        <div className="ds-list-item-main">
                                            <OwnerAvatar user={u} />
                                            <div>
                                                <span className="ds-list-item-title">{u.name}</span>
                                                {u.display_id && <p className="ds-list-item-meta">{u.display_id}</p>}
                                            </div>
                                        </div>
                                        <button type="button" className="ds-btn ds-btn-primary ds-btn-sm">Select</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="ds-field">
                        <label>Purpose</label>
                        <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                            {PURPOSE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                </div>
                <button className="ds-btn ds-btn-primary ds-btn-sm" disabled={adding || !picked}>
                    {adding ? 'Adding…' : 'Add to queue'}
                </button>
            </form>

            {loading && <div className="ds-skeleton" />}
            {!loading && entries.length === 0 && <div className="ds-empty">Nobody's been in this counter's queue today.</div>}
            {!loading && entries.length > 0 && (
                <ul className="ds-list">
                    {entries.map((entry) => (
                        <li key={entry.id} className="ds-list-item" style={{ alignItems: 'flex-start' }}>
                            <div className="ds-list-item-main">
                                <div>
                                    <p className="ds-list-item-title">
                                        #{entry.ticket_number} — {entry.requester?.name}
                                        {' '}
                                        <span className={`ds-badge ds-badge-icon ${entry.status === 'completed' ? 'ds-badge-claimed' : entry.status === 'cancelled' || entry.status === 'no_show' ? 'ds-badge-rejected' : 'ds-badge-pending'}`}>
                                            {QUEUE_LABEL[entry.status] || entry.status}
                                        </span>
                                    </p>
                                    <p className="ds-list-item-meta">
                                        {PURPOSE_OPTIONS.find((p) => p.value === entry.purpose)?.label || entry.purpose || 'No purpose given'}
                                        {entry.requester?.display_id ? ` · ${entry.requester.display_id}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {entry.status === 'waiting' && (
                                    <button className="ds-btn ds-btn-primary ds-btn-sm" disabled={busyId === entry.id} onClick={() => act(entry, 'call')}>
                                        <PhoneCall size={13} /> Call
                                    </button>
                                )}
                                {entry.status === 'called' && (
                                    <>
                                        <button className="ds-btn ds-btn-success ds-btn-sm" disabled={busyId === entry.id} onClick={() => act(entry, 'serve')}>
                                            <PlayCircle size={13} /> Serving
                                        </button>
                                        <button className="ds-btn ds-btn-warning ds-btn-sm" disabled={busyId === entry.id} onClick={() => act(entry, 'no-show')}>
                                            <UserX size={13} /> No-show
                                        </button>
                                    </>
                                )}
                                {entry.status === 'serving' && (
                                    <button className="ds-btn ds-btn-success ds-btn-sm" disabled={busyId === entry.id} onClick={() => act(entry, 'complete')}>
                                        <CheckCircle2 size={13} /> Complete
                                    </button>
                                )}
                                {['waiting', 'called'].includes(entry.status) && (
                                    <button className="ds-btn ds-btn-danger ds-btn-sm" disabled={busyId === entry.id} onClick={() => act(entry, 'cancel')}>
                                        <XCircle size={13} /> Cancel
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function SecurityCounterDashboard() {
    const toast = useToast();
    const { roles } = useAuth();
    const isAdmin = Array.isArray(roles) && (roles.includes('admin') || roles.includes('staff'));

    // Polls /counter/dashboard every 15s — the same live-refresh pattern as
    // the Security / Admin dashboards, so every counter card, queue count
    // and KPI here stays current without a manual refresh.
    const { data, loading, error, updatedAt, refresh } = usePolling('/counter/dashboard', { interval: 15000 });
    const counters = data?.data || [];

    // A status change (Open/Closed/Maintenance) is applied optimistically
    // so the badge flips instantly, then the next poll (or an immediate
    // refresh) reconciles with the server.
    const [overrides, setOverrides] = useState({});
    useEffect(() => { setOverrides({}); }, [updatedAt]);
    const displayCounters = counters.map((c) => (overrides[c.id] ? { ...c, status: overrides[c.id] } : c));

    const [openQueueFor, setOpenQueueFor] = useState(null);

    useEffect(() => {
        document.title = 'Counter Dashboard | SCLF - Opol Community College';
    }, []);

    const handleStatusChange = async (counter, status) => {
        try {
            await axios.patch(`/storage-locations/${counter.id}/status`, { status });
            setOverrides((o) => ({ ...o, [counter.id]: status }));
            toast.success(`${counter.label || counter.code} is now ${status}.`, { title: 'Status updated' });
            refresh();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not update status.', { title: 'Failed' });
        }
    };

    // Aggregate every counter's queue into campus-wide totals for the KPI
    // row, a status-mix donut, and a "busiest counter" ranking.
    const agg = useMemo(() => {
        let waiting = 0, called = 0, serving = 0, checkedInToday = 0, officers = 0;
        const busiest = displayCounters.map((c) => {
            const q = c.queue_counts || {};
            const w = Number(q.waiting || 0), cl = Number(q.called || 0), sv = Number(q.serving || 0);
            waiting += w; called += cl; serving += sv;
            checkedInToday += Number(c.checked_in_today_count || 0);
            officers += c.current_officers?.length || 0;
            return { label: c.label || c.code, value: w + cl + sv };
        }).filter((c) => c.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);

        return { waiting, called, serving, checkedInToday, officers, busiest, activeTotal: waiting + called + serving };
    }, [displayCounters]);

    return (
        <DashboardShell
            eyebrow="Security"
            title="Counter Dashboard"
            subtitle="Live status for every counter you can operate: who's on shift, today's activity, and the walk-in queue."
        >
            <div className="ch-toolbar">
                <LiveBadge updatedAt={updatedAt} error={error} />
            </div>

            {loading && !data && [...Array(2)].map((_, i) => <div key={i} className="ds-skeleton" style={{ height: 180, marginBottom: 16 }} />)}

            {!loading && data && counters.length === 0 && (
                <div className="ds-empty">No counters set up yet — add one from the Counter page.</div>
            )}

            {!loading && data && counters.length > 0 && (
                <>
                    <div className="ch-kpi-grid">
                        <KpiCard icon={Hourglass} label="Waiting Now" value={agg.waiting} color="var(--ch-4)" goodWhen="down" />
                        <KpiCard icon={PlayCircle} label="Being Served" value={agg.serving} color="var(--ch-2)" />
                        <KpiCard icon={PackageCheck} label="Checked In Today" value={agg.checkedInToday} color="var(--ch-3)" />
                        <KpiCard icon={Users} label="Officers On Shift" value={agg.officers} color="var(--ch-1)" />
                    </div>

                    <div className="ch-row cols-2-1">
                        <ChartCard title="Busiest Counters" subtitle="Counters ranked by people currently in queue." icon={ListOrdered}>
                            <RankedBars items={agg.busiest} empty="No one in any queue right now" />
                        </ChartCard>
                        <ChartCard title="Queue Mix" subtitle="Waiting vs. called vs. serving, campus-wide." icon={Activity}>
                            {agg.activeTotal > 0 ? (
                                <DonutChart
                                    centerLabel="In queue"
                                    size={150}
                                    thickness={17}
                                    data={[
                                        { label: 'Waiting', value: agg.waiting, color: 'var(--ch-4)' },
                                        { label: 'Called', value: agg.called, color: 'var(--ch-2)' },
                                        { label: 'Serving', value: agg.serving, color: 'var(--ch-3)' },
                                    ]}
                                />
                            ) : (
                                <p className="ch-empty">Every queue is empty 🎉</p>
                            )}
                        </ChartCard>
                    </div>
                </>
            )}

            {!loading && data && displayCounters.map((counter) => (
                <React.Fragment key={counter.id}>
                    <CounterCard
                        counter={counter}
                        isAdmin={isAdmin}
                        onStatusChange={handleStatusChange}
                        queueOpen={openQueueFor === counter.id}
                        onOpenQueue={(c) => setOpenQueueFor(openQueueFor === c.id ? null : c.id)}
                    />
                    {openQueueFor === counter.id && <QueuePanel counter={counter} toast={toast} />}
                </React.Fragment>
            ))}
        </DashboardShell>
    );
}
