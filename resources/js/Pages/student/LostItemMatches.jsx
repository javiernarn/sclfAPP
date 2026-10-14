import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';

const MARK = { match: '✓', similar: '≈', different: '✕' };
const CHIP = { match: 'ds-badge ds-badge-found', similar: 'ds-badge ds-badge-pending', different: 'ds-badge ds-badge-default' };
const POLL_MS = 20000; // small list for one report — a plain re-fetch is cheap

const levelBadge = (level) => {
    const map = {
        very_high: 'ds-badge ds-badge-found',
        high: 'ds-badge ds-badge-found',
        possible: 'ds-badge ds-badge-pending',
        low: 'ds-badge ds-badge-default',
    };
    return map[level] || 'ds-badge ds-badge-default';
};

export default function LostItemMatches() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { roles } = useAuth();
    // Security / admin / staff open this page from a "new lost report"
    // notification to review candidates — they are not the owner, so no
    // "View & Claim" / "Not mine"; the Matches queue is where they act.
    const isHandler = ['security_officer', 'admin', 'staff'].some((r) => roles?.includes(r));
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dismissingId, setDismissingId] = useState(null);

    useEffect(() => {
        document.title = "Potential Matches | SCLF - Opol Community College";
    }, []);

    const load = (background = false) => {
        if (!background) setLoading(true);
        axios.get(`/lost-items/${id}/matches`, { silent: background })
            .then(res => setMatches(res.data.filter(m => m.status !== 'dismissed')))
            .catch(() => { if (!background) setError('Could not load matches.'); })
            .finally(() => { if (!background) setLoading(false); });
    };

    useEffect(() => { load(); }, [id]);

    // Re-check while the tab is open and visible (scores are re-computed server-side when a report changes).
    useEffect(() => {
        const t = setInterval(() => { if (!document.hidden) load(true); }, POLL_MS);
        const onVisible = () => { if (!document.hidden) load(true); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
    }, [id]);

    const dismiss = async (matchId) => {
        setDismissingId(matchId);
        try {
            await axios.post(`/matches/${matchId}/dismiss`);
            load();
        } catch (err) {
            // The axios interceptor already toasts the specific reason
            // (e.g. 403 "you can only dismiss matches on your own
            // report") — just swallow it here so it doesn't surface as
            // an unhandled promise rejection in the console.
        } finally {
            setDismissingId(null);
        }
    };

    return (
        <DashboardShell
            eyebrow="Lost & Found"
            title="Potential Matches"
            subtitle={isHandler
                ? 'Candidates the matching engine flagged for this lost report. Act on them from the Matches queue.'
                : 'Our matching engine scores candidates live, field by field. Security still verifies ownership before anything is released.'}
        >
            <div className="ds-card">
                {error && <div className="ds-error">{error}</div>}
                {loading && (<><div className="ds-skeleton" /><div className="ds-skeleton" /></>)}

                {!loading && matches.length === 0 && (
                    <div className="ds-empty">
                        {isHandler
                            ? 'No candidates for this report yet. They appear here as soon as a matching found item is stored.'
                            : "No potential matches yet. We'll notify you as soon as one turns up."}
                    </div>
                )}

                {!loading && matches.length > 0 && (
                    <ul className="ds-list">
                        {matches.map(m => (
                            <li key={m.id} className="ds-list-item" style={{ alignItems: 'flex-start' }}>
                                <div>
                                    <p className="ds-list-item-title">{m.found_item?.item_name}</p>
                                    <p className="ds-list-item-meta">
                                        {m.found_item?.category || 'Uncategorized'} · Found near {m.found_item?.location_found || 'campus'}
                                        {' · '}Score {m.score}/100
                                    </p>
                                    {m.public_details?.fields?.some(f => f.status !== 'unknown') && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                            {m.public_details.fields.filter(f => f.status !== 'unknown').map(f => (
                                                <span key={f.key} className={CHIP[f.status]} title={`${f.points}/${f.weight} points`}>{MARK[f.status]} {f.label}</span>
                                            ))}
                                        </div>
                                    )}
                                    {m.public_details?.fields?.some(f => f.status === 'different') && (
                                        <p className="ds-list-item-meta" style={{ marginTop: 6 }}>
                                            Some details don't line up — Security will check them with you before anything is released.
                                        </p>
                                    )}
                                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                        {isHandler ? (
                                            <>
                                                <Link to={`/app/found-items/${m.found_item_id}`} className="ds-btn ds-btn-secondary">
                                                    View found item
                                                </Link>
                                                <Link to="/app/security/matches" className="ds-btn ds-btn-primary">
                                                    Open Matches queue
                                                </Link>
                                            </>
                                        ) : (
                                            <>
                                                <Link to={`/app/found-items/${m.found_item_id}`} className="ds-btn ds-btn-primary">
                                                    View & Claim
                                                </Link>
                                                <button
                                                    className="ds-btn ds-btn-secondary"
                                                    onClick={() => dismiss(m.id)}
                                                    disabled={dismissingId === m.id}
                                                >
                                                    {dismissingId === m.id ? 'Dismissing…' : 'Not mine'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <span className={levelBadge(m.match_level)}>{m.match_level.replace('_', ' ')}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
