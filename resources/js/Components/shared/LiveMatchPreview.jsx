import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import './LiveMatchPreview.css';

// Real-time match check shown under the report fields.
//
//  • "Report strength" updates instantly (no network): how much of what the
//    matching engine can compare you've filled in, and what to add next.
//  • "Live match check" asks the server, ~0.7s after you stop typing, how the
//    report-so-far scores against every stored report on the other side.
//
// Nothing is saved by this panel.

// Mirrors ItemMatchingService::WEIGHTS — used only to rank the "add this next" tips.
const SIGNALS = [
    { key: 'item_name', label: 'Item name', weight: 16, filled: (f) => !!f.item_name?.trim() },
    { key: 'brand', label: 'Brand', weight: 13, filled: (f) => !!f.brand?.trim(), needs: 'brand' },
    { key: 'model', label: 'Model', weight: 13, filled: (f) => !!f.model?.trim(), needs: 'model' },
    { key: 'category', label: 'Category', weight: 10, filled: (f) => !!f.category?.trim() },
    { key: 'color', label: 'Color', weight: 10, filled: (f) => !!f.color?.trim() },
    { key: 'unique', label: 'Unique marks', weight: 10, filled: (f) => !!f.unique_characteristics?.trim() },
    { key: 'description', label: 'Description (a full sentence)', weight: 8, filled: (f) => (f.description || '').trim().split(/\s+/).filter(Boolean).length >= 5 },
    { key: 'details', label: 'Specs & extras (storage, size…)', weight: 8, filled: (f) => Object.values(f.details || {}).some(Boolean), needs: 'details' },
    { key: 'place', label: 'Place', weight: 6, filled: (f, place) => !!f[place]?.trim() },
    { key: 'date', label: 'Date', weight: 6, filled: (f, place, date) => !!f[date] },
];

const LEVEL_TEXT = { very_high: 'Very high', high: 'High', possible: 'Possible', low: 'Low' };
const STATUS_ICON = { match: '✓', similar: '≈', different: '✕', unknown: '–' };

export default function LiveMatchPreview({ kind, form, showBrand, showModel, hasDetails }) {
    const isFound = kind === 'found';
    const place = isFound ? 'location_found' : 'location_lost';
    const date = isFound ? 'date_found' : 'date_lost';

    // -- instant: report strength -----------------------------------------
    const strength = useMemo(() => {
        const applicable = SIGNALS.filter((s) => (s.needs === 'brand' ? showBrand : s.needs === 'model' ? showModel : s.needs === 'details' ? hasDetails : true));
        const total = applicable.reduce((a, s) => a + s.weight, 0);
        const have = applicable.filter((s) => s.filled(form, place, date));
        const pct = total ? Math.round((have.reduce((a, s) => a + s.weight, 0) / total) * 100) : 0;
        const missing = applicable.filter((s) => !s.filled(form, place, date)).sort((a, b) => b.weight - a.weight).slice(0, 3);
        return { pct, missing };
    }, [form, place, date, showBrand, showModel, hasDetails]);

    // -- debounced: server score ------------------------------------------
    const [state, setState] = useState({ loading: false, error: false, data: null, at: null });
    const seq = useRef(0);

    const payload = useMemo(() => {
        const details = Object.fromEntries(Object.entries(form.details || {}).filter(([, v]) => v));
        const p = {
            kind,
            item_name: form.item_name, category: form.category, brand: form.brand, model: form.model, color: form.color,
            description: form.description, unique_characteristics: form.unique_characteristics,
            [place]: form[place], [date]: form[date],
        };
        if (Object.keys(details).length) p.details = details;
        return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null));
    }, [kind, form, place, date]);
    const key = JSON.stringify(payload);

    useEffect(() => {
        if (!payload.item_name && !payload.category) { setState({ loading: false, error: false, data: null, at: null }); return undefined; }
        const my = ++seq.current;
        setState((s) => ({ ...s, loading: true }));
        const t = setTimeout(() => {
            axios.post('/matches/preview', payload, { silent: true })
                .then((res) => { if (my === seq.current) setState({ loading: false, error: false, data: res.data, at: new Date() }); })
                .catch(() => { if (my === seq.current) setState((s) => ({ ...s, loading: false, error: true })); });
        }, 700);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const { data, loading, error } = state;
    const best = data?.best ?? 0;
    const level = data?.level || 'low';

    return (
        <section className="lmp" aria-live="polite" aria-label="Live match check">
            <header className="lmp-head">
                <div>
                    <h3 className="lmp-title">Live match check</h3>
                    <p className="lmp-sub">
                        {isFound
                            ? 'Scores what you\'ve typed against open lost reports as you type. Nothing is saved until you submit.'
                            : 'Scores what you\'ve typed against items already turned in, as you type. Nothing is saved until you submit.'}
                    </p>
                </div>
                <span className={`lmp-pulse${loading ? ' is-busy' : ''}${error ? ' is-err' : ''}`}>
                    {error ? 'Offline' : loading ? 'Checking…' : data?.ready === false ? 'Waiting' : 'Live'}
                </span>
            </header>

            <div className="lmp-grid">
                <div className="lmp-gauge" data-level={data?.ready === false || !data ? 'none' : level}>
                    <svg viewBox="0 0 120 120" width="108" height="108" aria-hidden="true">
                        <circle cx="60" cy="60" r="50" className="lmp-ring-bg" />
                        <circle cx="60" cy="60" r="50" className="lmp-ring" strokeDasharray={`${(best / 100) * 314} 314`} transform="rotate(-90 60 60)" />
                    </svg>
                    <div className="lmp-gauge-num">
                        <strong>{data && data.ready !== false ? best : '—'}</strong>
                        <span>{data && data.ready !== false ? (data.count ? LEVEL_TEXT[level] : 'No match') : 'best score'}</span>
                    </div>
                </div>

                <div className="lmp-strength">
                    <div className="lmp-bar-label"><span>Report strength</span><b>{strength.pct}%</b></div>
                    <div className="lmp-bar"><i style={{ width: `${strength.pct}%` }} data-tier={strength.pct >= 75 ? 'hi' : strength.pct >= 45 ? 'mid' : 'lo'} /></div>
                    {strength.missing.length > 0 ? (
                        <p className="lmp-tip">More accurate matching if you add: {strength.missing.map((m, i) => (
                            <span key={m.key} className="lmp-tip-chip">{m.label}{i < strength.missing.length - 1 ? '' : ''}</span>
                        ))}</p>
                    ) : (
                        <p className="lmp-tip lmp-tip-ok">Every detail the matcher compares is filled in. Nice.</p>
                    )}
                </div>
            </div>

            {data?.ready === false && <p className="lmp-empty">Pick a category and an item name to start the live check.</p>}
            {data?.ready !== false && data && data.count === 0 && !loading && (
                <p className="lmp-empty">
                    {isFound
                        ? 'No open lost report fits this yet. If an owner reports it later, Security will see the match automatically.'
                        : 'Nothing handed in so far looks like this. Submit anyway — we re-check every time a new item is turned in and will notify you.'}
                </p>
            )}

            {data?.candidates?.length > 0 && (
                <ul className="lmp-list">
                    {data.candidates.slice(0, 3).map((c) => (
                        <li key={c.id} className="lmp-cand" data-level={c.level}>
                            <div className="lmp-cand-top">
                                <div className="lmp-cand-main">
                                    <b>{c.item_name}</b>
                                    <span>{[c.category, c.place, c.date].filter(Boolean).join(' · ')}</span>
                                </div>
                                <span className="lmp-score">{c.score}<small>/100</small></span>
                            </div>
                            <div className="lmp-fields">
                                {c.fields.filter((f) => f.status !== 'unknown').map((f) => (
                                    <span key={f.key} className={`lmp-f lmp-f-${f.status}`} title={`${f.label}: ${f.points}/${f.weight}`}>
                                        {STATUS_ICON[f.status]} {f.label}
                                    </span>
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
