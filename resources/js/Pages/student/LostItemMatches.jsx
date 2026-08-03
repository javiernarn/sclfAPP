import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';

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
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        document.title = "Potential Matches | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get(`/lost-items/${id}/matches`)
            .then(res => setMatches(res.data.filter(m => m.status !== 'dismissed')))
            .catch(() => setError('Could not load matches.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [id]);

    const dismiss = async (matchId) => {
        await axios.post(`/matches/${matchId}/dismiss`);
        load();
    };

    return (
        <DashboardShell
            eyebrow="Lost & Found"
            title="Potential Matches"
            subtitle="Our matching engine flags candidates by rule-based scoring. Security still verifies ownership before anything is released."
        >
            <div className="ds-card">
                {error && <div className="ds-error">{error}</div>}
                {loading && (<><div className="ds-skeleton" /><div className="ds-skeleton" /></>)}

                {!loading && matches.length === 0 && (
                    <div className="ds-empty">No potential matches yet. We'll notify you as soon as one turns up.</div>
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
                                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                        <Link to={`/found-items/${m.found_item_id}`} className="ds-btn ds-btn-primary">
                                            View & Claim
                                        </Link>
                                        <button className="ds-btn" onClick={() => dismiss(m.id)}>Not mine</button>
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
