import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Expand, X, RotateCcw, RotateCw, FlipHorizontal, FlipVertical,
    ZoomIn, ZoomOut, RefreshCw,
} from '../icons';
import './ImageViewer.css';

/**
 * Fixed-size photo box that always shows the ENTIRE source image (never
 * crops it) plus a full-screen lightbox for a closer look, opened by
 * clicking/tapping the box or its "expand" button.
 *
 * The box itself (`className`, e.g. "ds-detail-photo-wrap") keeps
 * whatever size the caller already gives it — this component never
 * changes that. Only the image inside is fitted to it with
 * `object-fit: contain`, so instead of the photo being cropped to fill
 * the box, the whole photo is shown letterboxed within it.
 *
 * The lightbox adds rotate left/right, flip horizontal/vertical, zoom
 * in/out and reset — all keyboard- and touch-friendly, and responsive
 * down to small phone screens.
 */
export default function ImageViewer({ src, alt = '', className = '', style }) {
    const [open, setOpen] = useState(false);

    if (!src) return null;

    return (
        <>
            <div
                className={`iv-box ${className}`}
                style={style}
                role="button"
                tabIndex={0}
                aria-label={`View full image${alt ? ` of ${alt}` : ''}`}
                onClick={() => setOpen(true)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
            >
                <img src={src} alt={alt} />
                <span className="iv-expand-hint">
                    <Expand size={15} />
                </span>
            </div>
            {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
        </>
    );
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

function ImageLightbox({ src, alt, onClose }) {
    const [rotation, setRotation] = useState(0); // degrees, multiples of 90
    const [flipX, setFlipX] = useState(false);
    const [flipY, setFlipY] = useState(false);
    const [zoom, setZoom] = useState(1);
    const dragState = useRef(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    const reset = useCallback(() => {
        setRotation(0);
        setFlipX(false);
        setFlipY(false);
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    const rotateLeft = () => setRotation((r) => r - 90);
    const rotateRight = () => setRotation((r) => r + 90);
    const toggleFlipX = () => setFlipX((v) => !v);
    const toggleFlipY = () => setFlipY((v) => !v);
    const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
    const zoomOut = () => setZoom((z) => {
        const next = Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2));
        if (next === ZOOM_MIN) setPan({ x: 0, y: 0 });
        return next;
    });

    // Close on Escape; also handle a few shortcuts for desktop users.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') rotateLeft();
            else if (e.key === 'ArrowRight') rotateRight();
            else if (e.key === '+' || e.key === '=') zoomIn();
            else if (e.key === '-') zoomOut();
            else if (e.key === '0') reset();
        };
        document.addEventListener('keydown', onKey);
        // Lock background scroll while the lightbox is open.
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onClose]);

    // Simple drag-to-pan once zoomed in (mouse + touch).
    const onPointerDown = (e) => {
        if (zoom <= 1) return;
        const point = e.touches ? e.touches[0] : e;
        dragState.current = { startX: point.clientX, startY: point.clientY, origin: pan };
    };
    const onPointerMove = (e) => {
        if (!dragState.current) return;
        const point = e.touches ? e.touches[0] : e;
        const dx = point.clientX - dragState.current.startX;
        const dy = point.clientY - dragState.current.startY;
        setPan({ x: dragState.current.origin.x + dx, y: dragState.current.origin.y + dy });
    };
    const onPointerUp = () => { dragState.current = null; };

    const transform = `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom * (flipX ? -1 : 1)}, ${zoom * (flipY ? -1 : 1)})`;

    return createPortal(
        <div
            className="iv-lightbox-backdrop"
            role="presentation"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="iv-lightbox" role="dialog" aria-modal="true" aria-label={alt || 'Image viewer'}>
                <button type="button" className="iv-close-btn" onClick={onClose} aria-label="Close image viewer">
                    <X size={20} />
                </button>

                <div
                    className={`iv-stage ${zoom > 1 ? 'iv-stage-pannable' : ''}`}
                    onMouseDown={onPointerDown}
                    onMouseMove={onPointerMove}
                    onMouseUp={onPointerUp}
                    onMouseLeave={onPointerUp}
                    onTouchStart={onPointerDown}
                    onTouchMove={onPointerMove}
                    onTouchEnd={onPointerUp}
                >
                    <img
                        src={src}
                        alt={alt}
                        className="iv-stage-img"
                        style={{ transform }}
                        draggable={false}
                    />
                </div>

                <div className="iv-toolbar" role="toolbar" aria-label="Image controls">
                    <button type="button" onClick={rotateLeft} aria-label="Rotate left">
                        <RotateCcw size={18} /><span>Rotate Left</span>
                    </button>
                    <button type="button" onClick={rotateRight} aria-label="Rotate right">
                        <RotateCw size={18} /><span>Rotate Right</span>
                    </button>
                    <button type="button" onClick={toggleFlipX} aria-pressed={flipX} aria-label="Flip horizontally">
                        <FlipHorizontal size={18} /><span>Flip X</span>
                    </button>
                    <button type="button" onClick={toggleFlipY} aria-pressed={flipY} aria-label="Flip vertically">
                        <FlipVertical size={18} /><span>Flip Y</span>
                    </button>
                    <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
                        <ZoomOut size={18} /><span>Zoom Out</span>
                    </button>
                    <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
                        <ZoomIn size={18} /><span>Zoom In</span>
                    </button>
                    <button type="button" onClick={reset} aria-label="Reset view">
                        <RefreshCw size={18} /><span>Reset</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
