import React, { useCallback, useId, useState } from 'react';
import { useTween } from './useTween';
import useSize from './useSize';
import { PALETTE, niceMax, smoothPath, fmt } from './utils';
import useDismiss, { isTouch } from './useDismiss';

const PAD = { l: 34, r: 12, t: 12, b: 24 };

/**
 * Multi-series smooth area/line chart with hover crosshair + tooltip.
 * Values tween on mount and on every data refresh.
 */
export default function AreaChart({ data = [], series = [], xKey = 'label', height: baseHeight = 250, live = true }) {
    const id = useId().replace(/:/g, '');
    const [ref, width] = useSize();
    const [hover, setHover] = useState(null);
    const clear = useCallback(() => setHover(null), []);
    useDismiss(ref, hover !== null, clear);
    const height = width < 420 ? Math.min(baseHeight, 220) : baseHeight;
    const n = data.length;

    const target = series.flatMap((s) => data.map((d) => Number(d[s.key]) || 0));
    const vals = useTween(target, 900);

    const yMax = niceMax(Math.max(0, ...target));
    const iw = width - PAD.l - PAD.r;
    const ih = height - PAD.t - PAD.b;
    const x = (i) => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v) => PAD.t + ih - (v / yMax) * ih;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f * 100) / 100);
    const xEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));

    const onMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const i = Math.round(((px - PAD.l) / Math.max(1, iw)) * (n - 1));
        setHover(Math.max(0, Math.min(n - 1, i)));
    };

    return (
        <div className="ch-wrap" ref={ref}>
            <svg width={width} height={height} onPointerDown={onMove} onPointerMove={onMove} onPointerLeave={(e) => { if (!isTouch(e)) setHover(null); }} role="img" aria-label="Trend chart">
                <defs>
                    {series.map((s, si) => (
                        <linearGradient key={s.key} id={`ag${id}${si}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" style={{ stopColor: s.color || PALETTE[si], stopOpacity: 0.24 }} />
                            <stop offset="100%" style={{ stopColor: s.color || PALETTE[si], stopOpacity: 0 }} />
                        </linearGradient>
                    ))}
                </defs>

                {ticks.map((t) => (
                    <g key={t}>
                        <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} className="ch-grid" />
                        <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="ch-axis">{fmt(t, t % 1 ? 1 : 0)}</text>
                    </g>
                ))}
                {data.map((d, i) => (i % xEvery === 0 || i === n - 1) && (
                    <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="ch-axis">{d[xKey]}</text>
                ))}

                {series.map((s, si) => {
                    const color = s.color || PALETTE[si];
                    const pts = data.map((_, i) => [x(i), y(vals[si * n + i] || 0)]);
                    const line = smoothPath(pts);
                    const last = pts[pts.length - 1];
                    return (
                        <g key={s.key}>
                            {n > 1 && <path d={`${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#ag${id}${si})`} />}
                            <path d={line} fill="none" style={{ stroke: color }} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            {live && last && (
                                <g>
                                    <circle cx={last[0]} cy={last[1]} r="4" style={{ fill: color }} />
                                    <circle cx={last[0]} cy={last[1]} r="4" className="ch-pulse" style={{ fill: color }} />
                                </g>
                            )}
                        </g>
                    );
                })}

                {hover !== null && (
                    <g pointerEvents="none">
                        <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} className="ch-cross" />
                        {series.map((s, si) => (
                            <circle key={s.key} cx={x(hover)} cy={y(vals[si * n + hover] || 0)} r="4.5" className="ch-dot" style={{ stroke: s.color || PALETTE[si] }} />
                        ))}
                    </g>
                )}
            </svg>

            {hover !== null && data[hover] && (
                <div className="ch-tip" style={{ left: Math.min(Math.max(x(hover), 80), Math.max(80, width - 80)), top: 6 }}>
                    <b>{data[hover][xKey]}</b>
                    {series.map((s, si) => (
                        <div key={s.key}><i style={{ background: s.color || PALETTE[si] }} />{s.label}<span>{fmt(data[hover][s.key])}</span></div>
                    ))}
                </div>
            )}
        </div>
    );
}
