import React, { useMemo } from 'react';
import { HW } from './art';
import GraveCrew from './GraveCrew';

/**
 * HalloweenScene — FIRST theme.
 * A night (or dusk, in light mode) graveyard: moon, flying bats, glowing
 * jack-o'-lanterns, bones + skulls, cobwebs with dangling spiders, ghosts,
 * candles, drifting fog and rising embers — plus buried coffins that open and
 * let panicking skeleton thieves run off with a sack of bones (GraveCrew).
 *
 * Dark / light wiring (isDark comes from the app theme):
 *   dark  -> bats fly, candles are lit (flame + glow + flicker)
 *   light -> NO bats at all, candles are blown out (flame gone, a wisp of smoke)
 *
 * The creatures are real, professionally designed artwork (Google Noto Emoji,
 * Apache 2.0 — see ./art/ART_CREDITS.md), not hand-drawn shapes. Motion, glow
 * and layout are CSS. Styles live in seasons.css (.hw-*).
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

// ---- bat -------------------------------------------------------------------
function Bat({ cfg }) {
    return (
        <div
            className={`hw-bat ${cfg.dir < 0 ? 'rtl' : 'ltr'}`}
            style={{ top: cfg.top, '--w': cfg.w, '--dur': `${cfg.dur}s`, '--delay': `${cfg.delay}s`, '--flap': `${cfg.flap}s` }}
        >
            <div className="hw-bat-bob">
                <div className="hw-bat-flap">
                    <Img src={HW.bat} className="hw-bat-img" />
                </div>
            </div>
        </div>
    );
}

// ---- jack-o'-lantern -------------------------------------------------------
function Pumpkin({ className = '', flip = false }) {
    return <Img src={HW.pumpkin} className={`hw-pumpkin ${className}${flip ? ' flip' : ''}`} />;
}

// ---- cobweb + spider -------------------------------------------------------
function Cobweb({ className = '' }) {
    return <Img src={HW.cobweb} className={`hw-web ${className}`} />;
}
function Spider({ className = '' }) {
    return (
        <div className={`hw-spider ${className}`}>
            <span className="hw-thread" />
            <Img src={HW.spider} className="hw-spider-img" />
        </div>
    );
}

// ---- candle: wax + wick layer, plus a flame layer that only exists while lit ----
function Candle({ className = '', lit }) {
    return (
        <div className={`hw-candle ${className} ${lit ? 'is-lit' : 'is-out'}`}>
            <span className="hw-candle-halo" />
            <Img src={HW.candleBody} className="hw-candle-body" />
            <Img src={HW.candleFlame} className="hw-candle-flame" />
            <span className="hw-candle-smoke"><i /><i /></span>
        </div>
    );
}

// ---- graveyard ground (hills + stones only; the creatures are artwork) -----
function Ground() {
    return (
        <svg className="hw-ground" viewBox="0 0 1200 240" preserveAspectRatio="xMidYMax slice" focusable="false">
            <path className="hw-hill-back" d="M0 150 C150 108 300 142 450 124 C600 106 750 152 900 130 C1050 110 1150 134 1200 122 L1200 240 L0 240Z" />
            <g className="hw-stone">
                <path d="M300 168 V138 Q300 122 316 122 Q332 122 332 138 V168Z" />
                <path d="M380 164 V142 Q380 130 392 130 Q404 130 404 142 V164Z" />
                <path d="M520 160 h8 v-14 h14 v-8 h-14 v-14 h-8 v14 h-14 v8 h14Z" />
                <path d="M640 166 V132 Q640 114 660 114 Q680 114 680 132 V166Z" />
                <path d="M720 163 V145 Q720 134 730 134 Q740 134 740 145 V163Z" />
            </g>
            <path className="hw-hill-front" d="M0 192 C200 160 380 196 600 178 C820 160 1000 198 1200 172 L1200 240 L0 240Z" />
        </svg>
    );
}

// ---- configuration ---------------------------------------------------------
const BATS = [
    { top: '9%', w: 'clamp(40px, 9vw, 94px)', dur: 19, delay: -4, flap: 0.26, dir: 1 },
    { top: '21%', w: 'clamp(28px, 6vw, 64px)', dur: 24, delay: -14, flap: 0.2, dir: -1 },
    { top: '5%', w: 'clamp(22px, 4.5vw, 48px)', dur: 28, delay: -9, flap: 0.18, dir: 1 },
    { top: '34%', w: 'clamp(34px, 7vw, 76px)', dur: 21, delay: -1, flap: 0.24, dir: -1 },
    { top: '15%', w: 'clamp(26px, 5vw, 56px)', dur: 32, delay: -20, flap: 0.2, dir: 1 },
    { top: '44%', w: 'clamp(20px, 4vw, 44px)', dur: 26, delay: -7, flap: 0.17, dir: -1 },
    { top: '28%', w: 'clamp(30px, 6.5vw, 70px)', dur: 17, delay: -11, flap: 0.25, dir: 1 },
];
const EMBERS = Array.from({ length: 14 }, (_, i) => {
    const r = mulberry(i * 97 + 11);
    return { x: Math.round(r() * 100), d: 9 + r() * 10, s: 3 + r() * 4, delay: -r() * 14, sway: 14 + r() * 26 };
});

export default function HalloweenScene({ variant = 'auth', isDark = true }) {
    const stars = useMemo(() => {
        const r = mulberry(31);
        return Array.from({ length: 46 }, () =>
            `${(r() * 100).toFixed(1)}vw ${(r() * 62).toFixed(1)}vh 0 ${r() > 0.82 ? 1 : 0}px rgba(255,236,200,${(0.35 + r() * 0.6).toFixed(2)})`
        ).join(',');
    }, []);
    const bats = variant === 'dashboard' ? BATS.slice(0, 3) : variant === 'loading' ? BATS : BATS.slice(0, 6);

    return (
        <div className={`hw-scene hw-${variant} ${isDark ? 'is-dark' : 'is-light'}`} aria-hidden="true">
            <div className="hw-sky" />
            {isDark && <div className="hw-stars" style={{ boxShadow: stars }} />}
            <div className="hw-moon"><span className="hw-moon-craters" /></div>
            <div className="hw-fog hw-fog-1" />
            <div className="hw-fog hw-fog-2" />

            <Cobweb className="hw-web-l" />
            <Cobweb className="hw-web-r" />
            <Spider className="hw-spider-1" />
            <Spider className="hw-spider-2" />

            <Img src={HW.ghost} className="hw-ghost hw-ghost-1" />
            <Img src={HW.ghost} className="hw-ghost hw-ghost-2" />

            {/* bats only exist at night — in the light theme they are gone */}
            {isDark && bats.map((b, i) => <Bat key={i} cfg={b} />)}

            <Img src={HW.crossbones} className="hw-fl hw-xbones hw-fl-1" />
            <Img src={HW.skull} className="hw-fl hw-skull hw-fl-2" />
            <Img src={HW.bone} className="hw-fl hw-bone hw-fl-3" />
            <Img src={HW.skull} className="hw-fl hw-skull hw-fl-4" />
            <Img src={HW.crossbones} className="hw-fl hw-xbones hw-fl-5" />
            <Img src={HW.bone} className="hw-fl hw-bone hw-fl-6" />

            {EMBERS.map((e, i) => (
                <span key={i} className="hw-ember"
                    style={{ left: `${e.x}%`, '--d': `${e.d}s`, '--s': `${e.s}px`, '--sway': `${e.sway}px`, animationDelay: `${e.delay}s` }} />
            ))}

            <Ground />

            <Pumpkin className="hw-pk hw-pk-1" />
            <Pumpkin className="hw-pk hw-pk-2" flip />
            <Pumpkin className="hw-pk hw-pk-3" flip />
            <Pumpkin className="hw-pk hw-pk-4" />
            <Pumpkin className="hw-pk hw-pk-5" flip />
            <Candle className="hw-candle-1" lit={isDark} />
            <Candle className="hw-candle-2" lit={isDark} />
            <Img src={HW.skull} className="hw-gskull" />
            <Img src={HW.bone} className="hw-gbone-1" />
            <Img src={HW.bone} className="hw-gbone-2" />

            {/* buried coffins -> skeleton thieves (run left / right with a sack of bones) */}
            <GraveCrew variant={variant} />
        </div>
    );
}
