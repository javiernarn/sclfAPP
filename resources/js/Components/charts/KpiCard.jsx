import React from 'react';
import AnimatedNumber from './AnimatedNumber';
import Sparkline from './Sparkline';
import { fmt } from './utils';

// Stat card: icon, animated number, period-over-period delta, sparkline.
// `goodWhen="down"` flips the delta colouring for metrics where less is better.
export default function KpiCard({ icon: Icon, label, value, decimals = 0, suffix = '', prev, series, color = 'var(--ch-1)', goodWhen = 'up', hint }) {
    let delta = null;
    if (prev !== undefined && prev !== null) {
        delta = prev === 0 ? (value > 0 ? 100 : 0) : ((value - prev) / prev) * 100;
    }
    const up = delta > 0;
    const flat = delta === 0 || delta === null;
    const good = flat ? null : (goodWhen === 'up' ? up : !up);

    return (
        <div className="ds-stat-card ch-kpi">
            <div className="ch-kpi-top">
                {Icon && <div className="ds-stat-icon" style={{ marginBottom: 0 }}><Icon size={20} strokeWidth={2} /></div>}
                {delta !== null && (
                    <span className={`ch-delta ${flat ? 'is-flat' : good ? 'is-good' : 'is-bad'}`} title="vs previous period">
                        {!flat && (
                            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
                                <path d="M5 1.5 9 7H1z" fill="currentColor" />
                            </svg>
                        )}
                        {flat ? '0%' : `${fmt(Math.abs(delta), 0)}%`}
                    </span>
                )}
            </div>
            <div className="ds-stat-value ch-kpi-value"><AnimatedNumber value={value} decimals={decimals} suffix={suffix} /></div>
            <div className="ds-stat-label">{label}</div>
            {hint && <div className="ch-kpi-hint">{hint}</div>}
            {series && <Sparkline values={series} color={color} />}
        </div>
    );
}
