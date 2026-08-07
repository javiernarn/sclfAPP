import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import siteLogo from '../../assets/images/site-logo.png';
import './StyledQrCode.css';

/**
 * Renders a QR code styled to match the school's official branded QR
 * (rounded dot modules, rounded-square finder eyes, navy ink, a white
 * roundel with the school logo in the center, plus a title/subtitle
 * caption baked right into the exported image) — entirely client-side,
 * on a <canvas>, so it works with no network once the page has loaded.
 *
 * `value` is the ONLY thing encoded into the actual QR matrix. Title and
 * subtitle are decorative text painted below it, not part of the code.
 *
 * The code visibly "assembles" itself dot by dot over `generateDurationMs`
 * (default 7s) instead of appearing all at once — so on a real device the
 * person sees continuous progress the whole time instead of a sudden pop
 * that can read as a freeze/crash.
 */
export default function StyledQrCode({
    value,
    title = 'SCLF - Opol Community College',
    subtitle = '',
    size = 480,
    color = '#1B1F3B',
    logoSrc = siteLogo,
    downloadName = 'release-qr.png',
    showDownloadButton = true,
    generateDurationMs = 7000,
}) {
    const canvasRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!value) return;
        let cancelled = false;
        setReady(false);
        setProgress(0);
        setError('');

        (async () => {
            try {
                await renderStyledQr({
                    canvas: canvasRef.current,
                    value, title, subtitle, size, color, logoSrc,
                    duration: generateDurationMs,
                    onProgress: (p) => { if (!cancelled) setProgress(p); },
                });
                if (!cancelled) setReady(true);
            } catch (e) {
                if (!cancelled) setError('Could not render the QR code on this device.');
            }
        })();

        return () => { cancelled = true; };
    }, [value, title, subtitle, size, color, logoSrc, generateDurationMs]);

    const download = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const triggerDownload = (href, revoke) => {
            const link = document.createElement('a');
            link.download = downloadName;
            link.href = href;
            // Firefox (and some other browsers) only honor a synthetic
            // click on an <a download> if the element is actually in the
            // document — clicking a detached node silently does nothing,
            // which is exactly the "I clicked it but nothing happens" bug.
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            if (revoke) setTimeout(() => URL.revokeObjectURL(href), 1000);
        };

        try {
            triggerDownload(canvas.toDataURL('image/png'), false);
        } catch (e) {
            // toDataURL() throws if the canvas got "tainted" (e.g. the
            // logo image loaded cross-origin without CORS headers).
            // toBlob() + an object URL still works in that case for most
            // browsers; if even that fails, tell the person plainly.
            canvas.toBlob((blob) => {
                if (!blob) {
                    setError('Could not download the QR code on this device.');
                    return;
                }
                triggerDownload(URL.createObjectURL(blob), true);
            }, 'image/png');
        }
    };

    const pct = Math.round(progress * 100);

    return (
        <div className="sclf-qr-wrap">
            <div className="sclf-qr-canvas-frame">
                <canvas ref={canvasRef} className={`sclf-qr-canvas ${ready ? 'is-ready' : 'is-building'}`} />
                {!ready && !error && (
                    <div className="sclf-qr-progress-overlay" role="status" aria-live="polite">
                        <div className="sclf-qr-progress-track">
                            <div className="sclf-qr-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="sclf-qr-progress-label">Generating your QR… {pct}%</span>
                    </div>
                )}
            </div>
            {error && <div className="ds-error">{error}</div>}
            {ready && showDownloadButton && (
                <button type="button" className="ds-btn ds-btn-primary" onClick={download}>
                    <Download size={16} /> Download QR (PNG)
                </button>
            )}
        </div>
    );
}

async function renderStyledQr({ canvas, value, title, subtitle, size, color, logoSrc, duration = 7000, onProgress }) {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'H' });
    const modules = qr.modules;
    const count = modules.size;

    const qrSize = size;
    const cell = qrSize / count;
    const captionH = title ? Math.round(size * 0.11) : 0;
    const subH = subtitle ? Math.round(size * 0.06) : 0;
    const topPad = Math.round(size * 0.06); // was 0.04 — thicker quiet zone around the QR itself
    const totalH = qrSize + topPad * 2 + captionH + subH;

    // Set real pixel dimensions up front (even though drawing happens
    // progressively below) so the canvas never sits at the browser's
    // default 300x150 box for a frame — that would show as a layout
    // jump right as the build animation kicks in.
    canvas.width = qrSize + topPad * 2;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    const offsetX = topPad;
    const offsetY = topPad;

    const isFinder = (r, c) => {
        const fs = 7;
        const inTL = r < fs && c < fs;
        const inTR = r < fs && c >= count - fs;
        const inBL = r >= count - fs && c < fs;
        return inTL || inTR || inBL;
    };

    // Reserve a square in the middle for the logo (only if one is supplied).
    // 26% of the grid keeps well within the ~30% damage budget that
    // error-correction level "H" tolerates.
    const logoModules = logoSrc ? Math.floor(count * 0.26) : 0;
    const logoStart = Math.floor((count - logoModules) / 2);
    const logoEnd = logoStart + logoModules;
    const inLogoZone = (r, c) => logoSrc && r >= logoStart && r < logoEnd && c >= logoStart && c < logoEnd;

    // Finder eyes — rounded squares, three corners.
    // IMPORTANT: a QR finder eye must keep the standard 1:1:3:1:1
    // black/white/black/white/black ratio across its 7-module width
    // (1 module border, 1 module white ring, 3 module core, mirrored).
    // Every real decoder — the browser's native BarcodeDetector, zbar,
    // OpenCV, and the JS jsQR-derived library this app falls back to —
    // locates a QR purely by scanning for that exact stripe ratio. The
    // previous insets (1.4 / 2.4 cell) produced a ~1.4:1:2.2:1:1.4
    // ratio, which is off enough that decoders can't find the finder
    // pattern at all — that's the actual cause of "Could not find a QR
    // code", independent of upload vs. camera or which decoder path
    // runs. Corner rounding is also capped low (8%) because rounding it
    // heavily (the old 28%) erodes the same stripe near the corners
    // enough to still break decoding even once the ratio is correct.
    const drawFinder = (originR, originC) => {
        const outerPx = 7 * cell;
        const x = offsetX + originC * cell;
        const y = offsetY + originR * cell;
        const cornerRadiusFactor = 0.08; // was 0.28 — too rounded to decode reliably

        roundRectPath(ctx, x, y, outerPx, outerPx, outerPx * cornerRadiusFactor);
        ctx.fillStyle = color;
        ctx.fill();

        const ringInset = cell * 1; // was 1.4 — must be exactly 1 module
        roundRectPath(ctx, x + ringInset, y + ringInset, outerPx - ringInset * 2, outerPx - ringInset * 2, (outerPx - ringInset * 2) * cornerRadiusFactor);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        const dotInset = cell * 2; // was 2.4 — must leave exactly a 3-module core
        roundRectPath(ctx, x + dotInset, y + dotInset, outerPx - dotInset * 2, outerPx - dotInset * 2, (outerPx - dotInset * 2) * cornerRadiusFactor);
        ctx.fillStyle = color;
        ctx.fill();
    };

    // Collect every data-dot position up front, then shuffle the draw
    // order so the reveal reads as the code "assembling itself" rather
    // than a mechanical left-to-right scan.
    const dots = [];
    for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
            if (!modules.get(r, c)) continue;
            if (isFinder(r, c)) continue;
            if (inLogoZone(r, c)) continue;
            dots.push({ r, c });
        }
    }
    shuffle(dots);

    // Preload the logo once (if any) so each animation frame is just a
    // cheap drawImage call instead of re-decoding the file every time.
    let logoImg = null;
    if (logoSrc) {
        try { logoImg = await loadImage(logoSrc); } catch (e) { logoImg = null; }
    }

    const drawDot = (r, c) => {
        const cx = offsetX + c * cell + cell / 2;
        const cy = offsetY + r * cell + cell / 2;
        ctx.beginPath();
        // 0.48 (was 0.32, then 0.4 — still not enough): verified by
        // rendering this exact function in Node and feeding the PNG to
        // jsQR (the same decoder qr-scanner uses client-side, and the
        // one this app's camera/upload flow is built on). At 0.4, and
        // even at 0.44, decoding fails on a perfectly clean, zero-noise
        // render — the gap between adjacent same-color dots is still
        // wide enough that jsQR's binarizer sees noise instead of a
        // solid run. 0.45 is the exact pass threshold; 0.48 decodes
        // reliably with margin, including after simulated camera blur,
        // downscaling, and JPEG recompression. This — not camera
        // quality, screenshots, or the logo — was the actual cause of
        // "Could not find a QR code" / the decode-image 422s.
        ctx.arc(cx, cy, cell * 0.48, 0, Math.PI * 2);
        ctx.fill();
    };

    const drawLogoRoundel = () => {
        if (!(logoSrc && logoModules > 0)) return;
        const zonePx = logoModules * cell;
        const zoneX = offsetX + logoStart * cell;
        const zoneY = offsetY + logoStart * cell;

        roundRectPath(ctx, zoneX, zoneY, zonePx, zonePx, zonePx * 0.2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        if (logoImg) {
            try {
                ctx.save();
                const inset = zonePx * 0.1;
                roundRectPath(ctx, zoneX + inset, zoneY + inset, zonePx - inset * 2, zonePx - inset * 2, (zonePx - inset * 2) * 0.16);
                ctx.clip();
                ctx.drawImage(logoImg, zoneX + inset, zoneY + inset, zonePx - inset * 2, zonePx - inset * 2);
                ctx.restore();
            } catch (e) {
                // Logo failed to draw — the QR still scans fine without it.
            }
        }
    };

    const drawCaption = () => {
        ctx.textAlign = 'center';
        if (title) {
            ctx.fillStyle = color;
            ctx.font = `700 ${Math.round(size * 0.05)}px 'Inter', system-ui, sans-serif`;
            ctx.fillText(title, canvas.width / 2, qrSize + offsetY * 2 + captionH * 0.62, canvas.width - topPad * 2);
        }
        if (subtitle) {
            ctx.fillStyle = '#6B6558';
            ctx.font = `500 ${Math.round(size * 0.028)}px 'Inter', system-ui, sans-serif`;
            ctx.fillText(subtitle, canvas.width / 2, qrSize + offsetY * 2 + captionH + subH * 0.65, canvas.width - topPad * 2);
        }
    };

    // A full frame redraw: background, finder eyes (always shown as
    // anchors), the dots revealed so far, and — once the reveal is
    // basically done — the logo roundel and caption fading in on top.
    const drawFrame = (revealCount, showFinishingTouches) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = color;
        drawFinder(0, 0);
        drawFinder(0, count - 7);
        drawFinder(count - 7, 0);

        ctx.fillStyle = color;
        for (let i = 0; i < revealCount; i++) {
            drawDot(dots[i].r, dots[i].c);
        }

        if (showFinishingTouches) {
            drawLogoRoundel();
            drawCaption();
        }
    };

    const prefersReducedMotion = typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        drawFrame(dots.length, true);
        if (onProgress) onProgress(1);
        return;
    }

    // First paintable frame, right away — background + finder eyes so
    // there's never a blank canvas while the animation loop spins up.
    drawFrame(0, false);
    if (onProgress) onProgress(0);

    await new Promise((resolve) => {
        const start = performance.now();
        const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(1, elapsed / duration);
            const revealCount = Math.floor(progress * dots.length);
            drawFrame(revealCount, progress >= 0.92);
            if (onProgress) onProgress(progress);

            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                resolve();
            }
        };
        requestAnimationFrame(tick);
    });
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Defensive: if this logo ever gets served from a different
        // origin, this keeps the canvas "untainted" so toDataURL()/PNG
        // download still works instead of throwing a SecurityError.
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
