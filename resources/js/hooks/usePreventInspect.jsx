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
// Set this in your .env (no code edits, nothing to comment out):
//
//   VITE_ENABLE_INSPECT_PROTECTION=false   # debugging: protection OFF
//   VITE_ENABLE_INSPECT_PROTECTION=true    # production: protection ON
//
// Then restart `npm run dev` / re-run `npm run build`.
//
// Every surface that imports from this file picks up the change
// automatically — right-click, F12/DevTools shortcuts, and the
// zoom lock all stop firing at once, everywhere, with no per-file
// edits and nothing left commented out in the page components.
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "../Components/icons";
import { useAppTheme, isDarkTheme } from "./useAppTheme";

// Controlled by VITE_ENABLE_INSPECT_PROTECTION in .env (true | false).
// Unset or anything other than "false" => protection ON (safe default).
// Vite inlines env at build/dev-server start, so restart `npm run dev`
// (or re-run `npm run build`) after changing it.
const RAW_FLAG = import.meta.env?.VITE_ENABLE_INSPECT_PROTECTION;
export const INSPECT_PROTECTION_ENABLED =
    String(RAW_FLAG ?? "true").trim().toLowerCase() !== "false";

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

    // ----------------------------------------------------------
    // DevTools detector: when DevTools is opened (docked OR
    // undocked), hide the whole UI and show a plain white page
    // with the same text as the <noscript> fallback. The UI comes
    // back when DevTools is closed. Desktop only. Deterrent only —
    // real security stays on the server (auth, policies, throttle).
    // ----------------------------------------------------------
    useEffect(() => {
        if (!INSPECT_PROTECTION_ENABLED) return undefined;
        if (window.innerWidth < DESKTOP_MIN_WIDTH) return undefined;

        const root = document.getElementById("app");
        if (!root) return undefined;

        const baseDPR = window.devicePixelRatio || 1;
        let cover = null;

        const showCover = () => {
            if (cover) return;
            root.style.display = "none";
            cover = document.createElement("div");
            cover.setAttribute("data-pi-cover", "1");
            cover.style.cssText =
                "position:fixed;inset:0;z-index:2147483647;background:#fff;" +
                "color:#111;font-family:Arial,Helvetica,sans-serif;padding:24px;";
            cover.innerHTML =
                "<h1>SCLF - Opol Community College</h1>" +
                "<p>Smart Campus Lost &amp; Found system for Opol Community College. " +
                "Report, search, and claim lost or found items on campus.</p>" +
                "<p>JavaScript is required to use SCLF. Please enable JavaScript " +
                "in your browser, then reload this page.</p>";
            document.body.appendChild(cover);
        };

        const hideCover = () => {
            if (!cover) return;
            cover.remove();
            cover = null;
            root.style.display = "";
        };

        // Docked DevTools makes the outer window bigger than the page
        // viewport. Normalised by zoom so browser zoom doesn't trigger it.
        const dockedOpen = () => {
            const zoom = (window.devicePixelRatio || 1) / baseDPR;
            const w = window.outerWidth - window.innerWidth * zoom;
            const h = window.outerHeight - window.innerHeight * zoom;
            return w > 200 || h > 200;
        };

        const check = () => {
            if (dockedOpen()) {
                showCover();
            } else {
                hideCover();
            }
        };

        const timer = window.setInterval(check, 1000);
        window.addEventListener("resize", check);
        check();

        return () => {
            window.clearInterval(timer);
            window.removeEventListener("resize", check);
            hideCover();
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
    // Follows the picked app theme (same cookie the dashboard + auth pages use),
    // so the popup matches Light / Dark / Maroon / Blue / Yellow / Custom.
    const { theme } = useAppTheme();
    if (!INSPECT_PROTECTION_ENABLED || !open) return null;
    const themeClass = `pz-${theme || "white"} ${isDarkTheme(theme) ? "pz-dark" : "pz-light"}`;

    return (
        <>
            <style>{ZOOM_MODAL_CSS}</style>
            <div className={`pi-zoom-backdrop ${themeClass}`} role="presentation">
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
/* ---- theme tokens (mirror themes.css so this works on auth pages too) ---- */
.pi-zoom-backdrop {
    --pz-surface: #ffffff; --pz-edge: #c3ccdb; --pz-fg: #0b1220; --pz-shadow: rgba(2, 6, 23, 0.35);
    --pz-accent: linear-gradient(135deg, #4338ca, #4f46e5 50%, #6366f1); --pz-on: #fff;
    --pz-text: #4f46e5; --pz-rgb: 79, 70, 229;
}
.pz-black { --pz-surface: #12161f; --pz-edge: #323b4a; --pz-fg: #e7ecf3; --pz-text: #a5b4fc; --pz-rgb: 129, 140, 248; --pz-shadow: rgba(0, 0, 0, 0.6); }
.pz-maroon { --pz-surface: #fffafb; --pz-edge: #e8b3bc; --pz-accent: linear-gradient(135deg, #7f1d2e, #9f1239 50%, #dc2626); --pz-text: #9f1239; --pz-rgb: 159, 18, 57; }
.pz-blue { --pz-surface: #f9fbff; --pz-edge: #a9cdf5; --pz-accent: linear-gradient(135deg, #1e40af, #2563eb 50%, #38bdf8); --pz-text: #1d4ed8; --pz-rgb: 37, 99, 235; }
.pz-yellow { --pz-surface: #fffcf4; --pz-edge: #e6c477; --pz-fg: #1c1408; --pz-accent: linear-gradient(135deg, #b45309, #d97706 50%, #f59e0b); --pz-on: #1c1408; --pz-text: #b45309; --pz-rgb: 217, 119, 6; }
.pz-dark-white { --pz-surface: #0a0a0a; --pz-edge: #2a2a2a; --pz-fg: #f2f2f2; --pz-accent: linear-gradient(135deg, #ffffff, #e6e6e6 50%, #bdbdbd); --pz-on: #000; --pz-text: #f2f2f2; --pz-rgb: 255, 255, 255; --pz-shadow: rgba(0, 0, 0, 0.7); }
.pz-dark-blue { --pz-surface: #060d1f; --pz-edge: #2f5fae; --pz-fg: #e7ecf3; --pz-accent: linear-gradient(135deg, #1e40af, #2563eb 50%, #38bdf8); --pz-text: #7dd3fc; --pz-rgb: 56, 189, 248; --pz-shadow: rgba(0, 0, 0, 0.7); }
.pz-dark-yellow { --pz-surface: #120b02; --pz-edge: #a8761c; --pz-fg: #f6ead2; --pz-accent: linear-gradient(135deg, #b45309, #d97706 50%, #f59e0b); --pz-on: #1c1408; --pz-text: #fbbf24; --pz-rgb: 245, 158, 11; --pz-shadow: rgba(0, 0, 0, 0.7); }
.pz-dark-maroon { --pz-surface: #14060a; --pz-edge: #b5485c; --pz-fg: #f8e7ea; --pz-accent: linear-gradient(135deg, #7f1d2e, #9f1239 50%, #dc2626); --pz-text: #fca5a5; --pz-rgb: 248, 113, 113; --pz-shadow: rgba(0, 0, 0, 0.7); }
.pz-dark { background: rgba(0, 0, 0, 0.66) !important; }

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
    background: var(--pz-surface);
    border: 1.5px solid var(--pz-edge);
    border-radius: 16px;
    padding: 26px 24px 22px;
    box-shadow: 0 24px 60px var(--pz-shadow), 0 0 0 4px rgba(var(--pz-rgb), 0.14);
    text-align: center;
    animation: pi-zoom-pop 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: var(--pz-fg);
}
.pi-zoom-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 14px;
    background: rgba(var(--pz-rgb), 0.16);
    border: 1.5px solid rgba(var(--pz-rgb), 0.4);
    color: var(--pz-text);
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
    background: var(--pz-accent);
    color: var(--pz-on);
    transition: opacity 0.15s ease, transform 0.1s ease;
}
.pi-zoom-btn:hover { opacity: 0.9; }
.pi-zoom-btn:focus-visible { outline: 2px solid var(--pz-text); outline-offset: 2px; }
.pi-zoom-btn:active { transform: translateY(1px); }

@keyframes pi-zoom-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pi-zoom-pop {
    from { opacity: 0; transform: scale(0.94) translateY(6px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}
@media (min-width: 99999px) /* Reduce Motion ignored on purpose */ {
    .pi-zoom-backdrop, .pi-zoom-card { animation: none; }
}
`;