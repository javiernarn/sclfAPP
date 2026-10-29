import React, { useMemo } from 'react';
import { NY } from './art';

/**
 * NewYearScene — THIRD theme.
 * A midnight city: fireworks bursting over the skyline, falling confetti,
 * disco balls swinging from the top, balloons drifting up, a clock at twelve,
 * champagne, glasses and party poppers.
 *
 * The clock, champagne, glasses, poppers, balloons, disco balls, stars and
 * sparkles are real, professionally designed artwork (Google Noto Emoji,
 * Apache 2.0 — see ./art/ART_CREDITS.md). Fireworks and confetti are plain
 * CSS particles (like snow), and only the skyline silhouette is drawn in code.
 * Styles live in seasons.css (.ny-*).
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

// ---- fireworks -------------------------------------------------------------
const BURSTS = [
    { x: 20, y: 22, c: '#fbbf24', c2: '#fde68a', s: 1.0, dur: 4.4, delay: -0.6 },
    { x: 80, y: 16, c: '#f472b6', c2: '#fbcfe8', s: 1.1, dur: 5.0, delay: -2.4 },
    { x: 52, y: 30, c: '#38bdf8', c2: '#bae6fd', s: 0.9, dur: 4.8, delay: -3.6 },
    { x: 36, y: 9, c: '#a78bfa', c2: '#ddd6fe', s: 0.8, dur: 5.4, delay: -1.5 },
    { x: 92, y: 38, c: '#34d399', c2: '#a7f3d0', s: 0.85, dur: 4.2, delay: -4.1 },
    { x: 9, y: 40, c: '#fb7185', c2: '#fecdd3', s: 0.8, dur: 5.2, delay: -2.9 },
];
const SPOKES = 18;
function Burst({ cfg }) {
    return (
        <div className="ny-burst" style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, '--c': cfg.c, '--c2': cfg.c2, '--s': cfg.s, '--dur': `${cfg.dur}s`, '--delay': `${cfg.delay}s` }}>
            <b className="ny-flash" />
            {Array.from({ length: SPOKES }, (_, i) => (
                <i key={i} className={i % 2 ? 'in' : 'out'} style={{ '--a': `${(i * 360) / SPOKES}deg` }} />
            ))}
        </div>
    );
}

// ---- confetti --------------------------------------------------------------
const CONFETTI_COLORS = ['#fbbf24', '#f472b6', '#38bdf8', '#a78bfa', '#34d399', '#fb7185', '#fde68a'];
const CONFETTI = Array.from({ length: 44 }, (_, i) => {
    const r = mulberry(i * 41 + 3);
    return { x: r() * 100, w: 5 + r() * 5, h: 8 + r() * 7, c: CONFETTI_COLORS[i % CONFETTI_COLORS.length], d: 8 + r() * 9, delay: -r() * 18, sway: 14 + r() * 50, o: 0.7 + r() * 0.3 };
});

// ---- skyline silhouette (flat shapes + a few lit windows) -------------------
const CITY = (() => {
    const r = mulberry(77);
    const back = []; const front = []; const wins = [];
    let x = -10;
    while (x < 1210) { const w = 26 + r() * 44; back.push({ x, w, h: 56 + r() * 96 }); x += w * 0.82; }
    x = -10;
    while (x < 1210) {
        const w = 24 + r() * 40; const h = 30 + r() * 78;
        front.push({ x, w, h });
        for (let wx = x + 5; wx < x + w - 7; wx += 10) {
            for (let wy = 200 - h + 8; wy < 192; wy += 13) {
                if (r() < 0.3) wins.push({ x: wx, y: wy, d: (r() * 6).toFixed(2) });
            }
        }
        x += w + r() * 5;
    }
    return { back, front, wins };
})();

function City() {
    return (
        <svg className="ny-city" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" focusable="false">
            <g className="ny-city-back">{CITY.back.map((b, i) => <rect key={i} x={b.x} y={200 - b.h} width={b.w} height={b.h} />)}</g>
            <g className="ny-city-front">{CITY.front.map((b, i) => <rect key={i} x={b.x} y={200 - b.h} width={b.w} height={b.h} />)}</g>
            <g className="ny-wins">{CITY.wins.map((w, i) => <rect key={i} x={w.x} y={w.y} width="4" height="6" style={{ animationDelay: `${w.d}s` }} />)}</g>
        </svg>
    );
}

// a disco ball swinging from a thread at the top edge
function Hanging({ className, src }) {
    return (
        <div className={`ny-hang ${className}`}>
            <span className="ny-hang-string" />
            <Img src={src} className="ny-hang-img" />
        </div>
    );
}

export default function NewYearScene({ variant = 'auth', isDark = true }) {
    const stars = useMemo(() => {
        const r = mulberry(19);
        return Array.from({ length: 44 }, () =>
            `${(r() * 100).toFixed(1)}vw ${(r() * 60).toFixed(1)}vh 0 ${r() > 0.8 ? 1 : 0}px rgba(255,244,214,${(0.4 + r() * 0.55).toFixed(2)})`).join(',');
    }, []);
    const bursts = variant === 'dashboard' ? BURSTS.slice(0, 3) : variant === 'loading' ? BURSTS : BURSTS.slice(0, 5);
    const confetti = variant === 'dashboard' ? CONFETTI.slice(0, 20) : CONFETTI;

    return (
        <div className={`ny-scene ny-${variant} ${isDark ? 'is-dark' : 'is-light'}`} aria-hidden="true">
            <div className="ny-sky" />
            {isDark && <div className="ny-stars" style={{ boxShadow: stars }} />}
            <div className="ny-glow" />

            {bursts.map((b, i) => <Burst key={i} cfg={b} />)}

            <Img src={NY.star} className="ny-spark ny-sp-1" />
            <Img src={NY.sparkle} className="ny-spark ny-sp-2" />
            <Img src={NY.sparkle} className="ny-spark ny-sp-3" />
            <Img src={NY.star} className="ny-spark ny-sp-4" />

            <Hanging className="ny-hang-1" src={NY.discoball} />
            <Hanging className="ny-hang-2" src={NY.discoball} />

            {confetti.map((f, i) => (
                <span key={i} className="ny-confetti"
                    style={{ left: `${f.x}%`, width: f.w, height: f.h, background: f.c, opacity: f.o, '--d': `${f.d}s`, '--sway': `${f.sway}px`, animationDelay: `${f.delay}s` }} />
            ))}

            <Img src={NY.balloon} className="ny-balloon ny-b-1" />
            <Img src={NY.balloon} className="ny-balloon ny-b-2" />
            <Img src={NY.balloon} className="ny-balloon ny-b-3" />
            <Img src={NY.confetti} className="ny-cball" />

            <City />

            <Img src={NY.popper} className="ny-popper" />
            <Img src={NY.clock} className="ny-clock" />
            <Img src={NY.glasses} className="ny-glasses" />
            <Img src={NY.champagne} className="ny-bottle" />
        </div>
    );
}
