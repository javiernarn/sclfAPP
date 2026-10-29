import React from 'react';

/**
 * SkeletonArt — the running, terrified bone-thief.
 *
 * Hand-drawn SVG (not an emoji): skull with a dropping jaw, ribcage, spine,
 * pelvis, jointed arms and legs. Every joint is its own <g> so seasons.css can
 * swing it around the joint (transform-origin = the joint position, in the
 * viewBox's own units). The figure is drawn facing RIGHT; the parent flips it
 * with scaleX(-1) to run left.
 *
 * He is carrying a sack of stolen bones in one hand and a stolen femur in the
 * other, and looking back over his shoulder in panic.
 *
 * Joint map (viewBox 0 0 160 192):
 *   neck 80,54   shoulders 58,68 / 102,68   hips 70,118 / 90,118
 *   knees  y=152   ankles  y=184   elbows  y=92   wrists  y=114
 */

const INK = '#2b1840';       // outline
const SHADE = '#c9b48d';     // bone shadow line

// A long bone laid out along +x from (0,0) to (len,0), with knobbed ends.
// Drawn twice: fat dark pass = outline, ivory pass on top = body.
function Bone({ len, w = 5, k = 3.6, id }) {
    const half = w / 2;
    const knob = (x, s) => (
        <>
            <circle cx={x} cy={-half - 0.4} r={k} />
            <circle cx={x} cy={half + 0.4} r={k} />
            <circle cx={x + s * 1.4} cy={0} r={k * 0.8} />
        </>
    );
    const shape = (
        <>
            <rect x={0} y={-half} width={len} height={w} rx={half} />
            {knob(0, -1)}
            {knob(len, 1)}
        </>
    );
    return (
        <g>
            <g fill={INK} stroke={INK} strokeWidth="2.6" strokeLinejoin="round">{shape}</g>
            <g fill={`url(#${id}-bone)`}>{shape}</g>
            <rect x={k * 0.6} y={-half + 0.7} width={len - k * 1.2} height={1.1} rx={0.55} fill="#fffdf4" opacity="0.8" />
            <rect x={k * 0.6} y={half - 1.4} width={len - k * 1.2} height={0.9} rx={0.45} fill={SHADE} opacity="0.9" />
        </g>
    );
}

// Ribs: one flattened "D" loop per side, stacked down the spine.
function Rib({ y, span, id }) {
    const l = `M77 ${y} C${80 - span} ${y - 4} ${80 - span - 4} ${y + 6} ${80 - span + 1} ${y + 10} C${80 - span + 6} ${y + 14} 70 ${y + 13} 77 ${y + 10}`;
    const r = `M83 ${y} C${80 + span} ${y - 4} ${80 + span + 4} ${y + 6} ${80 + span - 1} ${y + 10} C${80 + span - 6} ${y + 14} 90 ${y + 13} 83 ${y + 10}`;
    return (
        <g fill="none" strokeLinecap="round">
            <path d={l} stroke={INK} strokeWidth="5.6" />
            <path d={r} stroke={INK} strokeWidth="5.6" />
            <path d={l} stroke={`url(#${id}-bone)`} strokeWidth="3.2" />
            <path d={r} stroke={`url(#${id}-bone)`} strokeWidth="3.2" />
        </g>
    );
}

function Hand({ id }) {
    // four bony fingers fanned out from the wrist, pointing down along +y
    return (
        <g>
            <g stroke={INK} strokeWidth="4.4" strokeLinecap="round" fill="none">
                <path d="M-3.4 2 L-5.2 9" /><path d="M-1.1 2.6 L-1.8 10.6" /><path d="M1.2 2.6 L1.8 10.4" /><path d="M3.4 2 L5.2 8.6" />
            </g>
            <g stroke={`url(#${id}-bone)`} strokeWidth="2.2" strokeLinecap="round" fill="none">
                <path d="M-3.4 2 L-5.2 9" /><path d="M-1.1 2.6 L-1.8 10.6" /><path d="M1.2 2.6 L1.8 10.4" /><path d="M3.4 2 L5.2 8.6" />
            </g>
            <ellipse cx="0" cy="1.2" rx="4.6" ry="3.2" fill={INK} />
            <ellipse cx="0" cy="1.2" rx="3.3" ry="2.2" fill={`url(#${id}-bone)`} />
        </g>
    );
}

function Foot({ id }) {
    // heel at (0,0), toes pointing +x
    return (
        <g>
            <g fill={INK} stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
                <path d="M-3 -3 L4 -3 L15 1.5 L15 4.2 L-3.4 4.2 Z" />
            </g>
            <path d="M-3 -3 L4 -3 L15 1.5 L15 4.2 L-3.4 4.2 Z" fill={`url(#${id}-bone)`} />
            <path d="M8 -0.4 L8 4 M11.4 0.6 L11.4 4" stroke={SHADE} strokeWidth="0.9" />
        </g>
    );
}

export default function SkeletonArt({ uid = 'sk' }) {
    const id = uid;
    return (
        <svg className="hw-sk-svg" viewBox="0 0 160 192" focusable="false" aria-hidden="true">
            <defs>
                <linearGradient id={`${id}-bone`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fffbef" />
                    <stop offset="0.55" stopColor="#f3e7cd" />
                    <stop offset="1" stopColor="#d9c7a2" />
                </linearGradient>
                <radialGradient id={`${id}-skull`} cx="0.42" cy="0.3" r="0.9">
                    <stop offset="0" stopColor="#fffdf3" />
                    <stop offset="0.6" stopColor="#f1e4c6" />
                    <stop offset="1" stopColor="#d4c19a" />
                </radialGradient>
                <radialGradient id={`${id}-socket`} cx="0.5" cy="0.45" r="0.6">
                    <stop offset="0" stopColor="#3a1d5c" />
                    <stop offset="1" stopColor="#0f0519" />
                </radialGradient>
                <linearGradient id={`${id}-sack`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#b9925a" />
                    <stop offset="0.6" stopColor="#8d6a3c" />
                    <stop offset="1" stopColor="#664a28" />
                </linearGradient>
            </defs>

            {/* soft ground shadow (stays on the ground; the body bobs above it) */}
            <ellipse className="hw-sk-shadow" cx="82" cy="188" rx="30" ry="4.2" fill="#000" opacity="0.32" />

            {/* ---------- speed lines + dust (behind) ---------- */}
            <g className="hw-sk-speed" stroke="#fff" strokeLinecap="round" opacity="0.5">
                <path d="M16 70 H36" strokeWidth="2" />
                <path d="M6 100 H30" strokeWidth="2.4" />
                <path d="M14 130 H34" strokeWidth="2" />
            </g>

            <g className="hw-sk-body">
                {/* ---------- back leg + front leg (each: thigh > shin > foot) ---------- */}
                <g className="hw-sk-thigh hw-sk-thigh-b" style={{ transformOrigin: '90px 118px' }}>
                    <g transform="translate(90 118) rotate(90)"><Bone len={34} w={5.2} k={3.8} id={id} /></g>
                    <g className="hw-sk-shin hw-sk-shin-b" style={{ transformOrigin: '90px 152px' }}>
                        <g transform="translate(90 152) rotate(90)"><Bone len={32} w={4.6} k={3.4} id={id} /></g>
                        <g className="hw-sk-foot hw-sk-foot-b" style={{ transformOrigin: '90px 184px' }}>
                            <g transform="translate(88 182)"><Foot id={id} /></g>
                        </g>
                    </g>
                </g>

                {/* ---------- spine, sack arm ---------- */}
                <g className="hw-sk-sackarm" style={{ transformOrigin: '58px 68px' }}>
                    <g transform="translate(58 68) rotate(90)"><Bone len={24} w={4.6} k={3.4} id={id} /></g>
                    <g className="hw-sk-sackfore" style={{ transformOrigin: '58px 92px' }}>
                        <g transform="translate(58 92) rotate(90)"><Bone len={22} w={4.2} k={3.2} id={id} /></g>
                        <g transform="translate(58 113)"><Hand id={id} /></g>
                        {/* the sack of stolen bones hangs from this fist */}
                        <g className="hw-sk-sack" style={{ transformOrigin: '58px 118px' }}>
                            {/* bones poking out of the neck */}
                            <g transform="translate(51 120) rotate(-62)"><Bone len={26} w={4} k={3} id={id} /></g>
                            <g transform="translate(60 120) rotate(-100)"><Bone len={22} w={3.8} k={2.8} id={id} /></g>
                            <g transform="translate(66 121) rotate(-128)"><Bone len={17} w={3.4} k={2.6} id={id} /></g>
                            {/* sack body */}
                            <path d="M47 124 C38 132 33 146 38 158 C42 167 74 167 78 158 C83 146 77 132 69 124 C65 128 51 128 47 124Z"
                                fill={INK} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
                            <path d="M47 124 C38 132 33 146 38 158 C42 167 74 167 78 158 C83 146 77 132 69 124 C65 128 51 128 47 124Z"
                                fill={`url(#${id}-sack)`} />
                            {/* rope tie + knot */}
                            <path d="M46.5 125.5 C52 130 64 130 69.5 125.5" fill="none" stroke="#e8d3a0" strokeWidth="2.2" strokeLinecap="round" />
                            <circle cx="58" cy="128.4" r="2.5" fill="#e8d3a0" stroke={INK} strokeWidth="0.8" />
                            {/* patch + stitches + fold shading */}
                            <rect x="49" y="141" width="14" height="12" rx="1.4" fill="#a3793f" stroke="#4a3219" strokeWidth="0.9" transform="rotate(-6 56 147)" />
                            <path d="M50 142.5 H61.5 M50 151.5 H61.5 M50.5 143 V151 M61 143 V151" stroke="#4a3219" strokeWidth="0.7" strokeDasharray="1.6 1.4" fill="none" transform="rotate(-6 56 147)" />
                            <path d="M42 134 C40 144 41 154 45 161" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.2" strokeLinecap="round" />
                            <path d="M73 136 C77 146 75 154 71 160" fill="none" stroke="#2a1a0a" strokeWidth="1.6" opacity="0.25" strokeLinecap="round" />
                            {/* a bone knob pushing through the cloth */}
                            <g transform="translate(66 152) rotate(18)"><circle r="2.4" fill={INK} /><circle r="1.5" fill="#f3e7cd" /></g>
                        </g>
                    </g>
                </g>

                {/* ---------- pelvis ---------- */}
                <g>
                    <path d="M62 104 C61 120 69 128 80 121 C91 128 99 120 98 104 C91 108 86 106 80 109 C74 106 69 108 62 104Z"
                        fill={INK} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
                    <path d="M62 104 C61 120 69 128 80 121 C91 128 99 120 98 104 C91 108 86 106 80 109 C74 106 69 108 62 104Z"
                        fill={`url(#${id}-bone)`} />
                    <ellipse cx="80" cy="116" rx="4.2" ry="3.2" fill="#2b1840" opacity="0.85" />
                    <ellipse cx="70" cy="114" rx="3" ry="3.6" fill="#2b1840" opacity="0.55" />
                    <ellipse cx="90" cy="114" rx="3" ry="3.6" fill="#2b1840" opacity="0.55" />
                </g>

                {/* ---------- spine + ribcage ---------- */}
                <g>
                    <rect x="77" y="52" width="6" height="58" rx="3" fill={INK} />
                    {[54, 60.5, 67, 73.5, 80, 86.5, 93, 99.5, 106].map((y, i) => (
                        <g key={y}>
                            <rect x="75.2" y={y} width="9.6" height="5" rx="2.4" fill={INK} />
                            <rect x="76.4" y={y + 0.8} width="7.2" height="3.4" rx="1.7" fill={`url(#${id}-bone)`} />
                        </g>
                    ))}
                    <Rib y={64} span={17} id={id} />
                    <Rib y={72} span={19} id={id} />
                    <Rib y={80} span={18} id={id} />
                    <Rib y={88} span={16} id={id} />
                    <Rib y={95.5} span={13} id={id} />
                    {/* breastbone */}
                    <rect x="77.2" y="63" width="5.6" height="25" rx="2.8" fill={INK} />
                    <rect x="78.3" y="64" width="3.4" height="23" rx="1.7" fill={`url(#${id}-bone)`} />
                    {/* collarbones */}
                    <path d="M80 62 C70 58 62 60 56 66" fill="none" stroke={INK} strokeWidth="5.4" strokeLinecap="round" />
                    <path d="M80 62 C90 58 98 60 104 66" fill="none" stroke={INK} strokeWidth="5.4" strokeLinecap="round" />
                    <path d="M80 62 C70 58 62 60 56 66" fill="none" stroke={`url(#${id}-bone)`} strokeWidth="3" strokeLinecap="round" />
                    <path d="M80 62 C90 58 98 60 104 66" fill="none" stroke={`url(#${id}-bone)`} strokeWidth="3" strokeLinecap="round" />
                </g>

                {/* ---------- front leg ---------- */}
                <g className="hw-sk-thigh hw-sk-thigh-a" style={{ transformOrigin: '70px 118px' }}>
                    <g transform="translate(70 118) rotate(90)"><Bone len={34} w={5.2} k={3.8} id={id} /></g>
                    <g className="hw-sk-shin hw-sk-shin-a" style={{ transformOrigin: '70px 152px' }}>
                        <g transform="translate(70 152) rotate(90)"><Bone len={32} w={4.6} k={3.4} id={id} /></g>
                        <g className="hw-sk-foot hw-sk-foot-a" style={{ transformOrigin: '70px 184px' }}>
                            <g transform="translate(68 182)"><Foot id={id} /></g>
                        </g>
                    </g>
                </g>

                {/* ---------- loot arm: waves a stolen femur ---------- */}
                <g className="hw-sk-lootarm" style={{ transformOrigin: '102px 68px' }}>
                    <g transform="translate(102 68) rotate(90)"><Bone len={24} w={4.6} k={3.4} id={id} /></g>
                    <g className="hw-sk-lootfore" style={{ transformOrigin: '102px 92px' }}>
                        <g transform="translate(102 92) rotate(90)"><Bone len={22} w={4.2} k={3.2} id={id} /></g>
                        {/* stolen femur, held in the fist, sticking up and forward */}
                        <g transform="translate(102 112) rotate(-72) translate(-8 0)"><Bone len={34} w={5} k={3.7} id={id} /></g>
                        <g transform="translate(102 113)"><Hand id={id} /></g>
                    </g>
                </g>

                {/* ---------- head ---------- */}
                <g className="hw-sk-head" style={{ transformOrigin: '80px 52px' }}>
                    {/* mouth cavity behind the jaw (visible when it drops) */}
                    <path d="M67 44 H93 V54 C93 58 90 60 86 60 H74 C70 60 67 58 67 54Z" fill="#0f0519" />
                    {/* jaw */}
                    <g className="hw-sk-jaw" style={{ transformOrigin: '80px 46px' }}>
                        <path d="M66.5 45 H93.5 L91 56 C90.4 60 87.4 62.4 84 62.4 H76 C72.6 62.4 69.6 60 69 56Z"
                            fill={INK} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                        <path d="M66.5 45 H93.5 L91 56 C90.4 60 87.4 62.4 84 62.4 H76 C72.6 62.4 69.6 60 69 56Z"
                            fill={`url(#${id}-skull)`} />
                        {/* lower teeth */}
                        <g fill="#fffdf2" stroke={INK} strokeWidth="0.8">
                            <rect x="70.6" y="45.6" width="4.4" height="6" rx="1" />
                            <rect x="75.2" y="45.6" width="4.4" height="6.8" rx="1" />
                            <rect x="80.4" y="45.6" width="4.4" height="6.8" rx="1" />
                            <rect x="85" y="45.6" width="4.4" height="6" rx="1" />
                        </g>
                    </g>
                    {/* cranium */}
                    <path d="M59 31 C59 14 69 5.5 80 5.5 C91 5.5 101 14 101 31 C101 38 98.5 42 95 44.6 V48 C95 50.6 93 52 90.5 52 H69.5 C67 52 65 50.6 65 48 V44.6 C61.5 42 59 38 59 31Z"
                        fill={INK} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
                    <path d="M59 31 C59 14 69 5.5 80 5.5 C91 5.5 101 14 101 31 C101 38 98.5 42 95 44.6 V48 C95 50.6 93 52 90.5 52 H69.5 C67 52 65 50.6 65 48 V44.6 C61.5 42 59 38 59 31Z"
                        fill={`url(#${id}-skull)`} />
                    {/* forehead sheen + cracks */}
                    <path d="M66 17 C69 11 75 8.6 80 8.6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
                    <path d="M90 10 L86 17 L89 21 L85 27" fill="none" stroke="#b69f74" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                    {/* cheekbone shading */}
                    <path d="M60.5 38 C62 42 65 44 68 44.6" fill="none" stroke={SHADE} strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M99.5 38 C98 42 95 44 92 44.6" fill="none" stroke={SHADE} strokeWidth="1.3" strokeLinecap="round" />
                    {/* worried brows — inner ends raised */}
                    <path d="M62 22.5 L72.5 18.5" stroke="#6d4b8f" strokeWidth="2" strokeLinecap="round" />
                    <path d="M98 22.5 L87.5 18.5" stroke="#6d4b8f" strokeWidth="2" strokeLinecap="round" />
                    {/* eye sockets: wide with tiny glowing pupils looking BACK */}
                    <ellipse cx="70" cy="31" rx="8.2" ry="9.2" fill={`url(#${id}-socket)`} stroke={INK} strokeWidth="1.2" />
                    <ellipse cx="90" cy="31" rx="8.2" ry="9.2" fill={`url(#${id}-socket)`} stroke={INK} strokeWidth="1.2" />
                    <g className="hw-sk-pupils">
                        <circle cx="66.6" cy="31" r="3.1" fill="#fff6c9" />
                        <circle cx="86.6" cy="31" r="3.1" fill="#fff6c9" />
                        <circle cx="66.2" cy="30.4" r="1.2" fill="#2b1840" />
                        <circle cx="86.2" cy="30.4" r="1.2" fill="#2b1840" />
                    </g>
                    {/* nose cavity */}
                    <path d="M80 38.4 C77.6 41.4 76 44.4 77.2 45.8 C78.4 44.8 79.4 44.6 80 45.4 C80.6 44.6 81.6 44.8 82.8 45.8 C84 44.4 82.4 41.4 80 38.4Z" fill="#1a0b2b" />
                    {/* upper teeth */}
                    <g fill="#fffdf2" stroke={INK} strokeWidth="0.8">
                        <rect x="68.4" y="44.4" width="4.6" height="6.6" rx="1" />
                        <rect x="73.2" y="44.4" width="4.6" height="7.6" rx="1" />
                        <rect x="78" y="44.4" width="4.2" height="7.6" rx="1" />
                        <rect x="82.6" y="44.4" width="4.6" height="7.6" rx="1" />
                        <rect x="87.4" y="44.4" width="4.6" height="6.6" rx="1" />
                    </g>
                </g>
            </g>

            {/* ---------- panic: sweat drops + stress marks (in front) ---------- */}
            <g className="hw-sk-sweat">
                <path className="hw-sk-drop hw-sk-drop-1" d="M57 20 C54 25 52.6 27.6 54.6 29.8 C56.8 31.4 59.4 29.6 59 27 C58.8 25 57.8 22.8 57 20Z" fill="#9fe6ff" stroke="#2b6a86" strokeWidth="0.8" />
                <path className="hw-sk-drop hw-sk-drop-2" d="M50 38 C48 41 47 42.8 48.4 44.2 C49.9 45.2 51.6 44 51.4 42.4 C51.2 41 50.6 39.6 50 38Z" fill="#9fe6ff" stroke="#2b6a86" strokeWidth="0.8" />
                <path className="hw-sk-drop hw-sk-drop-3" d="M104 10 C102 13.4 101 15 102.4 16.4 C103.9 17.4 105.6 16.2 105.4 14.6 C105.2 13.2 104.6 11.8 104 10Z" fill="#9fe6ff" stroke="#2b6a86" strokeWidth="0.8" />
            </g>
        </svg>
    );
}
