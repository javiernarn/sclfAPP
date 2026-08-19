import React, { useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
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
} from '../../Components/icons';

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
                                    placeholder="School ID or name"
                                />
                            </div>
                        ) : (
                            <div className="ds-list-item">
                                <div className="ds-list-item-main">
                                    <UserCircle size={18} style={{ opacity: 0.6, marginRight: 6 }} />
                                    <span className="ds-list-item-title">{picked.name}</span>
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
                                            <UserCircle size={18} style={{ opacity: 0.6, marginRight: 6 }} />
                                            <span className="ds-list-item-title">{u.name}</span>
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
                                        {entry.requester?.student_id ? ` · ${entry.requester.student_id}` : ''}
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
    const isAdmin = Array.isArray(roles) && roles.includes('admin');

    const [counters, setCounters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openQueueFor, setOpenQueueFor] = useState(null);

    useEffect(() => {
        document.title = 'Counter Dashboard | SCLF - Opol Community College';
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/counter/dashboard')
            .then((res) => setCounters(res.data.data))
            .catch(() => toast.error('Could not load the counter dashboard.', { title: 'Failed to load' }))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);

    const handleStatusChange = async (counter, status) => {
        try {
            await axios.patch(`/storage-locations/${counter.id}/status`, { status });
            setCounters((cs) => cs.map((c) => (c.id === counter.id ? { ...c, status } : c)));
            toast.success(`${counter.label || counter.code} is now ${status}.`, { title: 'Status updated' });
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not update status.', { title: 'Failed' });
        }
    };

    return (
        <DashboardShell
            eyebrow="Security"
            title="Counter Dashboard"
            subtitle="Live status for every counter you can operate: who's on shift, today's activity, and the walk-in queue."
        >
            {loading && [...Array(2)].map((_, i) => <div key={i} className="ds-skeleton" style={{ height: 180, marginBottom: 16 }} />)}
            {!loading && counters.length === 0 && (
                <div className="ds-empty">No counters set up yet — add one from the Counter page.</div>
            )}
            {!loading && counters.map((counter) => (
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
