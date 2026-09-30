import React, { useCallback, useRef, useState } from 'react';
import { useTween } from './useTween';
import { PALETTE, fmt } from './utils';
import useDismiss, { isTouch } from './useDismiss';

/** Animated donut with centre total, hover highlight and a value/percent legend. */
export default function DonutChart({ data = [], size = 168, thickness = 20, centerLabel = 'Total' }) {
    const [active, setActive] = useState(null);
    const wrapRef = useRef(null);
    const clear = useCallback(() => setActive(null), []);
    useDismiss(wrapRef, active !== null, clear);
    const leave = (e) => { if (!isTouch(e)) setActive(null); };
    const toggle = (i) => setActive((a) => (a === i ? null : i));
    const items = data.filter((d) => d.value > 0 || data.length <= 6);
    const target = items.map((d) => Number(d.value) || 0);
    const vals = useTween(target, 900);
    const realTotal = target.reduce((a, b) => a + b, 0);
    const shown = vals.reduce((a, b) => a + b, 0);

    const r = (size - thickness) / 2;
    const C = 2 * Math.PI * r;
    const gap = realTotal > 0 && items.filter((d) => d.value > 0).length > 1 ? 2.5 : 0;
    let acc = 0;

    const centreValue = active !== null ? target[active] : realTotal;
    const centreText = active !== null
        ? `${items[active].label}${realTotal ? ` · ${Math.round((target[active] / realTotal) * 100)}%` : ''}`
        : centerLabel;

    return (
        <div className="ch-donut" ref={wrapRef}>
            <div className="ch-donut-ring" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution">
                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="ch-donut-track" strokeWidth={thickness} />
                    <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                        {shown > 0 && items.map((d, i) => {
                            const len = realTotal > 0 ? (vals[i] / realTotal) * C : 0;
                            const seg = Math.max(0, len - gap);
                            const offset = -acc;
                            acc += len;
                            return (
                                <circle key={d.key || d.label} cx={size / 2} cy={size / 2} r={r} fill="none"
                                    strokeWidth={active === i ? thickness + 4 : thickness}
                                    strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={offset}
                                    style={{ stroke: d.color || PALETTE[i % PALETTE.length], opacity: active === null || active === i ? 1 : 0.35, transition: 'opacity .2s, stroke-width .2s' }}
                                    onPointerEnter={(e) => { if (!isTouch(e)) setActive(i); }} onPointerLeave={leave}
                                    onClick={() => toggle(i)} className="ch-donut-seg" />
                            );
                        })}
                    </g>
                </svg>
                <div className="ch-donut-center">
                    <strong>{fmt(centreValue)}</strong>
                    <span>{centreText}</span>
                </div>
            </div>
            <ul className="ch-donut-legend">
                {items.map((d, i) => (
                    <li key={d.key || d.label} className={active === i ? 'is-active' : ''} onPointerEnter={(e) => { if (!isTouch(e)) setActive(i); }} onPointerLeave={leave} onClick={() => toggle(i)}>
                        <i style={{ background: d.color || PALETTE[i % PALETTE.length] }} />
                        <span className="ch-l-name">{d.label}</span>
                        <b>{fmt(d.value)}</b>
                        <em>{realTotal ? Math.round((d.value / realTotal) * 100) : 0}%</em>
                    </li>
                ))}
            </ul>
        </div>
    );
}
