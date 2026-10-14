import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import WorkflowGuide from '../../Components/shared/WorkflowGuide';
import { useToast } from '../../context/ToastContext';
import './MatchCompare.css';

// The handlers' match queue (Security Officer, Admin, Staff).
//
// Every row is scored LIVE: the list re-polls every few seconds and the engine
// re-scores any match whose reports were edited, and "Compare details" opens a
// side-by-side, field-by-field breakdown scored at that moment. Ownership is
// still only ever decided by the claim verification flow — a match here is
// never a release.

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

// How often to ask the server "has anything changed?" (a tiny, cheap request — see MatchController::pulse).
const PULSE_MS = 8000;
const LEVEL_LABEL = { very_high: 'Very high', high: 'High', possible: 'Possible', low: 'Low' };
const LEVEL_BADGE = { very_high: 'ds-badge ds-badge-found', high: 'ds-badge ds-badge-found', possible: 'ds-badge ds-badge-pending', low: 'ds-badge ds-badge-default' };
const STATUS_MARK = { match: '✓', similar: '≈', different: '✕', unknown: '–' };
const STATUS_WORD = { match: 'Match', similar: 'Close', different: 'Different', unknown: 'Not enough info' };

const LEGACY_LABELS = {
    category: 'Category', item_name: 'Name', brand: 'Brand', model: 'Model', color: 'Color', location: 'Place', date: 'Date',
    description: 'Description', unique_characteristics: 'Unique marks', details: 'Specs & extras',
};

const clock = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Field rows for a card: the v2 explanation when present, else the old points-per-field map. */
const chipsFor = (m) => {
    const fields = m.score_details?.fields;
    if (fields?.length) return fields.filter((f) => f.status !== 'unknown').map((f) => ({ key: f.key, label: f.label, status: f.status, title: `${f.points}/${f.weight} pts` }));
    return Object.entries(m.score_breakdown || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => ({ key: k, label: LEGACY_LABELS[k] || k, status: 'match', title: `+${v}` }));
};

const storageText = (loc) => (loc ? [loc.code, loc.label, loc.room && `Room ${loc.room}`, loc.shelf && `Shelf ${loc.shelf}`, loc.box && `Box ${loc.box}`].filter(Boolean).join(' · ') : null);

function Photo({ src, caption }) {
    return (
        <figure className="mc-photo" style={{ margin: 0 }}>
            {src ? <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={caption} loading="lazy" /></a> : <div className="mc-nophoto">No photo</div>}
            <figcaption>{caption}</figcaption>
        </figure>
    );
}

function Detail({ detail, loading, error }) {
    if (loading && !detail) return <div className="mc-detail"><div className="ds-skeleton" /><div className="ds-skeleton" /></div>;
    if (error) return <div className="mc-detail"><div className="ds-error">{error}</div></div>;
    if (!detail) return null;

    const { match, analysis } = detail;
    const lost = match.lost_item || {};
    const found = match.found_item || {};
    const storage = storageText(found.storage_location);

    return (
        <div className="mc-detail">
            <div className="mc-reco"><b>{LEVEL_LABEL[analysis.level]} · {analysis.score}/100.</b> {analysis.recommendation}</div>

            {analysis.flags?.length > 0 && (
                <div className="mc-flags">
                    {analysis.flags.map((f, i) => <div key={i} className={`mc-flag ${f.type}`}>{f.type === 'conflict' ? '⚠ ' : '• '}{f.message}</div>)}
                </div>
            )}

            <div className="mc-photos">
                <Photo src={lost.image_url} caption="LOST report photo" />
                <Photo src={found.image_url} caption="FOUND item photo" />
            </div>

            <div className="mc-table-wrap">
                <table className="mc-table">
                    <thead><tr><th>Field</th><th>Lost report</th><th>Found item</th><th>Result</th><th>Points</th></tr></thead>
                    <tbody>
                        {Object.values(analysis.fields).map((f) => (
                            <tr key={f.key}>
                                <td className="k">{f.label}</td>
                                <td className="val">{f.lost || <span className="none">—</span>}</td>
                                <td className="val">{f.found || <span className="none">—</span>}</td>
                                <td>
                                    <span className={`mc-chip ${f.status}`}>{STATUS_MARK[f.status]} {STATUS_WORD[f.status]}</span>
                                    {f.note && <span className="note">{f.note}</span>}
                                </td>
                                <td className="mc-pts">{f.status === 'unknown' ? '—' : `${f.points} / ${f.weight}`}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="mc-math">
                How this was scored: {analysis.raw}% agreement on the fields both reports filled in × {Math.round(analysis.confidence * 100)}% confidence
                (more shared fields = more confidence){analysis.cap ? `, capped at ${analysis.cap} because ${analysis.cap_reason.charAt(0).toLowerCase()}${analysis.cap_reason.slice(1)}` : ''}.
                {' '}Scored just now{detail.rescored ? ` — it was ${detail.previous_score} before this check.` : '.'}
            </p>

            <div className="mc-facts">
                <div className="mc-fact">
                    <h4>LOST REPORT</h4>
                    Reported by <b>{lost.user?.name || 'Unknown'}</b>{lost.contact_info ? <> · contact: {lost.contact_info}</> : null}<br />
                    {lost.time_lost ? <>Time lost: {lost.time_lost}<br /></> : null}
                    Status: {String(lost.status || '').replace(/_/g, ' ')}
                </div>
                <div className="mc-fact">
                    <h4>FOUND ITEM</h4>
                    {found.finder?.name ? <>Turned in by <b>{found.finder.name}</b><br /></> : null}
                    {storage ? <>Stored at: {storage}<br /></> : null}
                    Status: {String(found.status || '').replace(/_/g, ' ')}
                </div>
            </div>
        </div>
    );
}

export default function SecurityMatches() {
    const toast = useToast();
    const [tab, setTab] = useState('pending');
    const [query, setQuery] = useState('');
    const [level, setLevel] = useState('');
    const [minScore, setMinScore] = useState('');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [live, setLive] = useState({ ok: true, at: null });
    const [busyId, setBusyId] = useState(null);
    const [openId, setOpenId] = useState(null);
    const [detail, setDetail] = useState({ id: null, data: null, loading: false, error: '' });
    const [flash, setFlash] = useState({});
    const prevScores = useRef({});

    useEffect(() => { document.title = 'Matches | SCLF - Opol Community College'; }, []);

    const load = useCallback((background = false) => {
        if (!background) { setLoading(true); setError(''); }
        return axios.get('/matches', { params: { status: tab, q: query || undefined, level: level || undefined, min_score: minScore || undefined, page }, silent: background })
            .then((res) => {
                const data = res.data.data || [];
                // Highlight rows whose score moved since the last poll.
                const changed = {};
                data.forEach((m) => { const p = prevScores.current[m.id]; if (p !== undefined && p !== m.score) changed[m.id] = m.score - p; prevScores.current[m.id] = m.score; });
                if (Object.keys(changed).length) { setFlash(changed); setTimeout(() => setFlash({}), 4000); }
                setRows(data);
                setMeta({ current_page: res.data.current_page, last_page: res.data.last_page, total: res.data.total });
                setLive({ ok: true, at: new Date() });
                setError('');
            })
            .catch(() => { if (background) setLive((l) => ({ ...l, ok: false })); else setError('Could not load matches right now.'); })
            .finally(() => { if (!background) setLoading(false); });
    }, [tab, query, level, minScore, page]);

    useEffect(() => {
        const t = setTimeout(() => load(false), query ? 300 : 0);
        return () => clearTimeout(t);
    }, [load, query]);

    // Real-time without websockets (works on any shared host such as Hostinger):
    // every few seconds we ask a tiny "pulse" endpoint for a version stamp of the matches table and
    // both report tables. Only when the stamp changes do we re-fetch the list (which also re-scores
    // anything whose reports were edited) and the open comparison. Paused while the tab is hidden.
    const openRef = useRef(null);
    openRef.current = openId;
    const stamp = useRef(null);

    const refreshLive = useCallback(() => {
        load(true);
        if (openRef.current) loadDetail(openRef.current, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]);

    useEffect(() => {
        let stopped = false;
        const tick = async () => {
            if (document.hidden || stopped) return;
            try {
                const { data } = await axios.get('/matches/pulse', { silent: true });
                if (stamp.current !== null && stamp.current !== data.v) refreshLive();
                stamp.current = data.v;
                setLive((l) => ({ ok: true, at: new Date() }));
            } catch {
                setLive((l) => ({ ...l, ok: false }));
            }
        };
        tick();
        const id = setInterval(tick, PULSE_MS);
        document.addEventListener('visibilitychange', tick);
        return () => { stopped = true; clearInterval(id); document.removeEventListener('visibilitychange', tick); };
    }, [refreshLive]);

    const loadDetail = (id, background = false) => {
        if (!background) setDetail({ id, data: null, loading: true, error: '' });
        return axios.get(`/matches/${id}`, { silent: background })
            .then((res) => { setDetail({ id, data: res.data, loading: false, error: '' }); })
            .catch(() => { if (!background) setDetail({ id, data: null, loading: false, error: 'Could not load the comparison.' }); });
    };

    const toggle = (m) => {
        if (openId === m.id) { setOpenId(null); return; }
        setOpenId(m.id);
        loadDetail(m.id);
    };

    const resetTo = (fn) => (v) => { fn(v); setPage(1); };

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
            load(false);
        } catch (err) {
            // Staff writes that need admin approval are handled by the axios interceptor.
            if (err?.response?.data?.code !== 'approval_required') {
                toast.error(err?.response?.data?.message || 'Could not update this match.', { title: 'Could not update' });
            }
        } finally {
            setBusyId(null);
        }
    };

    return (
        <DashboardShell onRefresh={() => load(false)} refreshing={loading}
            eyebrow="Lost & Found"
            title="Matches"
            subtitle="Live-scored pairings between lost reports and found items. Open “Compare details” to see every field side by side before you notify the owner — ownership is still verified through the claim."
        >
            <WorkflowGuide lane="online" defaultOpen={false} />

            <div className="ds-card mc">
                <div className="mc-toolbar">
                    {TABS.map((t) => (
                        <button key={t.key} type="button" className={`ds-btn ${tab === t.key ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                            onClick={() => { setTab(t.key); setPage(1); setOpenId(null); }} aria-pressed={tab === t.key}>
                            {t.label}
                        </button>
                    ))}
                    <span style={{ marginLeft: 'auto' }} className={`mc-live${live.ok ? '' : ' is-err'}`} title="Checks for changes every few seconds and updates the list when something moves">
                        {live.ok ? `Live${live.at ? ` · checked ${clock(live.at)}` : ''}` : 'Reconnecting…'}
                    </span>
                </div>
                <div className="mc-toolbar">
                    <select value={level} onChange={(e) => resetTo(setLevel)(e.target.value)} aria-label="Filter by match level">
                        <option value="">All levels</option>
                        <option value="very_high">Very high (90+)</option>
                        <option value="high">High (75+)</option>
                        <option value="possible">Possible (60+)</option>
                        <option value="low">Low</option>
                    </select>
                    <input type="number" min="0" max="100" placeholder="Min score" value={minScore} style={{ width: 110 }}
                        onChange={(e) => resetTo(setMinScore)(e.target.value)} aria-label="Minimum score" />
                    <input type="search" placeholder="Search name, brand or model…" value={query} style={{ marginLeft: 'auto', minWidth: 220 }}
                        onChange={(e) => { setQuery(e.target.value); setPage(1); }} aria-label="Search matches" />
                </div>

                {error && <div className="ds-error">{error}</div>}
                {loading && (<><div className="ds-skeleton" /><div className="ds-skeleton" /></>)}

                {!loading && !error && rows.length === 0 && (
                    <div className="ds-empty">{query || level || minScore ? 'No matches fit those filters.' : EMPTY_TEXT[tab]}</div>
                )}

                {!loading && rows.length > 0 && (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {rows.map((m) => {
                            const isOpen = openId === m.id;
                            const actionable = m.status === 'pending' || m.status === 'notified';
                            const delta = flash[m.id];
                            const chips = chipsFor(m);
                            const flags = (m.score_details?.flags || []).filter((f) => f.type === 'conflict');
                            const lost = m.lost_item || {};
                            const found = m.found_item || {};
                            const spec = (i) => [i.brand, i.model, i.color].filter(Boolean).join(' · ');

                            return (
                                <article key={m.id} className={`mc-card${delta ? ' is-flash' : ''}`} data-level={m.match_level}>
                                    <div className="mc-top">
                                        <div className="mc-side">
                                            <small>LOST</small>
                                            <b>{lost.item_name || 'Lost item'}</b>
                                            <span>{[lost.category, spec(lost)].filter(Boolean).join(' — ') || 'No details'}</span><br />
                                            <span>{[lost.user?.name && `Reported by ${lost.user.name}`, lost.location_lost && `near ${lost.location_lost}`].filter(Boolean).join(' · ')}</span>
                                        </div>
                                        <div className="mc-side">
                                            <small>FOUND</small>
                                            <b>{found.item_name || 'Found item'}</b>
                                            <span>{[found.category, spec(found)].filter(Boolean).join(' — ') || 'No details'}</span><br />
                                            <span>{[found.location_found && `found near ${found.location_found}`, found.status && String(found.status).replace(/_/g, ' ')].filter(Boolean).join(' · ')}</span>
                                        </div>
                                        <div className="mc-score">
                                            <span className={LEVEL_BADGE[m.match_level] || 'ds-badge ds-badge-default'}>{LEVEL_LABEL[m.match_level] || 'Low'}</span>
                                            <div><strong>{m.score}</strong><small>/100</small></div>
                                            {delta ? <div className={`mc-delta ${delta > 0 ? 'up' : 'down'}`}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)} just now</div> : null}
                                            <div className="mc-meter"><i style={{ width: `${m.score}%` }} /></div>
                                        </div>
                                    </div>

                                    {chips.length > 0 && (
                                        <div className="mc-chips">
                                            {chips.map((c) => <span key={c.key} className={`mc-chip ${c.status}`} title={c.title}>{STATUS_MARK[c.status]} {c.label}</span>)}
                                        </div>
                                    )}
                                    {flags.length > 0 && <div className="mc-flags">{flags.slice(0, 2).map((f, i) => <div key={i} className="mc-flag conflict">⚠ {f.message}</div>)}</div>}

                                    <div className="mc-actions">
                                        <button type="button" className="ds-btn ds-btn-secondary" onClick={() => toggle(m)} aria-expanded={isOpen}>
                                            {isOpen ? 'Hide details' : 'Compare details'}
                                        </button>
                                        <Link to={`/app/found-items/${m.found_item_id}`} className="ds-btn ds-btn-secondary">View found item</Link>
                                        {actionable && (
                                            <>
                                                <button type="button" className="ds-btn ds-btn-primary" disabled={busyId === m.id} onClick={() => act(m, 'notify')}>
                                                    {m.status === 'notified' ? 'Remind owner' : 'Notify owner'}
                                                </button>
                                                <button type="button" className="ds-btn ds-btn-danger" disabled={busyId === m.id} onClick={() => act(m, 'dismiss')}>Not a match</button>
                                            </>
                                        )}
                                    </div>

                                    {isOpen && <Detail detail={detail.id === m.id ? detail.data : null} loading={detail.loading} error={detail.id === m.id ? detail.error : ''} />}
                                </article>
                            );
                        })}
                    </div>
                )}

                {meta.last_page > 1 && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
                        <button type="button" className="ds-btn ds-btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
                        <span className="ds-list-item-meta">Page {meta.current_page} of {meta.last_page} · {meta.total} matches</span>
                        <button type="button" className="ds-btn ds-btn-secondary" disabled={page >= meta.last_page || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
