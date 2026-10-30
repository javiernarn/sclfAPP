import React from 'react';
import { XM } from './art';

/**
 * SantaSleigh — Santa rides his sleigh across the sky behind three reindeer
 * (the lead one has a glowing red nose) and drops presents on the village below.
 *
 *  - Santa + reindeer + presents: Google Noto Emoji artwork (Apache 2.0).
 *  - The sleigh, harness, sack and runners are original artwork drawn in SVG.
 *  - Flight, gallop bob, trail sparkles and the falling gifts are CSS only
 *    (seasons.css, section "1b-2"). Every gift keeps the sleigh's forward speed
 *    while it falls, so it follows a real arc, then pops down a chimney.
 *
 * The whole flight is one loop (--xm-fly-t). Gift drops are timed with
 * animation-delay so they always fall while Santa is on screen.
 */

// delay (s) after the loop starts, hue shift, spin, size
const DROPS = [
    { dl: 4.6, hue: 0,   rot: 220,  s: 1.0,  dx: '-1vw' },
    { dl: 6.4, hue: 205, rot: -260, s: 0.82, dx: '-2vw' },
    { dl: 8.2, hue: 110, rot: 180,  s: 0.95, dx: '-1vw' },
    { dl: 10.0, hue: 300, rot: -200, s: 0.8, dx: '-2vw' },
    { dl: 11.8, hue: 40, rot: 240,  s: 0.9,  dx: '-1vw' },
];

const TRAIL = [0, 1, 2, 3, 4, 5];

export default function SantaSleigh() {
    return (
        <div className="xm-flight">
            <div className="xm-arc">
                {/* shimmering magic dust behind the sleigh */}
                {TRAIL.map((i) => (
                    <img key={i} src={i % 2 ? XM.sparkle : XM.star} className="xm-trail" alt="" draggable="false"
                        style={{ '--i': i, top: `${38 + (i % 3) * 14}%` }} />
                ))}

                {/* presents tossed out of the sack */}
                {DROPS.map((d, i) => (
                    <div key={i} className={`xm-drop xm-d${i + 1}`}
                        style={{ '--dl': `${d.dl}s`, '--rot': `${d.rot}deg`, '--dx': d.dx, '--ds': d.s }}>
                        <img src={XM.gift} className="xm-drop-gift" alt="" draggable="false" style={{ filter: `hue-rotate(${d.hue}deg)` }} />
                        <img src={XM.sparkle} className="xm-drop-poof" alt="" draggable="false" />
                    </div>
                ))}

                <svg className="xm-sleigh" viewBox="0 0 620 210" focusable="false" overflow="visible">
                    <defs>
                        <linearGradient id="xm-sl-red" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#e23b3b" />
                            <stop offset="1" stopColor="#8f1420" />
                        </linearGradient>
                        <linearGradient id="xm-sl-gold" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0" stopColor="#c8901a" />
                            <stop offset="0.5" stopColor="#ffe08a" />
                            <stop offset="1" stopColor="#c8901a" />
                        </linearGradient>
                        <radialGradient id="xm-sl-nose" cx="0.4" cy="0.4" r="0.7">
                            <stop offset="0" stopColor="#ffd0d0" />
                            <stop offset="0.35" stopColor="#ff3b3b" />
                            <stop offset="1" stopColor="#c40016" />
                        </radialGradient>
                    </defs>

                    {/* harness lines to the team */}
                    <g className="xm-harness" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        {['M328 124 C364 126 410 124 452 114', 'M452 114 C474 110 494 108 510 106', 'M510 106 C532 102 552 99 566 96'].map((d, i) => (
                            <g key={i}>
                                <path d={d} stroke="#6b3f10" strokeWidth="5" />
                                <path d={d} stroke="#ffd36a" strokeWidth="1.8" />
                            </g>
                        ))}
                        {/* collars where the traces meet each reindeer */}
                        {[[452, 114], [510, 106], [566, 96]].map(([x, y], i) => (
                            <circle key={i} cx={x} cy={y} r="5" fill="#c8901a" stroke="#6b3f10" strokeWidth="1.5" />
                        ))}
                        <circle cx="328" cy="124" r="5.5" fill="#c8901a" stroke="#6b3f10" strokeWidth="1.5" />
                    </g>

                    {/* the reindeer (mirrored: they face the direction of travel) */}
                    <g className="xm-team">
                        <g transform="translate(406 52)"><g className="xm-deer-g xm-dg-3">
                            <image href={XM.reindeer} width="104" height="104" transform="translate(104 0) scale(-1 1)" />
                        </g></g>
                        <g transform="translate(454 44)"><g className="xm-deer-g xm-dg-2">
                            <image href={XM.reindeer} width="108" height="108" transform="translate(108 0) scale(-1 1)" />
                        </g></g>
                        <g transform="translate(508 34)"><g className="xm-deer-g xm-dg-1">
                            <image href={XM.reindeer} width="112" height="112" transform="translate(112 0) scale(-1 1)" />
                            {/* Rudolph */}
                            <circle className="xm-nose-halo" cx="89" cy="41.5" r="14" fill="#ff2d2d" />
                            <circle cx="89" cy="41.5" r="6" fill="url(#xm-sl-nose)" />
                        </g></g>
                    </g>

                    {/* ---- sleigh ---- */}
                    <g className="xm-sleigh-body">
                        {/* runners + posts */}
                        <path d="M30 184 H292 C326 184 340 164 322 148" fill="none" stroke="url(#xm-sl-gold)" strokeWidth="8" strokeLinecap="round" />
                        <path d="M30 184 C20 184 14 176 18 168" fill="none" stroke="url(#xm-sl-gold)" strokeWidth="8" strokeLinecap="round" />
                        <path d="M96 184 V152 M250 184 V152" stroke="url(#xm-sl-gold)" strokeWidth="6" strokeLinecap="round" />

                        {/* back wall of the sleigh (interior) */}
                        <path d="M40 84 C36 130 66 150 112 150 L254 150 C296 150 322 130 330 100 L246 112 L72 112 C62 98 52 90 40 84Z" fill="#5b0d18" />

                        {/* sack of gifts */}
                        <g className="xm-sack">
                            <path d="M52 122 C36 96 52 66 82 60 C112 66 128 96 112 122Z" fill="#9a6a30" />
                            <path d="M52 122 C44 100 56 76 76 66 C60 86 60 104 70 122Z" fill="#7d5121" opacity="0.7" />
                            <path d="M70 62 C76 54 90 54 96 62 C90 66 76 66 70 62Z" fill="#d94b4b" />
                            <image href={XM.gift} x="46" y="30" width="46" height="46" />
                            <image href={XM.gift} x="84" y="40" width="38" height="38" style={{ filter: 'hue-rotate(205deg)' }} />
                            <image href={XM.gift} x="68" y="20" width="34" height="34" style={{ filter: 'hue-rotate(110deg)' }} />
                        </g>

                        {/* Santa */}
                        <image className="xm-santa" href={XM.santa} x="138" y="-2" width="124" height="124" />

                        {/* front panel + gold trim */}
                        <path d="M36 84 C30 134 64 158 112 158 L256 158 C300 158 326 136 334 98 C304 118 276 122 246 118 L72 118 C62 100 50 92 36 84Z" fill="url(#xm-sl-red)" />
                        <path d="M72 118 H246" stroke="url(#xm-sl-gold)" strokeWidth="5" strokeLinecap="round" />
                        <path d="M60 146 C80 152 100 150 112 150 H256" fill="none" stroke="url(#xm-sl-gold)" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
                        {/* curled front */}
                        <path d="M334 98 C346 90 344 76 332 74" fill="none" stroke="url(#xm-sl-gold)" strokeWidth="6" strokeLinecap="round" />
                        {/* little lantern at the back */}
                        <g className="xm-lantern">
                            <circle cx="30" cy="98" r="16" fill="#ffd36a" opacity="0.25" />
                            <circle cx="30" cy="98" r="6" fill="#fff3b0" />
                        </g>
                    </g>
                </svg>
            </div>
        </div>
    );
}
