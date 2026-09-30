import React, { useCallback, useRef, useState } from 'react';
import { useTween } from './useTween';
import { PALETTE, fmt, humanize } from './utils';
import useDismiss from './useDismiss';

/** Ranked horizontal bars (top categories / locations). */
export default function RankedBars({ items = [], color = 0, empty = 'No data yet' }) {
    const ref = useRef(null);
    const [open, setOpen] = useState(null);
    const clear = useCallback(() => setOpen(null), []);
    useDismiss(ref, open !== null, clear);
    const target = items.map((i) => Number(i.value) || 0);
    const vals = useTween(target, 850);
    const max = Math.max(1, ...target);
    if (!items.length) return <p className="ch-empty">{empty}</p>;
    return (
        <ul className="ch-ranked" ref={ref}>
            {items.map((it, i) => (
                <li key={it.label} className={open === i ? 'is-open' : ''} onClick={() => setOpen((o) => (o === i ? null : i))}>
                    <div className="ch-ranked-row"><span title={it.label}>{humanize(it.label)}</span><b>{fmt(it.value)}</b></div>
                    <div className="ch-ranked-track">
                        <div className="ch-ranked-fill" style={{ width: `${(vals[i] / max) * 100}%`, background: PALETTE[(color + i) % PALETTE.length] }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}
