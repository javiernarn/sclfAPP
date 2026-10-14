import React from 'react';
import '../../Pages/shared/PrintReport.css';

// Small building blocks shared by the printable reports (admin/security
// dashboard report and the student dashboard report).

export function deltaText(value, prev, days) {
    const v = Number(value) || 0;
    const p = Number(prev) || 0;
    const diff = v - p;
    if (diff === 0) return `No change vs previous ${days} days`;
    const arrow = diff > 0 ? '▲' : '▼';
    const pc = p > 0 ? ` (${diff > 0 ? '+' : ''}${Math.round((diff / p) * 100)}%)` : '';
    return `${arrow} ${Math.abs(diff)}${pc} vs previous ${days} days`;
}

export function Section({ title, children }) {
    return (
        <section className="pr-section">
            <h2 className="pr-h2">{title}</h2>
            {children}
        </section>
    );
}

export function Card({ title, subtitle, children }) {
    return (
        <div className="pr-card">
            <div className="pr-card-title">{title}</div>
            {subtitle && <div className="pr-card-sub">{subtitle}</div>}
            {children}
        </div>
    );
}

export function Tiles({ items, days }) {
    return (
        <div className="pr-tiles">
            {items.map((t) => (
                <div className="pr-tile" key={t.label}>
                    <div className="pr-tile-label">{t.label}</div>
                    <div className="pr-tile-value">{t.value}</div>
                    {t.prev !== undefined
                        ? <div className="pr-tile-note">{deltaText(t.raw, t.prev, days)}</div>
                        : t.note ? <div className="pr-tile-note">{t.note}</div> : null}
                </div>
            ))}
        </div>
    );
}
