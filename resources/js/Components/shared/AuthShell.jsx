import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon, ShieldCheck, Eye, EyeOff, CheckCircle2, XCircle } from "../icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import usePreventInspect, { guardImageEvents, ZoomWarningModal } from "../../hooks/usePreventInspect";
import logo from "../../assets/images/site-logo.png";

/**
 * ============================================================================
 *  AUTH SHELL — "The Intake Ledger"
 * ============================================================================
 *  Design system for the four public auth surfaces: Login, Register,
 *  Forgot Password, Reset Password.
 *
 *  CONCEPT
 *  -------
 *  Every one of those four flows is, structurally, the same real-world
 *  action a campus Lost & Found desk performs every day: opening a case,
 *  checking a record, or reissuing a credential. Instead of dressing that
 *  up as a generic "SaaS gradient card" (rounded pill inputs, blurred
 *  color blobs, glassmorphism — the same shell every dashboard product
 *  ships with), this shell borrows its visual grammar from the physical
 *  artifact the whole app is modeled on: a **registrar's intake ledger** —
 *  ruled paper, numbered entry rows, a case reference code, a rubber-stamp
 *  status mark, and a folder-tab index instead of a progress bar.
 *
 *  HIERARCHY
 *  ---------
 *  1. Ledger Rail   (left, persistent)  — identity + live case reference
 *  2. Record Card    (right, primary)   — the actual task: one ruled form
 *  3. Ledger Rows     (inside the card) — numbered fields, not boxes
 *  4. Status Stamp    (contextual)      — success / error / notice states
 *
 *  Every page composes the same four layers so the *system* reads as one
 *  coherent product, not four different screens improvised separately.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Small deterministic "case number" generator — cosmetic only, never sent
// to the server. Gives each visit of the rail a believable ledger feel
// without needing a backend round trip.
// ---------------------------------------------------------------------------
const buildCaseNumber = (prefix) => {
    const now = new Date();
    const y = now.getFullYear();
    const seed = (now.getMonth() + 1) * 31 + now.getDate();
    const serial = String((seed * 17) % 900 + 100);
    return `SCLF-${y}-${prefix}-${serial}`;
};

const RAIL_FACTS = [
    "Every report is timestamped the moment it's filed.",
    "Matches are surfaced automatically across campus desks.",
    "Records stay private until you choose to release them.",
];

/**
 * AuthShell — the outer two-zone frame (Ledger Rail + Record Card).
 */
export default function AuthShell({
    docType = "ACCESS LOG",
    caseSeed = "GEN",
    title,
    subtitle,
    railHeadline,
    railNote,
    children,
    footer,
    wide = false,
    tabs, // optional folder-tab step index for the register wizard
    centerHead = false, // center the title/subtitle — used by success/confirmation states
}) {
    const { theme, toggleTheme } = useAppTheme();
    const isDark = theme === "black";
    const [caseNumber] = useState(() => buildCaseNumber(caseSeed));
    const [now, setNow] = useState(() => new Date());
    // Shared right-click / DevTools / browser-zoom guard — covers every
    // page that renders through this shell (Login, Register, Forgot
    // Password, Reset Password) from one place. See usePreventInspect.jsx
    // to toggle it off site-wide while debugging.
    const { zoomModalOpen, closeZoomModal } = usePreventInspect();

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000 * 30);
        return () => clearInterval(t);
    }, []);

    const dateStamp = now.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    const timeStamp = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

    return (
        <>
            <style>{LEDGER_CSS}</style>

            <div className={`lg-wrap ${isDark ? "dark" : "light"}`}>
                {/* ============ LEFT: LEDGER RAIL ============ */}
                <aside className="lg-rail">
                    <div className="lg-rail-ruled" aria-hidden="true" />
                    <span className="lg-rail-blob lg-rail-blob-1" aria-hidden="true" />
                    <span className="lg-rail-blob lg-rail-blob-2" aria-hidden="true" />

                    <div className="lg-rail-top">
                        <Link to="/" className="lg-brand">
                            <span className="lg-brand-mark"><img src={logo} alt="SCLF" {...guardImageEvents} /></span>
                            <span className="lg-brand-text">
                                SCLF Office
                                <span>Opol Community College</span>
                            </span>
                        </Link>
                    </div>

                    <div className="lg-rail-doc">
                        <span className="lg-doc-type">{docType}</span>
                        <span className="lg-doc-number">{caseNumber}</span>
                        <span className="lg-doc-clock">{dateStamp} · {timeStamp}</span>
                    </div>

                    <div className="lg-rail-mid">
                        <h2 className="lg-rail-headline">{railHeadline}</h2>
                        <p className="lg-rail-note">{railNote}</p>

                        <ol className="lg-rail-facts">
                            {RAIL_FACTS.map((f, i) => (
                                <li key={f}>
                                    <span className="lg-rail-facts-num">{String(i + 1).padStart(2, "0")}</span>
                                    {f}
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="lg-rail-seal" aria-hidden="true">
                        <ShieldCheck size={15} strokeWidth={2.25} />
                        <span>Verified Campus System</span>
                    </div>
                </aside>

                {/* ============ RIGHT: RECORD CARD ============ */}
                <main className="lg-stage">
                    {/* App bar: logo + name on the left, theme toggle on the
                        opposite (right) side. On desktop/landscape only the
                        toggle shows, in its usual top-right spot. */}
                    <header className="lg-appbar">
                        <Link to="/" className="lg-mobile-brand">
                            <img src={logo} alt="SCLF" {...guardImageEvents} />
                            <span>SCLF Office<span>Opol Community College</span></span>
                        </Link>
                        <button type="button" className="lg-theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                            {isDark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
                        </button>
                    </header>

                    <div className="lg-stage-inner">
                        <div className={`lg-card${wide ? " is-wide" : ""}`}>
                            <div className="lg-card-tab-strip">
                                <span className="lg-card-ref">REF. {caseNumber}</span>
                                <span className="lg-card-status">
                                    <span className="lg-dot" /> Live Session
                                </span>
                            </div>

                            {tabs && <div className="lg-folder-tabs">{tabs}</div>}

                            <div className={`lg-card-head${centerHead ? " is-centered" : ""}`}>
                                <h1 className="lg-title">{title}</h1>
                                {subtitle && <p className="lg-subtitle">{subtitle}</p>}
                            </div>

                            <div className="lg-card-body">{children}</div>

                            {footer && <div className="lg-card-foot">{footer}</div>}
                        </div>

                        <p className="lg-stage-legal">
                            Entries in this ledger are encrypted in transit and reviewed only by authorized Staff and Admin.
                        </p>
                    </div>
                </main>
            </div>

            <ZoomWarningModal open={zoomModalOpen} onClose={closeZoomModal} />
        </>
    );
}

/* =========================================================================
 *  REUSABLE LEDGER PIECES — shared by every page so the four flows compose
 *  from the same primitives instead of four hand-rolled forms.
 * ========================================================================= */

/** A single numbered ledger row: index badge + label + underline input. */
export function LedgerRow({
    index,
    label,
    icon: Icon,
    children,
    hint,
    error,
    twoUp = false,
}) {
    return (
        <div className={`lg-row${twoUp ? " lg-row--compact" : ""}`}>
            <span className="lg-row-index">{String(index).padStart(2, "0")}</span>
            <div className="lg-row-body">
                <label className="lg-row-label">
                    {Icon && <Icon size={12} strokeWidth={2.5} />} {label}
                </label>
                {children}
                {error ? (
                    <span className="lg-row-hint lg-row-error-text">{error}</span>
                ) : (
                    hint && <span className="lg-row-hint">{hint}</span>
                )}
            </div>
        </div>
    );
}

/** Two ledger rows side by side inside one indexed line. */
export function LedgerRowPair({ index, children }) {
    return (
        <div className="lg-row">
            <span className="lg-row-index">{String(index).padStart(2, "0")}</span>
            <div className="lg-row-body lg-row-body--pair">{children}</div>
        </div>
    );
}

/** Plain text/email/etc input styled as a ruled ledger line (no box). */
export function LedgerInput(props) {
    return <input className="lg-input" {...props} />;
}

/** Password input with built-in show/hide toggle. */
export function LedgerPasswordInput({ show, onToggle, ...props }) {
    return (
        <div className="lg-password-wrap">
            <input className="lg-input" type={show ? "text" : "password"} {...props} />
            <button
                type="button"
                className="lg-eye"
                onClick={onToggle}
                aria-label={show ? "Hide password" : "Show password"}
                tabIndex={-1}
            >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
        </div>
    );
}

/** Select styled to match the ledger line. */
export function LedgerSelect(props) {
    return <select className="lg-input lg-select" {...props} />;
}

/** Password strength meter, rendered as a row of five ledger "ticks". */
export function StrengthTicks({ password }) {
    // Always mounted (visibility toggled, not unmounted) so the row
    // beneath it never jumps up/down as the person starts typing — that
    // jump was what made the card grow a scrollbar mid-keystroke.
    const has = !!password;
    const checks = [
        password.length >= 8,
        /[A-Z]/.test(password),
        /[a-z]/.test(password),
        /[0-9]/.test(password),
        /[^A-Za-z0-9]/.test(password),
    ];
    const score = checks.filter(Boolean).length;
    const meta = [
        { label: "Weak", color: "var(--lg-danger)" },
        { label: "Weak", color: "var(--lg-danger)" },
        { label: "Fair", color: "var(--lg-accent)" },
        { label: "Good", color: "var(--lg-ok)" },
        { label: "Strong", color: "var(--lg-ok)" },
        { label: "Strong", color: "var(--lg-ok)" },
    ][score];

    return (
        <div className="lg-strength" style={{ visibility: has ? "visible" : "hidden" }}>
            <div className="lg-strength-ticks">
                {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={i < score ? "is-filled" : ""} style={i < score ? { background: meta.color } : undefined} />
                ))}
            </div>
            <span className="lg-strength-label" style={{ color: meta.color }}>{meta.label}</span>
        </div>
    );
}

/** Password requirement checklist, styled as ledger sign-off marks. */
export function RequirementChecklist({ password }) {
    const items = [
        { ok: password.length >= 8, label: "8+ characters" },
        { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
        { ok: /[a-z]/.test(password), label: "One lowercase letter" },
        { ok: /[0-9]/.test(password), label: "One number" },
    ];
    return (
        <div className="lg-checklist">
            <span className="lg-checklist-title">Credential requirements</span>
            <div className="lg-checklist-grid">
                {items.map((it) => (
                    <span key={it.label} className={`lg-checklist-item${it.ok ? " is-ok" : ""}`}>
                        {it.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                        {it.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

export function PasswordMatchNote({ password, confirm }) {
    // Same fix as StrengthTicks above: stay mounted and just hide the
    // note (instead of returning null) so its height is reserved from
    // the moment step 4 renders. Otherwise the note popping in the
    // instant "confirm password" gets its first character grows the
    // card and pops a scrollbar right under the person's cursor.
    const show = !!confirm;
    const match = password === confirm;
    return (
        <div className={`lg-match ${match ? "is-ok" : "is-bad"}`} style={{ visibility: show ? "visible" : "hidden" }}>
            {match ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {match ? "Entries match" : "Entries do not match"}
        </div>
    );
}

/** Inline banner for errors / notices, styled like a stamped remark. */
export function LedgerBanner({ tone = "error", children }) {
    return <div className={`lg-banner lg-banner--${tone}`}>{children}</div>;
}

/** Big rotated "stamp" mark used on success states (verified / sent / reset). */
export function Stamp({ label = "VERIFIED" }) {
    return (
        <div className="lg-stamp" aria-hidden="true">
            <span>{label}</span>
        </div>
    );
}

/** Primary submit button, ledger-style (rectangular, ink-block, not a pill). */
export function LedgerButton({ children, ...props }) {
    return (
        <button type="submit" className="lg-submit" {...props}>
            {children}
        </button>
    );
}

export function LedgerGhostButton({ children, ...props }) {
    return (
        <button type="button" className="lg-ghost" {...props}>
            {children}
        </button>
    );
}

/* =========================================================================
 *  CSS — single source of truth for the whole ledger system.
 * ========================================================================= */
const LEDGER_CSS = `
    :root {
        --lg-accent: #4f46e5;
        --lg-accent-2: #0ea5e9;
        --lg-accent-3: #7c3aed;
        --lg-ok: #16a34a;
        --lg-danger: #ef4444;
    }

    .lg-wrap, .lg-wrap * { box-sizing: border-box; }
    .lg-wrap {
        position: fixed; inset: 0; width: 100%; height: 100dvh;
        display: flex; overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto,
            "Helvetica Neue", Arial, sans-serif;
        transition: background 0.4s ease, color 0.4s ease;
    }
    /* Same base surface as DashboardShell / MainPage: soft cyan + violet
       glows over a near-white (light) or near-black (dark) canvas — so the
       public auth pages read as the same product as the logged-in app. */
    .lg-wrap.light {
        color: #0b1220;
        background:
            radial-gradient(900px 500px at 100% -10%, rgba(14,165,233,0.12), transparent 60%),
            radial-gradient(900px 500px at -10% 110%, rgba(124,58,237,0.12), transparent 60%),
            #f4f7fb;
    }
    .lg-wrap.dark {
        color: #e7ecf3;
        background:
            radial-gradient(900px 500px at 100% -10%, rgba(14,165,233,0.16), transparent 60%),
            radial-gradient(900px 500px at -10% 110%, rgba(124,58,237,0.18), transparent 60%),
            #0a0c12;
    }

    /* ============ LEDGER RAIL (left) ============ */
    .lg-rail {
        position: relative;
        flex: 0 0 300px;
        max-width: 300px;
        height: 100%;
        display: none;
        flex-direction: column;
        justify-content: space-between;
        padding: 30px 26px;
        color: #fff;
        overflow: hidden;
        background:
            radial-gradient(650px 420px at 12% 6%, rgba(255,255,255,0.14), transparent 60%),
            radial-gradient(550px 460px at 105% 105%, rgba(14,165,233,0.4), transparent 60%),
            linear-gradient(165deg, #4338ca 0%, #4f46e5 45%, #7c3aed 78%, #0ea5e9 130%);
    }
    @media (orientation: landscape) { .lg-rail { display: flex; } }
    @media (orientation: landscape) and (max-height: 380px) { .lg-rail { display: none; } }

    .lg-rail-ruled {
        position: absolute; inset: 0;
        background-image: repeating-linear-gradient(
            to bottom, transparent 0 27px, rgba(255,255,255,0.05) 27px 28px
        );
        pointer-events: none;
    }
    .lg-rail-blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.45; pointer-events: none; animation: lg-float 17s ease-in-out infinite; }
    .lg-rail-blob-1 { width: 260px; height: 260px; background: #a5b4fc; top: -70px; left: -60px; }
    .lg-rail-blob-2 { width: 300px; height: 300px; background: #67e8f9; bottom: -110px; right: -80px; animation-duration: 21s; }
    @keyframes lg-float { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-16px) scale(1.05); } }

    .lg-rail-top { position: relative; z-index: 1; }
    .lg-brand { display: flex; align-items: center; gap: 11px; text-decoration: none; color: inherit; }
    .lg-brand-mark {
        width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
        background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.3);
        display: flex; align-items: center; justify-content: center; padding: 6px;
    }
    .lg-brand-mark img { width: 100%; height: 100%; object-fit: contain; }
    .lg-brand-text { font-weight: 800; font-size: 13.5px; line-height: 1.25; letter-spacing: 0.01em; }
    .lg-brand-text span { display: block; font-weight: 600; font-size: 10.5px; opacity: 0.78; text-transform: uppercase; letter-spacing: 0.09em; margin-top: 1px; }

    .lg-rail-doc {
        position: relative; z-index: 1;
        display: flex; flex-direction: column; gap: 3px;
        margin: 26px 0 22px;
        padding: 12px 14px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.24);
        border-radius: 10px;
        font-family: "SFMono-Regular", "JetBrains Mono", "Courier New", monospace;
    }
    .lg-doc-type { font-size: 10px; letter-spacing: 0.14em; opacity: 0.75; text-transform: uppercase; }
    .lg-doc-number { font-size: 15px; font-weight: 700; letter-spacing: 0.03em; color: #fff; }
    .lg-doc-clock { font-size: 10.5px; opacity: 0.7; }

    .lg-rail-mid { position: relative; z-index: 1; flex: 1; min-height: 0; overflow: hidden; }
    .lg-rail-headline { font-size: clamp(19px, 2vw, 24px); line-height: 1.3; font-weight: 800; margin: 0 0 10px; letter-spacing: -0.01em; }
    .lg-rail-note { font-size: 12.5px; line-height: 1.6; opacity: 0.88; margin: 0 0 20px; }

    .lg-rail-facts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .lg-rail-facts li {
        display: flex; gap: 10px; align-items: flex-start;
        font-size: 11.5px; line-height: 1.5; opacity: 0.85;
    }
    .lg-rail-facts-num {
        font-family: "SFMono-Regular", "JetBrains Mono", "Courier New", monospace;
        font-size: 10px; color: #fff; opacity: 0.85; flex-shrink: 0; margin-top: 1px;
    }

    .lg-rail-seal {
        position: relative; z-index: 1;
        display: flex; align-items: center; gap: 8px;
        font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
        color: #fff; opacity: 0.85; flex-shrink: 0;
        padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.22);
    }

    /* ============ STAGE (right) ============ */
    .lg-stage {
        position: relative;
        flex: 1 1 auto; min-width: 0; height: 100%;
        display: flex; align-items: center; justify-content: center;
        overflow-y: auto; overflow-x: hidden;
        padding: clamp(16px, 3vw, 40px);
        padding-top: max(clamp(16px, 3vw, 40px), env(safe-area-inset-top));
        padding-bottom: max(clamp(16px, 3vw, 40px), env(safe-area-inset-bottom));
    }
    .lg-stage-inner { position: relative; width: 100%; max-width: 420px; margin: auto; display: flex; flex-direction: column; align-items: center; }

    .lg-appbar { position: absolute; top: 14px; right: 14px; z-index: 3; display: flex; align-items: center; }
    .lg-theme-toggle {
        flex-shrink: 0;
        width: 32px; height: 32px; border-radius: 10px; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
    }
    .lg-wrap.light .lg-theme-toggle { background: #fff; border: 1px solid #e2e8f0; color: #0b1220; }
    .lg-wrap.dark .lg-theme-toggle { background: rgba(255,255,255,0.08); border: 1px solid #242a36; color: #e7ecf3; }

    .lg-mobile-brand { display: none; align-items: center; gap: 9px; text-decoration: none; color: inherit; margin-bottom: 18px; }
    .lg-mobile-brand img { width: 30px; height: 30px; object-fit: contain; border-radius: 9px; }
    .lg-mobile-brand span { font-weight: 800; font-size: 12.5px; line-height: 1.2; }
    .lg-mobile-brand span span { display: block; font-weight: 600; font-size: 9.5px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.07em; }
    @media (max-width: 767px) and (orientation: portrait) { .lg-mobile-brand { display: flex; } }

    /* ============ RECORD CARD ============ */
    .lg-card {
        position: relative; width: 100%; max-width: 400px;
        border-radius: 18px;
        animation: lg-rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .lg-card.is-wide { max-width: 560px; }
    @keyframes lg-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .lg-wrap.light .lg-card { background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 24px 48px -18px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.04); }
    .lg-wrap.dark .lg-card { background: #10131b; border: 1px solid #242a36; box-shadow: 0 24px 48px -18px rgba(0,0,0,0.55); }

    .lg-card-tab-strip {
        display: flex; align-items: center; justify-content: space-between;
        padding: 9px 18px;
        font-family: "SFMono-Regular", "JetBrains Mono", "Courier New", monospace;
        font-size: 10px; letter-spacing: 0.05em;
    }
    .lg-wrap.light .lg-card-tab-strip { border-bottom: 1px solid #eef1f6; color: #64748b; }
    .lg-wrap.dark .lg-card-tab-strip { border-bottom: 1px solid #1c212c; color: #7d8797; }
    .lg-card-status { display: inline-flex; align-items: center; gap: 5px; }
    .lg-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--lg-ok); box-shadow: 0 0 0 2px rgba(22,163,74,0.18); }

    .lg-card-head { padding: 20px 24px 4px; }
    .lg-card-head.is-centered { text-align: center; }
    .lg-title { font-size: clamp(19px, 3.6vw, 23px); font-weight: 800; line-height: 1.28; letter-spacing: -0.01em; margin: 0 0 6px; }
    .lg-title .accent {
        background: linear-gradient(135deg, var(--lg-accent), var(--lg-accent-3) 50%, var(--lg-accent-2));
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
    }
    .lg-subtitle { font-size: 12.5px; line-height: 1.55; opacity: 0.65; margin: 0; }

    .lg-card-body { padding: 16px 24px 22px; }
    .lg-card-foot {
        padding: 14px 24px; font-size: 12.5px;
    }
    .lg-wrap.light .lg-card-foot { border-top: 1px solid #eef1f6; }
    .lg-wrap.dark .lg-card-foot { border-top: 1px solid #1c212c; }
    .lg-card-foot a { color: var(--lg-accent); font-weight: 700; text-decoration: none; }
    .lg-card-foot a:hover { text-decoration: underline; }

    .lg-stage-legal { max-width: 400px; margin: 12px auto 0; text-align: center; font-size: 10.5px; opacity: 0.45; line-height: 1.5; }

    /* ============ FOLDER TABS (register wizard) ============ */
    .lg-folder-tabs { display: flex; padding: 0 12px; gap: 2px; }
    .lg-folder-tab {
        flex: 1; min-width: 0; padding: 9px 4px 8px; text-align: center;
        border: none; cursor: default; background: transparent;
        font-size: 9.5px; font-weight: 700;
        letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.4;
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        border-bottom: 2px solid transparent;
    }
    .lg-folder-tab span.n { font-family: "SFMono-Regular", "JetBrains Mono", monospace; font-size: 10px; }
    .lg-folder-tab.is-active { opacity: 1; color: var(--lg-accent); border-bottom-color: var(--lg-accent); }
    .lg-folder-tab.is-done { opacity: 0.75; color: var(--lg-ok); }
    .lg-folder-tab:not(:disabled) { cursor: pointer; }

    /* ============ LEDGER ROWS ============ */
    .lg-row { display: flex; gap: 12px; padding: 12px 0; align-items: flex-start; }
    .lg-wrap.light .lg-row + .lg-row { border-top: 1px solid #f1f4f9; }
    .lg-wrap.dark .lg-row + .lg-row { border-top: 1px solid #1c212c; }
    .lg-row-index {
        flex-shrink: 0; width: 20px; padding-top: 2px;
        font-family: "SFMono-Regular", "JetBrains Mono", "Courier New", monospace;
        font-size: 11px; font-weight: 700; color: var(--lg-accent); opacity: 0.85;
    }
    .lg-row-body { flex: 1; min-width: 0; }
    .lg-row-body--pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 420px) { .lg-row-body--pair { grid-template-columns: 1fr; gap: 10px; } }
    .lg-row-label {
        display: flex; align-items: center; gap: 5px;
        font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
        opacity: 0.55; margin-bottom: 5px;
    }
    .lg-required { color: var(--lg-danger); opacity: 1; margin-left: 1px; }

    .lg-input {
        width: 100%; padding: 6px 2px 8px; background: transparent;
        font-size: 14.5px; color: inherit;
        outline: none; border: none; border-radius: 0;
        transition: border-color 0.18s ease;
    }
    .lg-wrap.light .lg-input { border-bottom: 1.5px solid #d9e0ec; }
    .lg-wrap.dark .lg-input { border-bottom: 1.5px solid #2a3140; }
    .lg-input:focus { border-bottom-color: var(--lg-accent); }
    .lg-input[aria-invalid="true"] { border-bottom-color: var(--lg-danger); }
    .lg-input::placeholder { opacity: 0.35; }
    .lg-select { appearance: none; -webkit-appearance: none; cursor: pointer; }
    /* Open dropdown lists are drawn by the browser, so they ignore the card's
       colours (light text on a white list in dark mode). Set the scheme and
       colour options + college headings explicitly for both themes. */
    .lg-wrap.dark .lg-select { color-scheme: dark; }
    .lg-wrap.light .lg-select { color-scheme: light; }
    .lg-wrap.dark .lg-select option,
    .lg-wrap.dark .lg-select optgroup { background-color: #161b26; color: #f1f5fb; }
    .lg-wrap.light .lg-select option,
    .lg-wrap.light .lg-select optgroup { background-color: #ffffff; color: #111827; }
    .lg-select optgroup { font-style: normal; font-weight: 700; }
    .lg-select optgroup option { font-weight: 400; }
    .lg-wrap.dark .lg-select optgroup { color: #93b4ff; }
    .lg-wrap.light .lg-select optgroup { color: #1d4ed8; }
    .lg-wrap.dark .lg-select option:disabled { color: #8b95a7; }
    .lg-wrap.light .lg-select option:disabled { color: #6b7280; }

    .lg-password-wrap { position: relative; display: flex; align-items: center; }
    .lg-password-wrap .lg-input { padding-right: 30px; }
    .lg-eye {
        position: absolute; right: 0; bottom: 6px; background: none; border: none;
        cursor: pointer; opacity: 0.5; padding: 2px; display: flex;
    }
    .lg-eye:hover { opacity: 0.9; }

    .lg-row-hint { display: block; font-size: 10.5px; opacity: 0.5; margin-top: 5px; }
    .lg-row-error-text { color: #e2543a; opacity: 0.95; font-weight: 600; }

    .lg-radio-row { display: flex; flex-wrap: wrap; gap: 6px 16px; padding-top: 6px; }
    .lg-radio { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; opacity: 0.85; cursor: pointer; }
    .lg-radio input { width: 14px; height: 14px; accent-color: var(--lg-accent); cursor: pointer; }

    /* ============ AVATAR (register step 1) ============ */
    .lg-avatar-row { display: flex; align-items: center; gap: 14px; padding-top: 4px; }
    .lg-avatar-frame {
        width: 58px; height: 58px; border-radius: 14px; flex-shrink: 0; cursor: pointer;
        display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;
    }
    .lg-wrap.light .lg-avatar-frame { background: #f4f7fb; border: 1.5px dashed #c7cfe0; }
    .lg-wrap.dark .lg-avatar-frame { background: #161a24; border: 1.5px dashed #2a3140; }
    .lg-avatar-frame img { width: 100%; height: 100%; object-fit: cover; }
    .lg-avatar-frame:hover { border-color: var(--lg-accent); }
    .lg-avatar-actions { display: flex; flex-direction: column; gap: 3px; }
    .lg-avatar-btn { font-size: 11.5px; font-weight: 700; color: var(--lg-accent); background: none; border: none; padding: 0; cursor: pointer; text-align: left; width: fit-content; }
    .lg-avatar-btn:hover { text-decoration: underline; }
    .lg-avatar-btn.danger { color: var(--lg-danger); }

    /* ============ STRENGTH TICKS ============ */
    .lg-strength { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .lg-strength-ticks { display: flex; gap: 3px; flex: 1; }
    .lg-strength-ticks span { flex: 1; height: 4px; border-radius: 2px; background: rgba(127,127,127,0.22); }
    .lg-strength-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }

    /* ============ CHECKLIST ============ */
    .lg-checklist { margin: 14px 0 4px; padding: 11px 13px; border-radius: 12px; }
    .lg-wrap.light .lg-checklist { background: rgba(79,70,229,0.06); border: 1px solid rgba(79,70,229,0.16); }
    .lg-wrap.dark .lg-checklist { background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); }
    .lg-checklist-title { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; margin-bottom: 7px; }
    .lg-checklist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 10px; }
    .lg-checklist-item { display: flex; align-items: center; gap: 6px; font-size: 11.5px; opacity: 0.5; }
    .lg-checklist-item.is-ok { opacity: 1; color: var(--lg-ok); }

    .lg-match { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-top: 7px; font-weight: 600; }
    .lg-match.is-ok { color: var(--lg-ok); }
    .lg-match.is-bad { color: var(--lg-danger); }

    /* ============ BANNER ============ */
    /* Plain block text, not flex — banners here are just prose (possibly
       with an inline <strong>), and display: flex was treating the
       plain-text runs around the <strong> as separate anonymous flex
       items, each wrapping independently onto its own narrow column
       instead of reading as one paragraph. */
    .lg-banner {
        padding: 10px 13px; border-radius: 12px; font-size: 12.5px; line-height: 1.55;
        margin-bottom: 14px; word-break: break-word;
    }
    .lg-banner--error { background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.3); color: var(--lg-danger); }
    .lg-banner--notice { background: rgba(22,163,74,0.10); border: 1px solid rgba(22,163,74,0.3); color: var(--lg-ok); }

    /* ============ STAMP ============ */
    .lg-stamp {
        display: flex; width: fit-content; align-items: center; justify-content: center;
        margin: 6px auto 18px; padding: 10px 22px;
        border: 2.5px solid var(--lg-ok); border-radius: 10px;
        color: var(--lg-ok); font-weight: 800; font-size: 15px; letter-spacing: 0.14em;
        transform: rotate(-4deg); opacity: 0.9;
    }

    /* ============ BUTTONS ============ */
    .lg-submit {
        width: 100%; padding: 12px 16px; margin-top: 6px;
        border: none; border-radius: 12px; cursor: pointer;
        color: #fff;
        background: linear-gradient(135deg, var(--lg-accent), var(--lg-accent-3) 50%, var(--lg-accent-2));
        box-shadow: 0 10px 24px rgba(79,70,229,0.3);
        font-size: 13.5px; font-weight: 700;
        letter-spacing: 0.03em; text-transform: uppercase;
        transition: opacity 0.18s ease, transform 0.08s ease;
    }
    .lg-submit:hover { opacity: 0.92; }
    .lg-submit:active { transform: translateY(1px); }
    .lg-submit:disabled { opacity: 0.55; cursor: not-allowed; }

    .lg-ghost {
        padding: 12px 16px; border-radius: 12px; cursor: pointer; background: transparent;
        font-size: 13.5px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.03em; flex-shrink: 0;
    }
    .lg-wrap.light .lg-ghost { border: 1.5px solid #d9e0ec; color: #0b1220; }
    .lg-wrap.dark .lg-ghost { border: 1.5px solid #2a3140; color: #e7ecf3; }
    .lg-wrap.light .lg-ghost:hover { background: #f4f7fb; }
    .lg-wrap.dark .lg-ghost:hover { background: rgba(255,255,255,0.05); }

    .lg-actions-row { display: flex; gap: 10px; align-items: center; }
    .lg-actions-row .lg-submit { flex: 1; margin-top: 0; }
    @media (max-width: 380px) {
        .lg-actions-row { flex-direction: column-reverse; align-items: stretch; }
        .lg-actions-row .lg-ghost { width: 100%; }
    }

    .lg-row-checkbox { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding-top: 2px; }
    .lg-remember { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; opacity: 0.8; cursor: pointer; }
    .lg-remember input { width: 14px; height: 14px; accent-color: var(--lg-accent); cursor: pointer; }
    .lg-forgot { font-size: 12.5px; font-weight: 700; color: var(--lg-accent); text-decoration: none; }
    .lg-forgot:hover { text-decoration: underline; }

    /* ============ Short-viewport compaction ============ */
    @media (max-height: 700px) {
        .lg-card-head { padding: 16px 22px 2px; }
        .lg-card-body { padding: 12px 22px 18px; }
        .lg-subtitle { display: none; }
    }
    @media (prefers-reduced-motion: reduce) { .lg-card, .lg-rail-blob { animation: none !important; } }

    /* =====================================================================
       MOBILE APP UI  (phones, portrait only — desktop/landscape untouched)
       App bar on top, borderless form centred, legal line pinned to bottom.
       Palette follows the logo blue (#003078): dark = navy centre with
       lighter-blue glowing edges, light = pale sky / white-blue.
       ===================================================================== */
    @media (max-width: 767px) and (orientation: portrait) {
        .lg-wrap { --lg-accent: #2563eb; --lg-accent-2: #38bdf8; --lg-accent-3: #1d4ed8; }
        .lg-wrap.dark { --lg-accent: #60a5fa; --lg-accent-3: #3b82f6; }

        .lg-wrap.light {
            color: #0a1a3a;
            background:
                radial-gradient(120% 55% at 50% -8%, rgba(37,99,235,0.16), transparent 62%),
                radial-gradient(100% 45% at 50% 112%, rgba(56,189,248,0.20), transparent 62%),
                linear-gradient(180deg, #f5f9ff 0%, #e8f1ff 100%);
        }
        .lg-wrap.dark {
            color: #e6efff;
            background:
                radial-gradient(ellipse 85% 75% at 50% 50%, #030c1f 38%, #0a2d6e 100%),
                #030c1f;
        }

        .lg-stage {
            flex-direction: column; align-items: stretch; justify-content: flex-start;
            padding: 0;
        }

        /* ---- App bar ---- */
        .lg-appbar {
            position: sticky; top: 0; right: auto; z-index: 5;
            width: 100%; justify-content: space-between; gap: 12px;
            padding: calc(env(safe-area-inset-top, 0px) + 10px) 18px 10px;
            -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
        }
        .lg-wrap.light .lg-appbar { background: rgba(240,246,255,0.72); border-bottom: 1px solid rgba(37,99,235,0.10); }
        .lg-wrap.dark .lg-appbar { background: rgba(3,12,31,0.6); border-bottom: 1px solid rgba(96,165,250,0.14); }

        .lg-appbar .lg-mobile-brand { display: flex; margin: 0; gap: 11px; min-width: 0; }
        .lg-appbar .lg-mobile-brand img { width: 42px; height: 42px; border-radius: 0; }
        .lg-appbar .lg-mobile-brand > span { font-size: 15px; font-weight: 800; line-height: 1.2; letter-spacing: 0.01em; }
        .lg-appbar .lg-mobile-brand > span span { font-size: 10px; margin-top: 2px; opacity: 0.7; letter-spacing: 0.09em; }

        .lg-theme-toggle { width: 42px; height: 42px; border-radius: 14px; }
        .lg-wrap.light .lg-theme-toggle { background: #fff; border-color: #cfe0fa; color: #1d4ed8; box-shadow: 0 4px 12px rgba(37,99,235,0.10); }
        .lg-wrap.dark .lg-theme-toggle { background: rgba(96,165,250,0.12); border-color: rgba(96,165,250,0.28); color: #bfdbfe; }

        /* ---- Body: form in the middle, legal pinned to bottom ---- */
        .lg-stage-inner {
            flex: 1 1 auto; max-width: none; width: 100%; margin: 0;
            padding: 0 22px; align-items: stretch;
        }

        /* Remove the boxed card — the form sits directly on the screen. */
        .lg-card,
        .lg-card.is-wide,
        .lg-wrap.light .lg-card,
        .lg-wrap.dark .lg-card {
            width: 100%; max-width: 440px; margin: auto;
            background: transparent; border: none; box-shadow: none; border-radius: 0;
        }

        .lg-card-tab-strip { padding: 18px 0 12px; border-bottom: none !important; font-size: 10.5px; }
        .lg-card-status {
            padding: 4px 10px; border-radius: 999px; font-weight: 700;
            background: rgba(22,163,74,0.12); color: var(--lg-ok);
        }

        .lg-card-head { padding: 4px 0 2px; }
        .lg-title { font-size: 28px; line-height: 1.2; margin-bottom: 8px; }
        .lg-subtitle { display: block; font-size: 14px; line-height: 1.55; opacity: 0.72; }

        .lg-card-body { padding: 14px 0 6px; }

        .lg-row { padding: 9px 0; gap: 12px; }
        .lg-wrap .lg-row + .lg-row { border-top: none; }
        .lg-row-index {
            width: 24px; height: 24px; padding-top: 0; margin-top: 1px;
            display: inline-flex; align-items: center; justify-content: center;
            border-radius: 8px; font-size: 10.5px; opacity: 1;
            background: rgba(37,99,235,0.12); color: var(--lg-accent);
        }
        .lg-row-label { font-size: 11.5px; margin-bottom: 8px; opacity: 0.7; }
        .lg-row-hint { font-size: 11.5px; margin-top: 7px; opacity: 0.62; }

        /* App-style filled inputs (16px font stops iOS zoom-on-focus) */
        .lg-input {
            height: 52px; padding: 0 16px; font-size: 16px;
            border-radius: 14px; -webkit-appearance: none; appearance: none;
        }
        .lg-wrap.light .lg-input { background: #fff; border: 1.5px solid #cfe0fa; }
        .lg-wrap.dark .lg-input { background: rgba(96,165,250,0.07); border: 1.5px solid rgba(96,165,250,0.24); }
        .lg-wrap .lg-input:focus { border-color: var(--lg-accent); box-shadow: 0 0 0 4px rgba(37,99,235,0.16); }
        .lg-wrap .lg-input[aria-invalid="true"] { border-color: var(--lg-danger); }
        .lg-input::placeholder { opacity: 0.4; }

        .lg-wrap .lg-password-wrap .lg-input { padding-right: 52px; }
        .lg-eye {
            right: 4px; bottom: auto; top: 50%; transform: translateY(-50%);
            width: 44px; height: 44px; padding: 0; justify-content: center; align-items: center;
        }

        .lg-row-checkbox { padding-top: 4px; }
        .lg-remember, .lg-forgot { font-size: 13.5px; }
        .lg-remember input { width: 19px; height: 19px; }

        .lg-submit {
            height: 54px; padding: 0 16px; margin-top: 12px; border-radius: 16px; font-size: 15px;
            background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #0ea5e9 130%);
            box-shadow: 0 12px 26px rgba(29,78,216,0.34);
        }
        .lg-ghost { height: 54px; padding: 0 16px; border-radius: 16px; }

        .lg-card-foot { padding: 20px 0 6px; text-align: center; font-size: 14px; border-top: none !important; }

        .lg-stage-legal {
            max-width: 440px; width: 100%; margin: 0 auto;
            padding: 18px 4px calc(env(safe-area-inset-bottom, 0px) + 16px);
            font-size: 11px; opacity: 0.62; line-height: 1.55;
        }
    }
`;