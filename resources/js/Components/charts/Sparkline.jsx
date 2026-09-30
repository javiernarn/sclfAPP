import React, { useCallback, useId, useRef, useState } from 'react';
import { useTween } from './useTween';
import { smoothPath, fmt } from './utils';
import useDismiss, { isTouch } from './useDismiss';

// Tiny trend line for KPI cards. Fills its container's width.
// Touch / hover a point to read that day's value.
export default function Sparkline({ values = [], color = 'var(--ch-1)', height = 38 }) {
    const id = useId().replace(/:/g, '');
    const ref = useRef(null);
    const [hover, setHover] = useState(null);
    const clear = useCallback(() => setHover(null), []);
    useDismiss(ref, hover !== null, clear);
    const vals = useTween(values.length ? values : [0, 0], 900);
    const W = 100;
    const max = Math.max(1, ...values);
    const pts = vals.map((v, i) => [(i / Math.max(1, vals.length - 1)) * W, height - 4 - (v / max) * (height - 10)]);
    const line = smoothPath(pts);

    const onMove = (e) => {
        if (!values.length) return;
        const rect = ref.current.getBoundingClientRect();
        const f = (e.clientX - rect.left) / Math.max(1, rect.width);
        setHover(Math.max(0, Math.min(values.length - 1, Math.round(f * (values.length - 1)))));
    };
    const hp = hover !== null ? pts[hover] : null;

    return (
        <div className="ch-spark-wrap" ref={ref} onPointerDown={onMove} onPointerMove={onMove}
            onPointerLeave={(e) => { if (!isTouch(e)) setHover(null); }}>
            <svg className="ch-spark" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label="Trend">
                <defs>
                    <linearGradient id={`sg${id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }} />
                        <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
                    </linearGradient>
                </defs>
                <path d={`${line} L${W},${height} L0,${height} Z`} fill={`url(#sg${id})`} />
                <path d={line} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            {hp && (
                <>
                    <span className="ch-spark-dot" style={{ left: `${hp[0]}%`, top: hp[1], background: color }} />
                    <span className="ch-tip ch-tip-mini" style={{ left: `${Math.min(Math.max(hp[0], 18), 82)}%`, top: -30 }}>
                        Day {hover + 1}: <strong>{fmt(values[hover])}</strong>
                    </span>
                </>
            )}
        </div>
    );
}
