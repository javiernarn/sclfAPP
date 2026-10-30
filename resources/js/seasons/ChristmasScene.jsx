import React, { useMemo } from 'react';
import { XM } from './art';
import SantaSleigh from './SantaSleigh';
import { ChristmasTown, Garland } from './ChristmasTown';

/**
 * ChristmasScene — SECOND theme.
 * Snowfall (dots + real snowflakes), northern lights, a shooting star, a string-
 * light garland with hanging ornaments, a snowy village (houses, church, pines,
 * lamp posts), Santa's sleigh flying over it and dropping gifts, a decorated
 * tree, snowman, elf, Mrs. Claus, gifts and a reindeer.
 *
 * The tree, snowman, gifts, bells, stars and snowflakes are real,
 * professionally designed artwork (Google Noto Emoji, Apache 2.0 — see
 * ./art/ART_CREDITS.md), not hand-drawn shapes. Motion, glow and layout are
 * CSS. Styles live in seasons.css (.xm-*).
 */

const mulberry = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const Img = ({ src, className = '', style }) => (
    <img src={src} className={className} style={style} alt="" draggable="false" decoding="async" loading="eager" />
);

// an ornament hanging from the top edge on a thread
function Hanging({ className, src }) {
    return (
        <div className={`xm-bauble ${className}`}>
            <span className="xm-bauble-string" />
            <Img src={src} className="xm-bauble-img" />
        </div>
    );
}

// falling snow: mostly soft dots, a few real snowflakes
const FLAKES = Array.from({ length: 46 }, (_, i) => {
    const r = mulberry(i * 53 + 7);
    return { x: r() * 100, s: 3 + r() * 7, d: 8 + r() * 12, delay: -r() * 20, sway: 10 + r() * 40, o: 0.45 + r() * 0.5, real: i % 6 === 0 };
});

// a few big, soft snowflakes close to the viewer for depth
const NEAR = Array.from({ length: 7 }, (_, i) => {
    const r = mulberry(i * 91 + 3);
    return { x: 4 + r() * 92, s: 30 + r() * 26, d: 11 + r() * 7, delay: -r() * 18, sway: 30 + r() * 50, o: 0.5 + r() * 0.3 };
});

export default function ChristmasScene({ variant = 'auth', isDark = true }) {
    const stars = useMemo(() => {
        const r = mulberry(5);
        return Array.from({ length: 36 }, () =>
            `${(r() * 100).toFixed(1)}vw ${(r() * 55).toFixed(1)}vh 0 ${r() > 0.8 ? 1 : 0}px rgba(255,255,255,${(0.4 + r() * 0.5).toFixed(2)})`).join(',');
    }, []);
    const flakes = variant === 'dashboard' ? FLAKES.slice(0, 22) : FLAKES;
    return (
        <div className={`xm-scene xm-${variant} ${isDark ? 'is-dark' : 'is-light'}`} aria-hidden="true">
            <div className="xm-sky" />
            {isDark && <div className="xm-stars" style={{ boxShadow: stars }} />}
            <div className="xm-moon" />
            {isDark && <div className="xm-aurora"><i /><i /><i /></div>}
            {isDark && <span className="xm-shoot" />}

            {isDark && <SantaSleigh />}
            <Garland />

            <Hanging className="xm-bauble-1" src={XM.bell} />
            <Hanging className="xm-bauble-2" src={XM.star} />
            <Hanging className="xm-bauble-3" src={XM.snowflake} />
            <Hanging className="xm-bauble-4" src={XM.bell} />
            <Hanging className="xm-bauble-5" src={XM.stocking} />
            <Hanging className="xm-bauble-6" src={XM.candy} />

            {flakes.map((f, i) => (f.real ? (
                <Img key={i} src={XM.snowflake} className="xm-flake xm-flake-img"
                    style={{ left: `${f.x}%`, width: f.s * 3.2, opacity: f.o, '--d': `${f.d}s`, '--sway': `${f.sway}px`, animationDelay: `${f.delay}s` }} />
            ) : (
                <span key={i} className="xm-flake"
                    style={{ left: `${f.x}%`, width: f.s, height: f.s, opacity: f.o, '--d': `${f.d}s`, '--sway': `${f.sway}px`, animationDelay: `${f.delay}s` }} />
            )))}

            {NEAR.map((f, i) => (
                <Img key={`n${i}`} src={XM.snowflake} className="xm-flake xm-flake-near"
                    style={{ left: `${f.x}%`, width: f.s, opacity: f.o, '--d': `${f.d}s`, '--sway': `${f.sway}px`, animationDelay: `${f.delay}s` }} />
            ))}

            <svg className="xm-hills xm-hills-b" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" focusable="false">
                <path className="xm-hill-b" d="M0 120 C180 80 360 125 560 100 C780 74 980 120 1200 92 L1200 200 L0 200Z" />
            </svg>
            <ChristmasTown />
            <svg className="xm-hills xm-hills-f" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" focusable="false">
                <path className="xm-hill-f" d="M0 160 C220 130 420 168 640 148 C860 128 1040 166 1200 142 L1200 200 L0 200Z" />
            </svg>

            <Img src={XM.reindeer} className="xm-deer" />
            <Img src={XM.tree} className="xm-tree xm-t-1" />
            <Img src={XM.tree} className="xm-tree xm-t-2" />
            <Img src={XM.snowman} className="xm-snowman xm-sm" />
            <Img src={XM.gift} className="xm-gift xm-g-1" />
            <Img src={XM.gift} className="xm-gift xm-g-2" />
            <Img src={XM.gift} className="xm-gift xm-g-3" />
            <Img src={XM.elf} className="xm-folk xm-elf" />
            <Img src={XM.mrsClaus} className="xm-folk xm-mrs" />
            <Img src={XM.sparkle} className="xm-spark xm-sp-1" />
            <Img src={XM.sparkle} className="xm-spark xm-sp-2" />
        </div>
    );
}
