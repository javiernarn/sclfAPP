import React from 'react';
import { XM } from './art';

/**
 * ChristmasTown — a snowy village (Santa's drop zone) + the string-light garland.
 *
 *  - Houses, roofs with snow caps and icicles, glowing windows, wreaths, chimney
 *    smoke, lamp posts and eave lights are original SVG drawn in code.
 *  - The church and the pine trees are Google Noto Emoji artwork (Apache 2.0).
 *  - Colours that change between night and day come from CSS variables in
 *    seasons.css (.xm-town / .xm-garland), so the light/dark toggle is live.
 */

const GY = 162; // ground line inside the 1200 x 200 town viewBox
const BULBS = ['#ff4d4d', '#ffd84d', '#4dff88', '#4db8ff', '#ff7ad9'];

const HOUSES = [
    { x: 30,   w: 120, h: 64, rh: 42, wall: '#f1dcc0', roof: '#b3332f', door: '#5b3a24', chim: 0.72 },
    { x: 200,  w: 96,  h: 88, rh: 40, wall: '#cbd9ea', roof: '#2f4f73', door: '#8b2b2b', chim: 0.25 },
    { x: 332,  w: 140, h: 58, rh: 38, wall: '#f3c9a0', roof: '#7b3f2b', door: '#2f5d3a', chim: 0.7 },
    { x: 706,  w: 110, h: 76, rh: 42, wall: '#e6e1f3', roof: '#5b3b8c', door: '#b3332f', chim: 0.3 },
    { x: 856,  w: 130, h: 60, rh: 38, wall: '#d8ecd0', roof: '#a4452d', door: '#3a2a5a', chim: 0.68 },
    { x: 1030, w: 124, h: 82, rh: 44, wall: '#f6e3a6', roof: '#20594a', door: '#7a3a1b', chim: 0.28 },
];

const PINES = [
    { x: 160, s: 62 }, { x: 306, s: 56 }, { x: 486, s: 70 }, { x: 676, s: 62 },
    { x: 832, s: 56 }, { x: 996, s: 66 }, { x: 1160, s: 74 }, { x: 8, s: 70 },
];

const LAMPS = [176, 684, 1010];

function House({ x, w, h, rh, wall, roof, door, chim }, hi) {
    const top = GY - h;
    const cx = x + w / 2;
    const apexY = top - rh;
    const L = x - 10;
    const R = x + w + 10;
    const roofY = (px) => top - rh * (1 - Math.abs(px - cx) / (w / 2 + 10));

    // chimney
    const chW = 15;
    const chX = x + w * chim - chW / 2;
    const chTop = roofY(chX + chW / 2) - 24;

    // snow cap on the roof, scalloped lower edge
    const f = 0.52;
    const capY = apexY + rh * f;
    const capL = cx - (cx - L) * f;
    const capR = cx + (R - cx) * f;
    const bumps = 6;
    const bw = (capR - capL) / bumps;
    let cap = `M${cx} ${apexY - 2} L${capL - 2} ${capY} `;
    for (let i = 0; i < bumps; i++) cap += `Q${capL + bw * (i + 0.5)} ${capY + 9 + (i % 2) * 3} ${capL + bw * (i + 1)} ${capY} `;
    cap += `L${capR + 2} ${capY} Z`;

    // eave lights + icicles
    const items = [];
    const n = Math.floor((R - L) / 15);
    for (let i = 0; i <= n; i++) {
        const px = L + 4 + i * ((R - L - 8) / n);
        items.push(<circle key={`b${i}`} className={`xm-bulb xm-b${(i + hi) % 5}`} cx={px} cy={top + 6} r="3.3" fill={BULBS[(i + hi) % 5]} />);
        if (i % 2 === 0) {
            const len = 7 + ((i * 7 + hi * 3) % 3) * 4;
            items.push(<path key={`i${i}`} d={`M${px - 3} ${top} L${px + 3} ${top} L${px} ${top + len}Z`} fill="#eaf7ff" opacity="0.92" />);
        }
    }

    // windows left/right of the door
    const ww = 20; const wh = 22; const wy = top + (h - wh) * 0.4;
    const winXs = [x + w * 0.2 - ww / 2, x + w * 0.8 - ww / 2];
    const dx = cx - 9;

    return (
        <g key={hi} className="xm-house">
            <ellipse className="xm-mound" cx={cx} cy={GY + 3} rx={w * 0.66} ry="10" />
            {/* chimney + smoke */}
            <rect x={chX} y={chTop} width={chW} height="34" fill="#8a4b3a" />
            <rect x={chX - 2} y={chTop - 4} width={chW + 4} height="7" rx="2" fill="#f4fbff" />
            {[0, 1, 2].map((k) => (
                <circle key={k} className="xm-smoke" cx={chX + chW / 2} cy={chTop - 6} r="5"
                    style={{ animationDelay: `${-(k * 1.6 + hi * 0.7)}s` }} />
            ))}
            {/* walls */}
            <rect x={x} y={top} width={w} height={h} fill={wall} />
            <rect x={x} y={top} width={w} height={h} fill="url(#xm-wall-shade)" />
            {/* roof */}
            <polygon points={`${L},${top} ${cx},${apexY} ${R},${top}`} fill={roof} />
            <path d={cap} fill="#fbfeff" />
            <path d={`M${L} ${top} L${cx} ${apexY} L${R} ${top}`} fill="none" stroke="#fbfeff" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
            {/* night shade over walls + roof (opacity set in CSS) */}
            <g className="xm-shade">
                <rect x={x} y={top} width={w} height={h} />
                <polygon points={`${L},${top} ${cx},${apexY} ${R},${top}`} />
            </g>
            {/* gable window */}
            <circle className="xm-halo" cx={cx} cy={top - rh * 0.4} r="13" />
            <circle className="xm-win" cx={cx} cy={top - rh * 0.4} r="6.5" fill="url(#xm-warm)" style={{ animationDelay: `${-hi * 1.3}s` }} />
            {/* windows */}
            {winXs.map((wx, k) => (
                <g key={k}>
                    <rect className="xm-halo" x={wx - 6} y={wy - 6} width={ww + 12} height={wh + 12} rx="6" />
                    <rect className="xm-win" x={wx} y={wy} width={ww} height={wh} rx="2" fill="url(#xm-warm)" style={{ animationDelay: `${-(hi * 1.7 + k * 2.2)}s` }} />
                    <path d={`M${wx + ww / 2} ${wy} V${wy + wh} M${wx} ${wy + wh / 2} H${wx + ww}`} stroke="#5a3b1e" strokeWidth="1.6" />
                    <rect x={wx - 3} y={wy + wh} width={ww + 6} height="4" rx="2" fill="#fbfeff" />
                </g>
            ))}
            {/* door, wreath, step */}
            <path d={`M${dx} ${GY} V${GY - 24} a9 9 0 0 1 18 0 V${GY}Z`} fill={door} />
            <circle cx={dx + 14} cy={GY - 14} r="1.4" fill="#ffd36a" />
            <circle cx={dx + 9} cy={GY - 24} r="6" fill="none" stroke="#1f8a46" strokeWidth="3.2" />
            <circle cx={dx + 9} cy={GY - 30} r="2.1" fill="#ff3b3b" />
            <rect x={dx - 3} y={GY - 2} width="24" height="5" rx="2.5" fill="#fbfeff" />
            {/* string lights along the eave */}
            {items}
        </g>
    );
}

export function ChristmasTown() {
    return (
        <svg className="xm-town" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" focusable="false">
            <defs>
                <radialGradient id="xm-warm" cx="0.5" cy="0.55" r="0.75">
                    <stop offset="0" stopColor="#fff6c7" />
                    <stop offset="0.6" stopColor="#ffd070" />
                    <stop offset="1" stopColor="#ff9f3c" />
                </radialGradient>
                <linearGradient id="xm-wall-shade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#000" stopOpacity="0" />
                    <stop offset="1" stopColor="#000" stopOpacity="0.16" />
                </linearGradient>
            </defs>

            {/* distant pines */}
            {PINES.map((p, i) => (
                <image key={i} className="xm-pine" href={XM.pine} x={p.x - p.s / 2} y={GY - p.s + 6} width={p.s} height={p.s} />
            ))}

            {/* church in the middle of the village */}
            <ellipse className="xm-mound" cx="594" cy={GY + 3} rx="82" ry="10" />
            <image className="xm-church" href={XM.church} x="528" y={GY - 128} width="132" height="132" />
            <circle className="xm-halo" cx="594" cy={GY - 36} r="16" />

            {HOUSES.map((h, i) => House(h, i))}

            {/* lamp posts */}
            {LAMPS.map((lx, i) => (
                <g key={lx} className="xm-lamp">
                    <circle className="xm-halo xm-lamp-halo" cx={lx} cy={GY - 44} r="20" />
                    <rect x={lx - 1.6} y={GY - 42} width="3.2" height="44" fill="#2a2f3a" />
                    <rect x={lx - 5} y={GY - 52} width="10" height="12" rx="3" fill="#2a2f3a" />
                    <rect className="xm-win" x={lx - 3.2} y={GY - 50} width="6.4" height="8" rx="2" fill="url(#xm-warm)" style={{ animationDelay: `${-i * 1.1}s` }} />
                    <circle cx={lx} cy={GY - 54} r="3.2" fill="#fbfeff" />
                </g>
            ))}
        </svg>
    );
}

// ---- string-light garland across the top edge -----------------------------
const PINS = [0, 300, 600, 900, 1200];
const q = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

export function Garland() {
    const swags = PINS.slice(0, -1).map((p0, i) => ({ p0, p1: PINS[i + 1], cx: (p0 + PINS[i + 1]) / 2, dip: 62 + (i % 2) * 10 }));
    return (
        <svg className="xm-garland" viewBox="0 0 1200 90" preserveAspectRatio="xMidYMin slice" focusable="false">
            {swags.map((s, i) => (
                <g key={i}>
                    <path d={`M${s.p0} 0 Q${s.cx} ${s.dip * 2 - 6} ${s.p1} 0`} fill="none" stroke="#1d5b3a" strokeWidth="3.2" />
                    {Array.from({ length: 9 }, (_, k) => {
                        const t = (k + 1) / 10;
                        const bx = q(s.p0, s.cx, s.p1, t);
                        const by = q(0, s.dip * 2 - 6, 0, t);
                        const c = (k + i * 2) % 5;
                        return (
                            <g key={k}>
                                <rect x={bx - 2} y={by} width="4" height="5" fill="#2a3b30" />
                                <circle className={`xm-bulb xm-b${c}`} cx={bx} cy={by + 10} r="6" fill={BULBS[c]} />
                            </g>
                        );
                    })}
                </g>
            ))}
        </svg>
    );
}
