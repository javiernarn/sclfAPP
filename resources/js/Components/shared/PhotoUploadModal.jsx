import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle, Camera, Check, ChevronDown, Eye, Image as ImageIcon, Loader2, RefreshCw,
    ShieldCheck, Sparkles, Sun, Upload, User, X,
} from '../icons';
import { checkProfilePhoto, preloadFaceModels, PHOTO_RULES } from '../../utils/photoCheck';
import { useAppTheme } from '../../hooks/useAppTheme';
import './Popups.css';
import './PhotoUploadModal.css';

/**
 * Pop-up shown whenever someone chooses a profile photo (registration, first-time
 * setup, and admin create / edit user). It uses the same popup look as the
 * confirm dialogs (themed surface, outline, accent button).
 *
 *   1. "guide"    — what a valid photo looks like. The person ticks that they
 *                   understand before the file picker opens.
 *   2. "checking" — the photo is analysed in the browser (see utils/photoCheck.js).
 *   3. "result"   — pass: preview + "Use this photo". Fail: the photo with a
 *                   guide drawn on it (where the face is vs where it should be)
 *                   and one card per problem saying how to fix it. The photo is
 *                   NOT handed to the page, so the form can't move on with it.
 *
 * Props: open, onClose, onAccept(file).
 */

const STEPS = [
    ['file', 'Reading your photo'],
    ['ai', 'Looking for AI and editing tags'],
    ['face', 'Finding your face'],
    ['quality', 'Checking framing, light, background and hands'],
];

// What the photo must have — one short line each, with the icon people recognise it by.
const MUST = [
    [ImageIcon, 'Plain white or light wall', 'Nothing hanging or standing behind you.'],
    [User, 'Face in the middle', 'Head and shoulders centred, looking straight at the camera.'],
    [Eye, 'Forehead and eyes clear', 'No cap, hat, headband, sunglasses or mask.'],
    [Sun, 'Sharp and evenly lit', 'In focus, at least 400 × 400 px, under 5 MB.'],
    [Camera, 'Real, unedited photo', 'Straight from a camera. No filters, retouching or AI.'],
];
const NOT = ['Holding an ID card, paper or phone', 'Hands or arms in front of you', 'Selfie with others', 'Cartoon or AI image'];

// Icon shown on each problem card.
const CHECK_ICON = {
    type: ImageIcon, bytes: ImageIcon, readable: ImageIcon, resolution: ImageIcon,
    ai: Sparkles, edited: Sparkles, detector: RefreshCw,
    face: User, framing: User, size: User, pose: Eye, eyes: Eye, headwear: User,
    sharp: Camera, light: Sun, background: ImageIcon, held: AlertTriangle,
};

/** True on phones and tablets (a finger is the main pointer): shows the camera button. */
function useCoarsePointer() {
    const q = '(pointer: coarse)';
    const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
    const [coarse, setCoarse] = useState(get);
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return undefined;
        const mq = window.matchMedia(q);
        const on = (e) => setCoarse(e.matches);
        if (mq.addEventListener) { mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }
        mq.addListener(on); return () => mq.removeListener(on);
    }, []);
    return coarse;
}

/** A real example of a correct photo, with the guide drawn on top of it. */
function SampleGuide() {
    return (
        <figure className="pum-sample">
            <div className="pum-sample-frame">
                <img src="/images/photo-example.jpg" alt="Example of a correct photo: head and shoulders in the middle, plain white wall, nothing in the hands" width="400" height="400" />
                <svg viewBox="0 0 200 200" aria-hidden="true">
                    <line className="pum-s-axis" x1="100" y1="0" x2="100" y2="200" />
                    <ellipse className="pum-s-zone" cx="97" cy="88" rx="48" ry="68" />
                    <g className="pum-s-tag"><rect x="124" y="10" width="68" height="20" rx="10" /><text x="158" y="24" textAnchor="middle">Centred</text></g>
                </svg>
            </div>
            <figcaption>Head and shoulders in the middle, plain white wall.</figcaption>
        </figure>
    );
}

/** The photo with a guide on top: where the face is, and where it should be. */
function GuidedPhoto({ url, face, framingOk, tone, onRatio, ratio }) {
    const R = PHOTO_RULES;
    return (
        <div className={`pum-photo ${tone}`} style={{ '--ar': ratio || 0.75 }}>
            <img src={url} alt="Your selected photo" onLoad={(e) => onRatio(e.target.naturalWidth / e.target.naturalHeight)} />
            {face && (
                <svg className="pum-overlay" viewBox={`0 0 ${face.W} ${face.H}`} preserveAspectRatio="none" aria-hidden="true">
                    {/* the middle band the face should sit in */}
                    <rect className="pum-ov-band" x={face.W * R.centerX[0]} y="0" width={face.W * (R.centerX[1] - R.centerX[0])} height={face.H} />
                    <line className="pum-ov-axis" x1={face.W / 2} y1="0" x2={face.W / 2} y2={face.H} />
                    <rect
                        className={`pum-ov-face ${framingOk ? 'ok' : 'bad'}`}
                        x={face.box.x} y={face.box.y} width={face.box.width} height={face.box.height} rx={face.W * 0.02}
                    />
                    <circle className={`pum-ov-dot ${framingOk ? 'ok' : 'bad'}`} cx={face.box.x + face.box.width / 2} cy={face.box.y + face.box.height / 2} r={face.W * 0.012} />
                </svg>
            )}
            {face && (
                <span className={`pum-photo-key ${framingOk ? 'ok' : 'bad'}`}>
                    {framingOk ? 'Face is in the middle' : 'Face is off-centre'}
                </span>
            )}
        </div>
    );
}

export default function PhotoUploadModal({ open, onClose, onAccept }) {
    const { theme } = useAppTheme();
    const [stage, setStage] = useState('guide'); // guide | checking | result
    const [agreed, setAgreed] = useState(false);
    const [step, setStep] = useState('file');
    const [result, setResult] = useState(null);
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [ratio, setRatio] = useState(null);
    const [drag, setDrag] = useState(0);
    const coarse = useCoarsePointer();
    const inputRef = useRef(null);
    const camRef = useRef(null);
    const startY = useRef(null);
    const runId = useRef(0);

    const reset = useCallback(() => {
        runId.current += 1;
        setStage('guide'); setAgreed(false); setResult(null); setFile(null); setRatio(null); setDrag(0);
        setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    }, []);

    // Warm up the face models while the person reads the guide.
    useEffect(() => {
        if (!open) return;
        reset();
        preloadFaceModels().catch(() => {});
    }, [open, reset]);

    useEffect(() => {
        if (!open) return undefined;
        // Capture phase + stopPropagation: Esc closes only this pop-up, not the
        // admin dialog it was opened from.
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
        document.addEventListener('keydown', onKey, true);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey, true); document.body.style.overflow = prev; };
    }, [open, onClose]);

    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

    const run = useCallback(async (f) => {
        const id = ++runId.current;
        setFile(f);
        setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(f); });
        setResult(null); setStep('file'); setStage('checking');
        const res = await checkProfilePhoto(f, (s) => { if (id === runId.current) setStep(s); });
        if (id !== runId.current) return;
        setResult(res); setStage('result');
    }, []);

    const onPick = (e) => {
        const f = e.target.files?.[0];
        e.target.value = ''; // so choosing the same file again re-runs the check
        if (f) run(f);
    };
    const choose = () => inputRef.current?.click();       // gallery / files
    const takePhoto = () => camRef.current?.click();       // front camera on phones

    // Swipe the header down to close the bottom sheet (phones, portrait).
    const isSheet = () => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches;
    const onTouchStart = (e) => { if (isSheet()) startY.current = e.touches[0].clientY; };
    const onTouchMove = (e) => {
        if (startY.current == null) return;
        const dy = e.touches[0].clientY - startY.current;
        setDrag(dy > 0 ? dy : 0);
    };
    const onTouchEnd = () => {
        const far = drag > 110;
        startY.current = null; setDrag(0);
        if (far) onClose();
    };

    if (!open) return null;

    const failed = result ? result.checks.filter((c) => !c.pass) : [];
    const passed = result ? result.checks.filter((c) => c.pass) : [];
    const retryable = failed.some((c) => c.id === 'detector');
    const framing = result?.checks.find((c) => c.id === 'framing');
    const stepIndex = Math.max(0, STEPS.findIndex(([k]) => k === step));

    const title = stage === 'guide' ? 'Add your profile photo'
        : stage === 'checking' ? 'Checking your photo…'
            : result?.ok ? 'Your photo looks good'
                : `${failed.length} thing${failed.length === 1 ? '' : 's'} to fix`;
    const sub = stage === 'guide' ? 'Staff and security use it to recognise you, so it has to be a clear, plain ID-style picture.'
        : stage === 'checking' ? 'This happens on your device. Your photo is not uploaded yet.'
            : result?.skipped ? 'Photo checks are turned off. Staff may still review it.'
            : result?.ok ? 'It meets every requirement. Staff may still review it.'
                : 'Fix these and choose the photo again. The photo was not used.';

    return createPortal(
        <div className="pum-backdrop" role="presentation">
            <div
                className={`pum-card sclf-popup${drag ? ' dragging' : ''}`}
                data-sclf-theme={theme} role="dialog" aria-modal="true" aria-labelledby="pum-title"
                style={drag ? { transform: `translateY(${drag}px)` } : undefined}
            >
                <div className="pum-grab" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
                    <span className="pum-handle" aria-hidden="true" />
                </div>
                <div className="pum-head" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
                    <span className={`pum-badge ${stage === 'result' ? (result?.ok ? 'ok' : 'bad') : ''}`} aria-hidden="true">
                        {stage === 'result' ? (result?.ok ? <Check size={20} /> : <AlertTriangle size={20} />) : stage === 'checking' ? <Loader2 size={20} /> : <Camera size={20} />}
                    </span>
                    <div className="pum-head-text">
                        <h3 id="pum-title" className="pum-title">{title}</h3>
                        <p className="pum-sub">{sub}</p>
                    </div>
                    <button type="button" className="pum-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </div>

                <input name="photo" ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} hidden />
                <input name="photo_camera" ref={camRef} type="file" accept="image/*" capture="user" onChange={onPick} hidden />

                {stage === 'guide' && (
                    <>
                        <div className="pum-body pum-guide">
                            <SampleGuide />
                            <div className="pum-req">
                                <ul className="pum-req-list">
                                    {MUST.map(([Icon, head, text]) => (
                                        <li key={head}>
                                            <span className="pum-req-ico"><Icon size={16} /></span>
                                            <span><strong>{head}</strong><small>{text}</small></span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="pum-not">
                                    <span className="pum-not-label">Not accepted</span>
                                    {NOT.map((t) => <span key={t} className="pum-chip"><X size={11} />{t}</span>)}
                                </div>
                            </div>
                        </div>
                        <div className="pum-note">
                            <ShieldCheck size={15} />
                            <span>The check runs in your browser. It can find AI and editing tags saved in the file, but cannot prove a picture is untouched, so staff also review photos.</span>
                        </div>
                        <div className="pum-foot">
                            <label className="pum-agree">
                                <input name="photo_consent" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                                <span>My photo meets these requirements</span>
                            </label>
                            <div className="pum-actions">
                                {!coarse && <button type="button" className="pum-btn ghost" onClick={onClose}>Cancel</button>}
                                {coarse && (
                                    <button type="button" className="pum-btn ghost" onClick={choose} disabled={!agreed}>
                                        <ImageIcon size={15} /> From gallery
                                    </button>
                                )}
                                <button type="button" className="pum-btn primary" onClick={coarse ? takePhoto : choose} disabled={!agreed}>
                                    {coarse ? <><Camera size={15} /> Take photo</> : <><Upload size={15} /> Choose photo</>}
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {stage === 'checking' && (
                    <div className="pum-body pum-checking">
                        {previewUrl && (
                            <div className="pum-photo scanning" style={{ '--ar': ratio || 0.75 }}>
                                <img src={previewUrl} alt="Your selected photo" onLoad={(e) => setRatio(e.target.naturalWidth / e.target.naturalHeight)} />
                                <span className="pum-scan" aria-hidden="true" />
                            </div>
                        )}
                        <div className="pum-progress">
                            <div className="pum-bar" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={stepIndex + 1}>
                                <span style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
                            </div>
                            <ol className="pum-steps" aria-live="polite">
                                {STEPS.map(([id, label], i) => {
                                    const state = i < stepIndex ? 'done' : i === stepIndex ? 'now' : 'todo';
                                    return (
                                        <li key={id} className={state}>
                                            <span className="pum-step-ico">
                                                {state === 'done' ? <Check size={13} /> : state === 'now' ? <span className="pum-spin"><Loader2 size={13} /></span> : null}
                                            </span>
                                            {label}
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    </div>
                )}

                {stage === 'result' && result && (
                    <>
                        <div className="pum-body pum-result">
                            {previewUrl && (
                                <GuidedPhoto
                                    url={previewUrl}
                                    face={result.face}
                                    framingOk={framing ? framing.pass : true}
                                    tone={result.ok ? 'good' : 'bad'}
                                    ratio={ratio}
                                    onRatio={setRatio}
                                />
                            )}
                            <div className="pum-checks">
                                {failed.length > 0 && (
                                    <ul className="pum-problems">
                                        {failed.map((c) => {
                                            const Icon = CHECK_ICON[c.id] || AlertTriangle;
                                            return (
                                                <li key={c.id}>
                                                    <span className="pum-prob-ico"><Icon size={16} /></span>
                                                    <span><strong>{c.label}</strong><small>{c.fix}</small></span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                {passed.length > 0 && (
                                    <details className="pum-passed" open={result.ok}>
                                        <summary><Check size={14} /> {passed.length} check{passed.length === 1 ? '' : 's'} passed <ChevronDown size={14} className="pum-chev" /></summary>
                                        <ul>{passed.map((c) => <li key={c.id}><Check size={13} />{c.label}</li>)}</ul>
                                    </details>
                                )}
                                {result.ok && <p className="pum-fine">Use a recent photo of you in neat, formal wear.</p>}
                            </div>
                        </div>
                        <div className="pum-foot">
                            <div className="pum-actions">
                                {!result.ok && <button type="button" className="pum-btn ghost" onClick={reset}>See requirements</button>}
                                {retryable && file && <button type="button" className="pum-btn ghost" onClick={() => run(file)}>Try again</button>}
                                {coarse && (
                                    <button type="button" className="pum-btn ghost" onClick={choose}>
                                        <ImageIcon size={15} /> From gallery
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={`pum-btn ${result.ok ? 'ghost' : 'primary'}`}
                                    onClick={coarse ? takePhoto : choose}
                                >
                                    {coarse ? <><Camera size={15} /> {result.ok ? 'Retake' : 'Take a new photo'}</> : <><Upload size={15} /> {result.ok ? 'Choose a different photo' : 'Choose another photo'}</>}
                                </button>
                                {result.ok && (
                                    <button type="button" className="pum-btn primary" onClick={() => { onAccept(result.file || file); onClose(); }}>
                                        <Check size={15} /> Use this photo
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}
