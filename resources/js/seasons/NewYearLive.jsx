import React from 'react';
import useNewYearClock from './newyearClock';

/**
 * Real-time New Year widgets. They all read the same live clock
 * (newyearClock.js) — the viewer's real local time — so nothing here is a loop
 * pretending to be time:
 *
 *   LiveClock     analog clock whose hands show the actual time
 *   CountdownSign neon (night) / gold-foil (day) sign counting down to 1 January
 *   BallTower     a skyscraper with a pole; in the last 60 s of 31 Dec the crystal
 *                 ball really drops, then the sign turns into HAPPY NEW YEAR
 *   Bunting       party flags strung across the top
 *
 * All drawn in code (original artwork). Styles: seasons.css, section "1c-2".
 */

const pad = (n) => String(n).padStart(2, '0');

// ------------------------------------------------------------------ clock
const TICKS = Array.from({ length: 60 }, (_, i) => i);

export function LiveClock({ className = '' }) {
    const { localSec, total, celebrating } = useNewYearClock();
    const sec = localSec * 6;           // 6 deg per second
    const min = (localSec / 60) * 6;    // 6 deg per minute
    const hr = (localSec / 3600) * 30;  // 30 deg per hour
    const hot = celebrating || total <= 10;
    return (
        <svg className={`ny-live-clock ${hot ? 'is-hot' : ''} ${className}`} viewBox="0 0 100 100" focusable="false">
            <defs>
                <linearGradient id="ny-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff1b0" />
                    <stop offset="0.45" stopColor="#f5b83a" />
                    <stop offset="1" stopColor="#a8700f" />
                </linearGradient>
                <radialGradient id="ny-face" cx="0.5" cy="0.4" r="0.7">
                    <stop offset="0" stopColor="#26307a" />
                    <stop offset="1" stopColor="#0a0d33" />
                </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="48" fill="url(#ny-gold)" />
            <circle cx="50" cy="50" r="43.5" fill="url(#ny-face)" />
            <circle className="ny-clock-ring" cx="50" cy="50" r="43.5" fill="none" stroke="#fde68a" strokeWidth="0.8" opacity="0.5" />
            {TICKS.map((i) => (
                <line key={i} x1="50" y1={i % 5 ? 9 : 7} x2="50" y2={i % 5 ? 11 : 13.5} stroke={i % 5 ? '#8f9be0' : '#fde68a'} strokeWidth={i % 5 ? 0.6 : 1.4}
                    strokeLinecap="round" transform={`rotate(${i * 6} 50 50)`} />
            ))}
            {[['12', 50, 27], ['3', 77, 52.5], ['6', 50, 80], ['9', 23, 52.5]].map(([t, x, y]) => (
                <text key={t} x={x} y={y} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fde68a" fontFamily="Georgia, 'Times New Roman', serif">{t}</text>
            ))}
            <text x="50" y="40" textAnchor="middle" fontSize="4.6" letterSpacing="1.2" fill="#a5b4fc" fontWeight="700">NEW YEAR</text>
            {/* hands */}
            <g className="ny-hand" style={{ transform: `rotate(${hr}deg)` }}>
                <path d="M47.6 52 L48.6 29 L50 25 L51.4 29 L52.4 52Z" fill="url(#ny-gold)" stroke="#6b4508" strokeWidth="0.4" />
            </g>
            <g className="ny-hand" style={{ transform: `rotate(${min}deg)` }}>
                <path d="M48.4 54 L49.2 16 L50 11 L50.8 16 L51.6 54Z" fill="#e8ecff" stroke="#5a64b0" strokeWidth="0.4" />
            </g>
            <g className="ny-hand ny-hand-s" style={{ transform: `rotate(${sec}deg)` }}>
                <line x1="50" y1="60" x2="50" y2="12" stroke="#ff4d6d" strokeWidth="0.9" strokeLinecap="round" />
                <circle cx="50" cy="60" r="2" fill="#ff4d6d" />
            </g>
            <circle cx="50" cy="50" r="3" fill="url(#ny-gold)" stroke="#6b4508" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="1.1" fill="#ff4d6d" />
            {/* glass shine */}
            <path d="M18 34 C26 18 42 12 58 13 C40 20 28 28 22 44Z" fill="#fff" opacity="0.08" />
        </svg>
    );
}

// --------------------------------------------------------- countdown sign
export function CountdownSign() {
    const c = useNewYearClock();
    const digits = String(c.year).split('');
    return (
        <div className={`ny-hud ${c.celebrating ? 'is-party' : ''} ${!c.celebrating && c.total <= 10 ? 'is-final' : ''}`}>
            <div className="ny-hud-kicker">{c.celebrating ? 'HAPPY NEW YEAR' : c.total <= 10 ? 'ALMOST MIDNIGHT' : 'COUNTDOWN TO'}</div>
            <div className="ny-hud-year" aria-label={String(c.year)}>
                {digits.map((d, i) => <span key={i} style={{ '--i': i }}>{d}</span>)}
            </div>
            {c.celebrating ? (
                <div className="ny-hud-wish">Wishing you a bright and joyful {c.year}!</div>
            ) : c.total <= 10 ? (
                <div className="ny-hud-big">{c.total}</div>
            ) : (
                <div className="ny-hud-time">
                    {[['d', c.d, 'DAYS'], ['h', c.h, 'HRS'], ['m', c.m, 'MIN'], ['s', c.s, 'SEC']].map(([k, v, label]) => (
                        <div key={k} className="ny-hud-cell"><b>{pad(v)}</b><small>{label}</small></div>
                    ))}
                </div>
            )}
        </div>
    );
}

// -------------------------------------------------------- ball-drop tower
const TOWER_X = 420;
const TOWER_W = 64;
const ROOF_Y = 88;
const BALL_TOP = 42;
const BALL_LOW = 76;

const TOWER_WINS = (() => {
    const out = [];
    let n = 0;
    for (let y = ROOF_Y + 34; y < 192; y += 11) {
        for (let x = TOWER_X + 6; x < TOWER_X + TOWER_W - 8; x += 9) { n += 1; if (n % 3) out.push({ x, y, d: ((n * 0.37) % 5).toFixed(2) }); }
    }
    return out;
})();

export function BallTower() {
    const { dropP, celebrating, total } = useNewYearClock();
    const cx = TOWER_X + TOWER_W / 2;
    const dy = (BALL_LOW - BALL_TOP) * dropP;
    const fast = !celebrating && total <= 60;
    return (
        <svg className={`ny-tower ${fast ? 'is-dropping' : ''} ${celebrating ? 'is-landed' : ''}`} viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" focusable="false">
            <defs>
                <radialGradient id="ny-ball" cx="0.38" cy="0.35" r="0.75">
                    <stop offset="0" stopColor="#ffffff" />
                    <stop offset="0.45" stopColor="#bcd4ff" />
                    <stop offset="1" stopColor="#5b6fd6" />
                </radialGradient>
                <radialGradient id="ny-halo">
                    <stop offset="0" stopColor="#d7e5ff" stopOpacity="0.9" />
                    <stop offset="1" stopColor="#bcd4ff" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="ny-led" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#ff4d8d" /><stop offset="0.5" stopColor="#ffd84d" /><stop offset="1" stopColor="#4db8ff" />
                </linearGradient>
            </defs>
            {/* building */}
            <rect className="ny-tower-body" x={TOWER_X} y={ROOF_Y} width={TOWER_W} height={200 - ROOF_Y} />
            <rect className="ny-tower-body ny-tower-top" x={TOWER_X + 6} y={ROOF_Y - 8} width={TOWER_W - 12} height="8" />
            {/* LED billboard */}
            <rect className="ny-led" x={TOWER_X + 4} y={ROOF_Y + 8} width={TOWER_W - 8} height="20" rx="2" fill="url(#ny-led)" />
            <text x={cx} y={ROOF_Y + 23} textAnchor="middle" fontSize="13" fontWeight="900" fill="#12123a" fontFamily="'Arial Black', Impact, sans-serif">{celebrating ? 'HAPPY' : 'NYE'}</text>
            <g className="ny-tower-wins">{TOWER_WINS.map((w, i) => <rect key={i} x={w.x} y={w.y} width="4.4" height="6" style={{ animationDelay: `${w.d}s` }} />)}</g>
            {/* pole + beacon */}
            <rect x={cx - 1.2} y={BALL_TOP - 8} width="2.4" height={ROOF_Y - 8 - BALL_TOP + 8} fill="#aeb8e8" />
            <circle className="ny-beacon" cx={cx} cy={BALL_TOP - 10} r="2.4" fill="#ff3b3b" />
            {/* the ball: really drops during the last minute of 31 December */}
            <g className="ny-ball" style={{ transform: `translateY(${dy}px)` }}>
                <circle className="ny-ball-halo" cx={cx} cy={BALL_TOP + 8} r="19" fill="url(#ny-halo)" />
                <circle cx={cx} cy={BALL_TOP + 8} r="11" fill="url(#ny-ball)" stroke="#e8f0ff" strokeWidth="0.8" />
                <g className="ny-ball-facets" style={{ transformOrigin: `${cx}px ${BALL_TOP + 8}px` }}>
                    {Array.from({ length: 8 }, (_, i) => (
                        <rect key={i} x={cx - 1.6 + Math.cos((i * Math.PI) / 4) * 6} y={BALL_TOP + 6.4 + Math.sin((i * Math.PI) / 4) * 6} width="3.2" height="3.2" fill={['#ff7ad9', '#ffe08a', '#7ad7ff', '#fff'][i % 4]} transform={`rotate(45 ${cx + Math.cos((i * Math.PI) / 4) * 6} ${BALL_TOP + 8 + Math.sin((i * Math.PI) / 4) * 6})`} />
                    ))}
                </g>
            </g>
        </svg>
    );
}

// ----------------------------------------------------------------- bunting
const PIN_X = [0, 240, 480, 720, 960, 1200];
const FLAGS = ['#fbbf24', '#f472b6', '#38bdf8', '#a78bfa', '#34d399', '#fb7185'];
const qb = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

export function Bunting() {
    return (
        <svg className="ny-bunting" viewBox="0 0 1200 90" preserveAspectRatio="xMidYMin slice" focusable="false">
            {PIN_X.slice(0, -1).map((p0, i) => {
                const p1 = PIN_X[i + 1];
                const cx = (p0 + p1) / 2;
                const dip = 34 + (i % 2) * 8;
                return (
                    <g key={i}>
                        <path d={`M${p0} 0 Q${cx} ${dip * 2} ${p1} 0`} fill="none" stroke="#d6c8ff" strokeWidth="2" opacity="0.8" />
                        {Array.from({ length: 7 }, (_, k) => {
                            const t = (k + 1) / 8;
                            const bx = qb(p0, cx, p1, t);
                            const by = qb(0, dip * 2, 0, t);
                            return <path key={k} className="ny-flag" d={`M${bx - 10} ${by} L${bx + 10} ${by} L${bx} ${by + 26}Z`} fill={FLAGS[(k + i) % FLAGS.length]} style={{ animationDelay: `${-((k + i * 3) % 5) * 0.5}s` }} />;
                        })}
                    </g>
                );
            })}
        </svg>
    );
}
