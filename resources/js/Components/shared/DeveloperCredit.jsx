import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppTheme, isDarkTheme } from "../../hooks/useAppTheme";
import { Download, X, Check } from "../icons";
import "./DeveloperCredit.css";

// ---------------------------------------------------------------------------
// Developer credit
//
// The name in the footer (and in the phone sidebar) is a trigger, not a link.
//
//   - Mouse + trackpad (hover: hover, pointer: fine) -> hovering the name opens
//     a small anchored card above it. It stays open while the pointer is on the
//     card, and a click / Enter / Space toggles it for keyboard users.
//   - Touch (phones, tablets, the installed PWA)      -> tapping the name opens
//     the same card as a bottom sheet with a backdrop, a grab handle you can
//     swipe down, and safe-area padding for the home indicator.
//
// Facebook lives inside the card. The GCash QR is a pre-cropped image
// (public/images/gcash-qr.jpg, User ID removed) with a Download button.
// ---------------------------------------------------------------------------

const DEV = {
    label: "Antiquina, Jonee John R.",
    fullName: "Jonee John R. Antiquina",
    role: "OCCian developer",
    school: "Opol Community College",
    bio:
        "A student of Opol Community College who designed and built SCLF end to end: " +
        "the web app, the installable phone app, item matching and QR release. " +
        "The goal was simple, getting lost belongings back to their owners faster.",
    facebook: "https://www.facebook.com/EphemeralKun",
    facebookHandle: "EphemeralKun",
    photo: "/images/developer.jpg",
    qr: "/images/gcash-qr.jpg",
    qrFile: "SCLF-developer-gcash-qr.jpg",
};

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
const OPEN_DELAY = 90;
const CLOSE_DELAY = 180;
const EDGE = 12;
const GAP = 12;

const isIOS = () =>
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

function useCanHover() {
    const get = () =>
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia(HOVER_QUERY).matches;
    const [canHover, setCanHover] = useState(get);
    useEffect(() => {
        if (typeof window.matchMedia !== "function") return undefined;
        const mq = window.matchMedia(HOVER_QUERY);
        const onChange = () => setCanHover(mq.matches);
        if (mq.addEventListener) mq.addEventListener("change", onChange);
        else mq.addListener(onChange); // older iOS Safari
        return () => {
            if (mq.removeEventListener) mq.removeEventListener("change", onChange);
            else mq.removeListener(onChange);
        };
    }, []);
    return canHover;
}

const FacebookMark = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path
            fill="currentColor"
            d="M13.5 21v-7.6h2.55l.4-3h-2.95V8.5c0-.87.24-1.46 1.5-1.46H16.6V4.37A21 21 0 0 0 14.3 4.25c-2.27 0-3.82 1.39-3.82 3.93v2.22H7.9v3h2.58V21h3.02Z"
        />
    </svg>
);

const CupMark = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"
        fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9Z" />
        <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H15.6" />
        <path d="M8 3.5c0 1 .8 1.2.8 2.2M12 3.5c0 1 .8 1.2.8 2.2" />
    </svg>
);

// ---------------------------------------------------------------------------
// The card body, shared by the popover and the sheet.
// ---------------------------------------------------------------------------
function CardBody({ titleId }) {
    const [status, setStatus] = useState("idle"); // idle | busy | done | error
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);

    const flash = (next) => {
        setStatus(next);
        clearTimeout(timer.current);
        if (next === "done" || next === "error") {
            timer.current = setTimeout(() => setStatus("idle"), 4200);
        }
    };

    const download = async () => {
        if (status === "busy") return;
        setStatus("busy");
        try {
            const res = await fetch(DEV.qr, { cache: "force-cache" });
            if (!res.ok) throw new Error("fetch failed");
            const blob = await res.blob();

            // iOS (Safari and the installed PWA) ignores the download attribute
            // for blobs; the share sheet is the route that offers "Save Image".
            if (isIOS() && typeof navigator.canShare === "function" && typeof File === "function") {
                const file = new File([blob], DEV.qrFile, { type: blob.type || "image/jpeg" });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: "GCash QR" });
                    flash("done");
                    return;
                }
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = DEV.qrFile;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            flash("done");
        } catch (err) {
            if (err && err.name === "AbortError") flash("idle"); // closed the share sheet
            else flash("error");
        }
    };

    return (
        <>
            <header className="dc-head">
                <img
                    className="dc-photo"
                    src={DEV.photo}
                    alt={`Portrait of ${DEV.fullName}`}
                    width="84"
                    height="84"
                    decoding="async"
                />
                <div className="dc-id">
                    <h2 className="dc-name" id={titleId}>{DEV.fullName}</h2>
                    <p className="dc-role">{DEV.role}</p>
                    <p className="dc-school">{DEV.school}</p>
                </div>
            </header>

            <p className="dc-bio">{DEV.bio}</p>

            <a className="dc-fb" href={DEV.facebook} target="_blank" rel="noopener noreferrer">
                <span className="dc-fb-mark"><FacebookMark /></span>
                <span className="dc-fb-text">
                    <span className="dc-fb-title">Facebook</span>
                    <span className="dc-fb-handle">{DEV.facebookHandle}</span>
                </span>
            </a>

            <section className="dc-coffee" aria-label="Buy me a coffee">
                <img
                    className="dc-qr"
                    src={DEV.qr}
                    alt="GCash InstaPay QR code"
                    width="124"
                    height="144"
                    loading="lazy"
                    decoding="async"
                />
                <div className="dc-coffee-text">
                    <h3 className="dc-coffee-title"><CupMark /> Buy me a coffee</h3>
                    <p className="dc-coffee-copy">
                        SCLF is free to use. If it helped you, a coffee is appreciated, never expected.
                    </p>
                    <button
                        type="button"
                        className="dc-download"
                        onClick={download}
                        disabled={status === "busy"}
                    >
                        {status === "done" ? <Check size={16} /> : <Download size={16} />}
                        <span>{status === "busy" ? "Preparing" : status === "done" ? "Saved" : "Download QR"}</span>
                    </button>
                    <p className="dc-hint" role="status" aria-live="polite">
                        {status === "error"
                            ? "Could not download. Press and hold the QR to save it."
                            : "In GCash, open Pay QR and pick the saved image from your gallery."}
                    </p>
                </div>
            </section>
        </>
    );
}

// ---------------------------------------------------------------------------
// Trigger + popover / sheet
// ---------------------------------------------------------------------------
export default function DeveloperCredit({ className = "" }) {
    // Same class recipe as <DashboardShell> and its portaled menus, so the card
    // follows the picked theme exactly (white, black, maroon, blue, yellow and
    // the dark-* "Black / accent" themes). useAppTheme already collapses accent
    // themes to plain light/dark while a seasonal theme is on, like the shell.
    const { theme } = useAppTheme();
    const dark = isDarkTheme(theme);
    const themeClass = `${theme} ${dark ? "dark" : "light"} ${theme.startsWith("dark-") ? `dk-${theme.slice(5)}` : ""}`.trim();
    const canHover = useCanHover();

    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null); // popover only
    const triggerRef = useRef(null);
    const popRef = useRef(null);
    const sheetRef = useRef(null);
    const closeBtnRef = useRef(null);
    const openT = useRef(null);
    const closeT = useRef(null);
    const drag = useRef({ y: 0, active: false });
    const titleId = useId();
    const panelId = useId();

    const clearTimers = () => {
        clearTimeout(openT.current);
        clearTimeout(closeT.current);
    };
    useEffect(() => clearTimers, []);

    const close = useCallback((returnFocus = false) => {
        clearTimers();
        setOpen(false);
        setPos(null);
        if (returnFocus) triggerRef.current?.focus();
    }, []);

    const scheduleOpen = () => {
        if (!canHover) return;
        clearTimeout(closeT.current);
        if (open) return;
        openT.current = setTimeout(() => setOpen(true), OPEN_DELAY);
    };
    const scheduleClose = () => {
        if (!canHover) return;
        clearTimeout(openT.current);
        closeT.current = setTimeout(() => close(false), CLOSE_DELAY);
    };
    const keepOpen = () => {
        if (canHover) clearTimeout(closeT.current);
    };

    const onTriggerClick = () => {
        clearTimers();
        if (open) close(false);
        else setOpen(true);
    };

    // Anchor the popover above the name (or below it when there is no room),
    // clamped to the viewport, with the arrow still pointing at the name.
    const place = useCallback(() => {
        const t = triggerRef.current;
        const p = popRef.current;
        if (!t || !p) return;
        const r = t.getBoundingClientRect();
        const w = p.offsetWidth;
        const h = p.offsetHeight;
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const centre = r.left + r.width / 2;
        const left = Math.min(Math.max(centre - w / 2, EDGE), Math.max(EDGE, vw - w - EDGE));
        const above = r.top - h - GAP >= EDGE || r.top > vh - r.bottom;
        const top = above ? Math.max(EDGE, r.top - h - GAP) : Math.min(vh - h - EDGE, r.bottom + GAP);
        const arrow = Math.min(Math.max(centre - left, 22), w - 22);
        setPos({ left, top, arrow, placement: above ? "above" : "below" });
    }, []);

    useLayoutEffect(() => {
        if (!open || !canHover) return undefined;
        place();
        window.addEventListener("resize", place);
        return () => window.removeEventListener("resize", place);
    }, [open, canHover, place]);

    // Outside press + Escape.
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            const inPop = popRef.current && popRef.current.contains(e.target);
            const inSheet = sheetRef.current && sheetRef.current.contains(e.target);
            const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
            if (!inPop && !inSheet && !inTrigger) close(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") close(true);
        };
        document.addEventListener("pointerdown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, close]);

    // Sheet: lock page scroll and move focus inside.
    useEffect(() => {
        if (!open || canHover) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const f = setTimeout(() => closeBtnRef.current?.focus({ preventScroll: true }), 60);
        return () => {
            document.body.style.overflow = prev;
            clearTimeout(f);
        };
    }, [open, canHover]);

    // Sheet: swipe the handle down to dismiss.
    const onGrabDown = (e) => {
        drag.current = { y: e.clientY, active: true };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        if (sheetRef.current) sheetRef.current.style.transition = "none";
    };
    const onGrabMove = (e) => {
        if (!drag.current.active || !sheetRef.current) return;
        const dy = Math.max(0, e.clientY - drag.current.y);
        sheetRef.current.style.transform = `translateY(${dy}px)`;
    };
    const onGrabUp = (e) => {
        if (!drag.current.active || !sheetRef.current) return;
        drag.current.active = false;
        const dy = Math.max(0, e.clientY - drag.current.y);
        sheetRef.current.style.transition = "";
        if (dy > 90) close(true);
        else sheetRef.current.style.transform = "";
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`dc-trigger ${open ? "is-open" : ""} ${className}`.trim()}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={onTriggerClick}
                onMouseEnter={scheduleOpen}
                onMouseLeave={scheduleClose}
            >
                {"</> "}{DEV.label}
            </button>

            {open && canHover && createPortal(
                <div
                    id={panelId}
                    ref={popRef}
                    className={`dc-layer dc-pop ${themeClass} ${pos ? `is-placed is-${pos.placement}` : ""}`}
                    role="dialog"
                    aria-labelledby={titleId}
                    style={pos ? { left: pos.left, top: pos.top } : undefined}
                    onMouseEnter={keepOpen}
                    onMouseLeave={scheduleClose}
                >
                    <span className="dc-arrow" style={pos ? { left: pos.arrow } : undefined} aria-hidden="true" />
                    <CardBody titleId={titleId} />
                </div>,
                document.body
            )}

            {open && !canHover && createPortal(
                <div className={`dc-layer dc-sheet-root ${themeClass}`}>
                    <div className="dc-backdrop" onClick={() => close(true)} />
                    <div
                        id={panelId}
                        ref={sheetRef}
                        className="dc-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                    >
                        <div
                            className="dc-grab"
                            onPointerDown={onGrabDown}
                            onPointerMove={onGrabMove}
                            onPointerUp={onGrabUp}
                            onPointerCancel={onGrabUp}
                        >
                            <span className="dc-grab-bar" />
                        </div>
                        <button
                            ref={closeBtnRef}
                            type="button"
                            className="dc-close"
                            aria-label="Close"
                            onClick={() => close(true)}
                        >
                            <X size={18} />
                        </button>
                        <div className="dc-sheet-scroll">
                            <CardBody titleId={titleId} />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
