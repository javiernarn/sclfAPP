// ============================================================
// usePreventInspect.js
// SCLF — shared "prevent right-click / DevTools / browser zoom"
// guard, site-wide (desktop only). One copy, consumed by every
// protected surface (AuthShell → Login/Register/Reset Password,
// MainPage, DashboardShell) instead of duplicating the logic.
//
// -----------------------------------------------------------------
// HOW TO TURN IT OFF WHILE YOU DEBUG
// -----------------------------------------------------------------
// Flip the single flag below (or set the env var) instead of
// commenting the block out in every file:
//
//   INSPECT_PROTECTION_ENABLED = false
//
// or, without touching code, add to your .env:
//
//   VITE_ENABLE_INSPECT_PROTECTION=false
//
// Every surface that imports from this file picks up the change
// automatically — right-click, F12/DevTools shortcuts, and the
// zoom lock all stop firing at once, everywhere, with no per-file
// edits and nothing left commented out in the page components.
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";

export const INSPECT_PROTECTION_ENABLED =
    (typeof import.meta !== "undefined" &&
        import.meta.env?.VITE_ENABLE_INSPECT_PROTECTION) === "false"
        ? false
        : true;

// export const INSPECT_PROTECTION_ENABLED = false;

// Desktop-only breakpoint (window.innerWidth >= 992).
const DESKTOP_MIN_WIDTH = 992;

// ============================================================
// guardImageEvents — spread onto any <img>/media element that
// should resist right-click-save / drag-save. Becomes a no-op
// object automatically when protection is switched off above, so
// pages don't need their own "if disabled" checks.
// ============================================================
export const guardImageEvents = INSPECT_PROTECTION_ENABLED
    ? {
        onContextMenu: (e) => e.preventDefault(),
        onDragStart: (e) => e.preventDefault(),
        draggable: false,
    }
    : {};

// ============================================================
// usePreventInspect — drop into any protected surface:
//
//   const { zoomModalOpen, closeZoomModal } = usePreventInspect();
//   ...
//   <ZoomWarningModal open={zoomModalOpen} onClose={closeZoomModal} />
//
// Owns: contextmenu blocking, F12/Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S,
// Ctrl+scroll / Ctrl+plus/minus zoom blocking, and the
// devicePixelRatio-based fallback that also catches browser-menu
// zoom (View > Zoom In, etc).
// ============================================================
export default function usePreventInspect() {
    const [zoomModalOpen, setZoomModalOpen] = useState(false);
    const closeZoomModal = useCallback(() => setZoomModalOpen(false), []);

    useEffect(() => {
        if (!INSPECT_PROTECTION_ENABLED) return undefined;

        const disableContextMenu = (e) => {
            if (window.innerWidth >= DESKTOP_MIN_WIDTH) {
                e.preventDefault();
            }
        };

        document.addEventListener("contextmenu", disableContextMenu);

        return () => {
            document.removeEventListener("contextmenu", disableContextMenu);
        };
    }, []);

    useEffect(() => {
        if (!INSPECT_PROTECTION_ENABLED) return undefined;
        if (window.innerWidth < DESKTOP_MIN_WIDTH) return undefined;

        const showZoomModal = () => {
            setZoomModalOpen(true);
        };

        // Baseline devicePixelRatio, captured once on mount. We only
        // react to it CHANGING (an actual zoom action), never to its
        // value on load.
        let baselineDPR = window.devicePixelRatio;

        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();

            // Block Developer Tools
            if (
                e.key === "F12" ||
                (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) ||
                (e.ctrlKey && key === "u") ||
                (e.ctrlKey && key === "s")
            ) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Ctrl + 0 (allow reset zoom)
            if (e.ctrlKey && e.key === "0") {
                setTimeout(() => {
                    baselineDPR = window.devicePixelRatio;
                    setZoomModalOpen(false);
                }, 300);
                return;
            }

            // Block Zoom In / Out
            if (
                e.ctrlKey &&
                (
                    e.key === "+" ||
                    e.key === "-" ||
                    e.key === "=" ||
                    e.key === "_" ||
                    e.code === "NumpadAdd" ||
                    e.code === "NumpadSubtract"
                )
            ) {
                e.preventDefault();
                e.stopPropagation();
                showZoomModal();
                return false;
            }
        };

        // Block Ctrl + Mouse Wheel
        const handleWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                showZoomModal();
                return false;
            }
        };

        // Catches browser-menu zoom (View > Zoom In, etc.) which doesn't
        // fire the handlers above. Only compares against the live
        // baseline, never on mount, so it won't false-trigger on load.
        const checkZoom = () => {
            const currentDPR = window.devicePixelRatio;
            if (currentDPR !== baselineDPR) {
                setZoomModalOpen(true);
            }
        };

        window.addEventListener("resize", checkZoom);
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            window.removeEventListener("resize", checkZoom);
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("wheel", handleWheel);
        };
    }, []);

    return { zoomModalOpen, closeZoomModal };
}

// ============================================================
// ZoomWarningModal — self-contained (own styles, no UI-library
// dependency) so it can drop into any surface — auth pages,
// MainPage, DashboardShell — without pulling in extra deps.
// Renders nothing when protection is disabled so leftover state
// can never pop it open.
// ============================================================
export function ZoomWarningModal({ open, onClose }) {
    if (!INSPECT_PROTECTION_ENABLED || !open) return null;

    return (
        <>
            <style>{ZOOM_MODAL_CSS}</style>
            <div className="pi-zoom-backdrop" role="presentation">
                <div
                    className="pi-zoom-card"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="pi-zoom-title"
                >
                    <span className="pi-zoom-icon">
                        <AlertTriangle size={22} strokeWidth={2.25} />
                    </span>

                    <h2 id="pi-zoom-title" className="pi-zoom-title">
                        Browser Zoom Detected
                    </h2>

                    <p className="pi-zoom-text">
                        You are trying to <strong>zoom in</strong> or{" "}
                        <strong>zoom out</strong>.
                    </p>
                    <p className="pi-zoom-text">
                        This system is designed to work best at{" "}
                        <strong>100% browser zoom</strong>.
                    </p>
                    <p className="pi-zoom-text">
                        Please press <strong>Ctrl + 0</strong> to reset your
                        browser zoom to <strong>100%</strong>.
                    </p>

                    <button
                        type="button"
                        className="pi-zoom-btn"
                        onClick={onClose}
                        autoFocus
                    >
                        OK
                    </button>
                </div>
            </div>
        </>
    );
}

const ZOOM_MODAL_CSS = `
.pi-zoom-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10050;
    background: rgba(11, 13, 25, 0.55);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: pi-zoom-fade 0.15s ease both;
}
.pi-zoom-card {
    width: 100%;
    max-width: 380px;
    background: #fff;
    border-radius: 16px;
    padding: 26px 24px 22px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    text-align: center;
    animation: pi-zoom-pop 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1b1f3b;
}
.pi-zoom-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 14px;
    background: rgba(245, 158, 11, 0.14);
    color: #b5842e;
}
.pi-zoom-title { font-size: 17px; font-weight: 800; margin: 0 0 10px; }
.pi-zoom-text { font-size: 13.5px; line-height: 1.55; opacity: 0.75; margin: 0 0 6px; }
.pi-zoom-text:last-of-type { margin-bottom: 20px; }
.pi-zoom-btn {
    width: 100%;
    padding: 11px 14px;
    border-radius: 10px;
    border: none;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    background: #1b1f3b;
    color: #fff;
    transition: opacity 0.15s ease, transform 0.1s ease;
}
.pi-zoom-btn:hover { opacity: 0.9; }
.pi-zoom-btn:active { transform: translateY(1px); }

@keyframes pi-zoom-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pi-zoom-pop {
    from { opacity: 0; transform: scale(0.94) translateY(6px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
    .pi-zoom-backdrop, .pi-zoom-card { animation: none; }
}
`;