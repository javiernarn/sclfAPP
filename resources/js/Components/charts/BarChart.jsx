import React, { useCallback, useState } from 'react';
import { useTween } from './useTween';
import useSize from './useSize';
import { PALETTE, niceMax, fmt } from './utils';
import useDismiss, { isTouch } from './useDismiss';

const PAD = { l: 34, r: 8, t: 10, b: 24 };

/** Grouped vertical bars with grow-in animation, hover tooltip and optional peak highlight. */
export default function BarChart({ data = [], series = [], xKey = 'label', height: baseHeight = 230, highlightMax = false, labelEvery, formatX }) {
    const [ref, width] = useSize();
    const [hover, setHover] = useState(null);
    const clear = useCallback(() => setHover(null), []);
    useDismiss(ref, hover !== null, clear);
    const height = width < 420 ? Math.min(baseHeight, 210) : baseHeight;
    const n = data.length;
    const m = series.length;

    const target = series.flatMap((s) => data.map((d) => Number(d[s.key]) || 0));
    const vals = useTween(target, 850);

    const yMax = niceMax(Math.max(0, ...target));
    const iw = width - PAD.l - PAD.r;
    const ih = height - PAD.t - PAD.b;
    const slot = iw / Math.max(1, n);
    const groupW = Math.min(slot * 0.72, 46 * m);
    const barW = Math.max(2, groupW / m - (m > 1 ? 2 : 0));
    const y = (v) => PAD.t + ih - (v / yMax) * ih;
    const ticks = [0, 0.5, 1].map((f) => Math.round(yMax * f * 100) / 100);
    const every = labelEvery || Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 44))));
    const peak = highlightMax ? target.indexOf(Math.max(...target)) : -1;

    return (
        <div className="ch-wrap" ref={ref}>
            <svg width={width} height={height} onPointerLeave={(e) => { if (!isTouch(e)) setHover(null); }} role="img" aria-label="Bar chart">
                {ticks.map((t) => (
                    <g key={t}>
                        <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} className="ch-grid" />
                        <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="ch-axis">{fmt(t, t % 1 ? 1 : 0)}</text>
                    </g>
                ))}
                {data.map((d, i) => {
                    const cx = PAD.l + slot * i + slot / 2;
                    return (
                        <g key={i} onPointerDown={() => setHover(i)} onPointerMove={() => setHover(i)}>
                            <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={ih} fill="transparent" />
                            {hover === i && <rect x={PAD.l + slot * i + 2} y={PAD.t} width={slot - 4} height={ih} className="ch-hoverband" rx="6" />}
                            {series.map((s, si) => {
                                const v = vals[si * n + i] || 0;
                                const bx = cx - groupW / 2 + si * (groupW / m) + (m > 1 ? 1 : 0);
                                const h = Math.max(0, PAD.t + ih - y(v));
                                const dim = highlightMax && peak !== i;
                                return (
                                    <rect key={s.key} x={bx} y={y(v)} width={barW} height={h} rx={Math.min(5, barW / 2)}
                                        style={{ fill: s.color || PALETTE[si], opacity: dim ? 0.45 : 1 }} />
                                );
                            })}
                            {(i % every === 0) && (
                                <text x={cx} y={height - 6} textAnchor="middle" className="ch-axis">{formatX ? formatX(d[xKey]) : d[xKey]}</text>
                            )}
                        </g>
                    );
                })}
            </svg>
            {hover !== null && data[hover] && (
                <div className="ch-tip" style={{ left: Math.min(Math.max(PAD.l + slot * hover + slot / 2, 60), Math.max(60, width - 60)), top: 4 }}>
                    <b>{formatX ? formatX(data[hover][xKey]) : data[hover][xKey]}</b>
                    {series.map((s, si) => (
                        <div key={s.key}><i style={{ background: s.color || PALETTE[si] }} />{s.label}<span>{fmt(data[hover][s.key])}</span></div>
                    ))}
                </div>
            )}
        </div>
    );
}
