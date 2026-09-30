import React, { useEffect, useState } from 'react';
import { timeAgo } from './utils';

// "● Live · updated 4s ago" — flips amber + "Reconnecting…" if a poll fails.
export function LiveBadge({ updatedAt, error }) {
    const [, tick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => tick((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, []);
    return (
        <span className={`ch-live ${error ? 'is-error' : ''}`} role="status">
            <span className="ch-live-dot" />
            {error ? 'Reconnecting…' : 'Live'}
            {updatedAt && !error && <span className="ch-live-time">· {timeAgo(updatedAt)}</span>}
        </span>
    );
}

export function Segmented({ value, options, onChange, label }) {
    return (
        <div className="ch-seg" role="group" aria-label={label}>
            {options.map((o) => (
                <button key={o.value} type="button" className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export default function ChartCard({ title, subtitle, icon: Icon, actions, legend, children, className = '', style }) {
    return (
        <div className={`ds-card ch-card ${className}`} style={style}>
            <div className="ch-card-head">
                <div style={{ minWidth: 0 }}>
                    <div className="ds-card-title ds-card-title-icon">{Icon && <Icon size={17} strokeWidth={2} />} {title}</div>
                    {subtitle && <p className="ds-card-desc" style={{ margin: '2px 0 0' }}>{subtitle}</p>}
                </div>
                {actions && <div className="ch-card-actions">{actions}</div>}
            </div>
            {legend && (
                <div className="ch-legend">
                    {legend.map((l) => (
                        <span key={l.key || l.label}><i style={{ background: l.color }} />{l.label}</span>
                    ))}
                </div>
            )}
            {children}
        </div>
    );
}
