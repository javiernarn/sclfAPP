import React, { useEffect, useId, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { flushSync } from 'react-dom';
import { HW } from './art';
import SkeletonArt from './SkeletonArt';

/**
 * GraveCrew — skeletons that dig themselves out of buried coffins, grab a sack
 * of bones, panic and run off the left or right side of the screen.
 *
 *   closed  -> the coffin lid is shut, the grave is just decoration
 *   shake   -> the lid rattles, dust jumps
 *   open    -> the lid slides aside, eerie light pours out of the hole
 *   rise    -> the skeleton climbs out of the ground (clipped at the surface)
 *   run     -> he bolts left or right with his loot, dropping a bone on the way
 *   empty   -> empty open coffin for a moment
 *   closing -> the lid slides shut again, ready for the next one
 *
 * Phases are written to data-phase so seasons.css does all the drawing; this
 * file only decides WHO goes, WHEN and WHICH WAY. Everything is cleaned up on
 * unmount and nothing runs while the tab is hidden or when the person asked
 * the OS for reduced motion.
 */

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------- grave art
function GraveBack({ gid }) {
    return (
        <svg className="hw-grave-back" viewBox="0 0 120 40" preserveAspectRatio="none" focusable="false">
            <defs>
                <radialGradient id={`${gid}-hole`} cx="0.5" cy="0.55" r="0.6">
                    <stop offset="0" stopColor="#020005" />
                    <stop offset="0.7" stopColor="#0d0517" />
                    <stop offset="1" stopColor="#1d0d2e" />
                </radialGradient>
            </defs>
            {/* back wall of soil, then the dark hole */}
            <ellipse cx="60" cy="19" rx="56" ry="17" className="hw-soil" />
            <ellipse cx="60" cy="20" rx="50" ry="14" fill={`url(#${gid}-hole)`} />
            {/* a few clods on the far edge */}
            <g className="hw-soil-hi">
                <ellipse cx="22" cy="9" rx="6" ry="3.2" /><ellipse cx="38" cy="5.6" rx="5" ry="2.6" />
                <ellipse cx="84" cy="5.8" rx="6.4" ry="3" /><ellipse cx="100" cy="10" rx="5" ry="2.8" />
            </g>
        </svg>
    );
}

function GraveFront({ gid }) {
    return (
        <svg className="hw-grave-front" viewBox="0 0 120 40" preserveAspectRatio="none" focusable="false">
            {/* front lip of the hole: lumpy soil crescent that hides the skeleton's feet */}
            <path className="hw-soil" d="M2 21 C4 25 12 32 26 35.4 C42 38.8 78 38.8 94 35.4 C108 32 116 25 118 21 C119 28 112 38 98 40 H22 C8 38 1 28 2 21Z" />
            <path className="hw-soil-hi" d="M8 27 C14 33 26 37 40 38 C32 40 18 37 8 31Z M112 27 C106 33 94 37 80 38 C88 40 102 37 112 31Z" />
            {/* tufts of dead grass + two pebbles */}
            <g className="hw-grass" fill="none" strokeLinecap="round">
                <path d="M6 30 L3 22 M9 31 L9 20 M12 32 L15 23" />
                <path d="M108 32 L105 23 M111 31 L112 21 M114 30 L118 23" />
            </g>
            <ellipse cx="30" cy="35" rx="3" ry="1.8" className="hw-pebble" />
            <ellipse cx="88" cy="36" rx="2.4" ry="1.5" className="hw-pebble" />
        </svg>
    );
}

function CoffinLid({ gid }) {
    return (
        <svg className="hw-grave-lid" viewBox="0 0 112 48" focusable="false">
            <defs>
                <linearGradient id={`${gid}-wood`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#7a4d32" />
                    <stop offset="0.5" stopColor="#5a3624" />
                    <stop offset="1" stopColor="#40261a" />
                </linearGradient>
            </defs>
            {/* thickness */}
            <path d="M1 20 L26 7 L108 17 L108 37 L26 47 L1 34Z" fill="#1e100b" />
            {/* top face */}
            <path d="M1 15 L26 2 L108 12 L108 32 L26 42 L1 29Z" fill={`url(#${gid}-wood)`} stroke="#1e100b" strokeWidth="1.6" strokeLinejoin="round" />
            {/* bevelled inner panel */}
            <path d="M8 17 L28 7 L100 15.6 L100 28.4 L28 37 L8 27Z" fill="none" stroke="#9b6a46" strokeWidth="1.2" opacity="0.75" strokeLinejoin="round" />
            <path d="M8 17 L28 7 L100 15.6 L100 28.4 L28 37 L8 27Z" fill="#4a2c1d" opacity="0.55" />
            {/* plank grain */}
            <g stroke="#2d1a11" strokeWidth="0.8" opacity="0.7" fill="none" strokeLinecap="round">
                <path d="M34 9 L96 16.4" /><path d="M32 22 L98 22" /><path d="M34 35 L96 28" />
                <path d="M44 14 C48 15 52 15 56 14.6" /><path d="M70 30 C74 29.6 78 29.8 82 30.6" />
            </g>
            {/* bone cross emblem */}
            <g transform="translate(58 22)">
                <rect x="-2.4" y="-12" width="4.8" height="24" rx="2.4" fill="#2b1840" />
                <rect x="-12" y="-4" width="24" height="4.8" rx="2.4" fill="#2b1840" transform="translate(0 1.6)" />
                <rect x="-1.5" y="-11" width="3" height="22" rx="1.5" fill="#f3e7cd" />
                <rect x="-11" y="-2.4" width="22" height="3" rx="1.5" fill="#f3e7cd" transform="translate(0 1.6)" />
            </g>
            {/* nails */}
            <g fill="#c9b48d" stroke="#2b1840" strokeWidth="0.7">
                <circle cx="12" cy="22" r="1.6" /><circle cx="29" cy="12" r="1.6" /><circle cx="29" cy="33" r="1.6" />
                <circle cx="97" cy="19.4" r="1.6" /><circle cx="97" cy="25" r="1.6" />
            </g>
        </svg>
    );
}

// ---------------------------------------------------------------- one grave
const DUST = Array.from({ length: 9 }, (_, i) => ({
    x: -46 + i * 11.5 + (i % 2 ? 4 : -3),
    dx: (i - 4) * 9,
    h: 26 + ((i * 37) % 30),
    d: 0.9 + ((i * 13) % 7) / 10,
    s: 4 + ((i * 5) % 5),
}));

const Grave = forwardRef(function Grave({ index, x, className = '' }, ref) {
    const gid = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    const rootRef = useRef(null);
    const runnerRef = useRef(null);
    const [phase, setPhase] = useState('closed');
    const [dir, setDir] = useState(1);
    const live = useRef({ alive: true, busy: false, timers: [], anim: null });

    const sleep = (ms) => new Promise((res) => {
        const t = setTimeout(res, ms);
        live.current.timers.push(t);
    });

    const reset = () => {
        const L = live.current;
        L.timers.forEach(clearTimeout);
        L.timers = [];
        if (L.anim) { try { L.anim.cancel(); } catch (e) { /* already gone */ } L.anim = null; }
        if (runnerRef.current) runnerRef.current.classList.remove('is-dropping');
    };

    const act = async (preferDir) => {
        const L = live.current;
        if (L.busy || !rootRef.current || !runnerRef.current) return;
        L.busy = true;
        const root = rootRef.current;
        const runner = runnerRef.current;
        const scene = root.closest('.hw-scene') || root.parentElement;
        const sceneBox = scene.getBoundingClientRect();
        const graveBox = root.getBoundingClientRect();
        const gx = graveBox.left + graveBox.width / 2 - sceneBox.left;

        // which way: usually toward the far side (a longer, better chase)
        let d = preferDir;
        if (!d) {
            const farRight = gx < sceneBox.width / 2;
            d = Math.random() < 0.62 ? (farRight ? 1 : -1) : (farRight ? -1 : 1);
        }
        setDir(d);

        const go = async (name, ms) => { if (!L.alive) return false; setPhase(name); await sleep(ms); return L.alive; };
        // Commit a phase to the DOM *now*. The runner is moved / cancelled through the Web
        // Animations API (outside React), so the data-phase attribute has to be in place
        // first or the skeleton shows for a frame in the wrong place / pose.
        const commit = (name) => { if (L.alive) flushSync(() => setPhase(name)); };

        if (!(await go('shake', 1000))) return;
        if (!(await go('open', 800))) return;
        if (!(await go('rise', 1500))) return;

        // ---- run: stride length matches ground speed so the feet don't skate
        const sw = runner.getBoundingClientRect().width || 90;
        const speedMul = rand(0.92, 1.18);
        const speed = sw * 1.85 * speedMul;                       // px / second
        const stride = clamp(0.5 / speedMul, 0.36, 0.6);          // seconds / full leg cycle
        const dist = d > 0 ? sceneBox.width - gx + sw + 50 : gx + sw + 50;
        const dur = (dist / speed) * 1000;
        runner.style.setProperty('--t', `${stride}s`);
        runner.style.setProperty('--back', `${Math.round(speed * 0.95)}px`);
        commit('run');
        if (!L.alive) return;
        L.anim = runner.animate(
            [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${d * dist}px,0,0)` }],
            { duration: dur, easing: 'linear', fill: 'forwards' },
        );
        L.timers.push(setTimeout(() => runner.classList.add('is-dropping'), dur * rand(0.22, 0.4)));
        try { await L.anim.finished; } catch (e) { return; }      // cancelled
        if (!L.alive) return;
        // Hide the runner (phase 'empty') BEFORE releasing the animation. Cancelling first
        // snapped him back onto the grave in his running pose for a frame or two.
        commit('empty');
        if (L.anim) { L.anim.cancel(); L.anim = null; }
        runner.classList.remove('is-dropping');

        await sleep(2600);
        if (!L.alive) return;
        if (!(await go('closing', 900))) return;
        setPhase('closed');
        L.busy = false;
    };

    useImperativeHandle(ref, () => ({
        busy: () => live.current.busy,
        visible: () => !!rootRef.current && rootRef.current.getBoundingClientRect().width > 0,
        start: (d) => act(d),
        // stop whatever is in progress and put the grave back to "lid shut" (otherwise a
        // cancelled run would leave the skeleton frozen where he stood)
        cancel: () => {
            reset();
            const L = live.current;
            const wasBusy = L.busy;
            L.busy = false;
            if (wasBusy && L.alive) setPhase('closed');
        },
    }));

    useEffect(() => {
        const L = live.current;
        L.alive = true;
        return () => { L.alive = false; reset(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div ref={rootRef} className={`hw-grave hw-grave-${index} ${className}`} data-phase={phase} data-dir={dir}
            style={{ left: `${x}%`, '--lid-s': -dir }}>
            <div className="hw-grave-glow" />
            <GraveBack gid={gid} />
            {/* the skeleton: clipped at the surface while he climbs out, free once he runs */}
            <div ref={runnerRef} className="hw-grave-runner">
                <div className="hw-sk-flip">
                    <div className="hw-sk-hop">
                        <SkeletonArt uid={`${gid}s`} />
                        <svg className="hw-sk-bang" viewBox="0 0 24 40" focusable="false">
                            <path d="M12 3 C7 3 5 7 5.6 12 L8 26 H16 L18.4 12 C19 7 17 3 12 3Z" fill="#ffcf3a" stroke="#2b1840" strokeWidth="2.2" strokeLinejoin="round" />
                            <circle cx="12" cy="33" r="3.8" fill="#ffcf3a" stroke="#2b1840" strokeWidth="2.2" />
                        </svg>
                    </div>
                </div>
                <div className="hw-sk-dropx">
                    <img className="hw-sk-dropbone" src={HW.bone} alt="" draggable="false" />
                </div>
            </div>
            <div className="hw-grave-dust" aria-hidden="true">
                {DUST.map((p, i) => (
                    <span key={i} style={{ left: `${50 + p.x}%`, '--dx': `${p.dx}px`, '--h': `${p.h}px`, '--d': `${p.d}s`, '--s': `${p.s}px` }} />
                ))}
            </div>
            <GraveFront gid={gid} />
            <div className="hw-grave-lidwrap"><CoffinLid gid={gid} /></div>
        </div>
    );
});

// ---------------------------------------------------------------- the crew
const LAYOUT = {
    full: [28, 47, 64],
    phone: [20, 50, 80],
};

export default function GraveCrew({ variant = 'auth' }) {
    const quiet = variant === 'dashboard';
    const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches);
    const refs = useRef([]);
    const spots = phone ? LAYOUT.phone : LAYOUT.full;

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 600px)');
        const on = (e) => setPhone(e.matches);
        mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
        return () => (mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on));
    }, []);

    useEffect(() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return undefined;
        let dead = false;
        const timers = [];
        const sleep = (ms) => new Promise((res) => timers.push(setTimeout(res, ms)));
        const maxAtOnce = quiet ? 1 : 2;
        const gap = quiet ? [7000, 13000] : variant === 'loading' ? [2200, 4200] : [3200, 6500];

        (async () => {
            await sleep(quiet ? 3500 : 1400);
            while (!dead) {
                if (document.hidden) { await sleep(1200); continue; }
                const all = refs.current.filter(Boolean);
                const busy = all.filter((g) => g.busy()).length;
                const idle = all.filter((g) => !g.busy() && g.visible());
                if (idle.length && busy < maxAtOnce) idle[Math.floor(Math.random() * idle.length)].start();
                await sleep(rand(gap[0], gap[1]));
            }
        })();

        return () => {
            dead = true;
            timers.forEach(clearTimeout);
            refs.current.forEach((g) => g && g.cancel());
        };
    }, [quiet, variant, phone]);

    return (
        <div className={`hw-crew${quiet ? ' is-quiet' : ''}`}>
            {spots.map((x, i) => (
                <Grave key={`${phone ? 'p' : 'd'}${i}`} index={i + 1} x={x} ref={(h) => { refs.current[i] = h; }} />
            ))}
        </div>
    );
}
