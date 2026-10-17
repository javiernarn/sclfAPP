import React, { useState } from 'react';
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

// 2x2 inch ID-style photo for the printed reports. Shows the person's profile
// picture, or a blank box labelled "PHOTO" when there is none (or it fails to load).
// Click it to flip to a blank "PHOTO" side — for people who'd rather glue on a
// physical 2x2 photo. Whichever side is showing is what gets printed.
export function PhotoBox({ src, name }) {
    const [broken, setBroken] = useState(false);
    const [flipped, setFlipped] = useState(false);
    const showImage = !!src && !broken;
    return (
        <div className="pr-photo-wrap">
            <button
                type="button"
                className="pr-photo"
                data-flipped={flipped ? 'true' : 'false'}
                onClick={() => setFlipped((f) => !f)}
                aria-pressed={flipped}
                title={flipped ? 'Click to show the profile photo again' : 'Click to flip to a blank box for a physical 2x2 photo'}
            >
                <span className="pr-photo-inner">
                    <span className="pr-photo-face pr-photo-front">
                        {showImage
                            ? <img src={src} alt={name ? `Photo of ${name}` : 'Profile photo'} onError={() => setBroken(true)} />
                            : <span className="pr-photo-text">PHOTO<span className="pr-photo-size">2x2</span></span>}
                    </span>
                    <span className="pr-photo-face pr-photo-back">
                        <span className="pr-photo-text">PHOTO<span className="pr-photo-size">2x2</span></span>
                    </span>
                </span>
            </button>
            <div className="pr-photo-hint">{flipped ? 'Blank — paste a 2x2 photo. Click to flip back.' : 'Click photo to flip (blank for a physical 2x2).'}</div>
        </div>
    );
}
