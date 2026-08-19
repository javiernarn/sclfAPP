import React from "react";
import { Link } from "react-router-dom";
import { Search, Megaphone, Handshake, Sun, Moon } from "../icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import logo from "../../assets/images/site-logo.png";

const FEATURES = [
    { icon: Search, text: "Search everything reported lost around campus" },
    { icon: Megaphone, text: "Report a lost item in under a minute" },
    { icon: Handshake, text: "Get matched with items found by the community" },
];

// Split-screen auth shell: branding/story panel on the LEFT, the actual
// form on the RIGHT — the form is the primary task, so it sits in the
// stronger reading position (top-left → down) while the brand panel sets
// context first, the way a printed letterhead would.
//
// The whole shell is viewport-locked (position: fixed, 100dvh) so nothing
// ever produces a page-level scrollbar: the branding panel is fixed/static,
// and only the form column can scroll internally, purely as a safety net
// for very short screens — in normal use every step fits without scrolling.
//
// On mobile, only the form is shown in portrait; rotating to landscape (or
// widening past tablet size) reveals both panels side by side.
const AuthLayout = ({ eyebrow = "Secure Session", title, subtitle, children, footer, panelTitle, panelSubtitle, wide = false }) => {
    const { theme, toggleTheme } = useAppTheme();
    const isDark = theme === "black";

    return (
        <>
            <style>{`
                .al-wrapper {
                    position: fixed;
                    inset: 0;
                    width: 100%;
                    height: 100dvh;
                    display: flex;
                    overflow: hidden;
                    transition: background 0.4s ease, color 0.4s ease;
                    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto,
                        "Helvetica Neue", Arial, sans-serif;
                }
                .al-wrapper, .al-wrapper * { box-sizing: border-box; }
                .al-wrapper.light { color: #0b1220; background: #eef1f8; }
                .al-wrapper.dark { color: #e7ecf3; background: #0a0c12; }

                /* ===== LEFT: branding / story panel ===== */
                .al-panel {
                    position: relative;
                    flex: 1 1 42%;
                    min-width: 0;
                    height: 100%;
                    display: none;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: clamp(24px, 3.6vw, 52px);
                    color: #fff;
                    overflow: hidden;
                    background:
                        radial-gradient(700px 420px at 15% 8%, rgba(255,255,255,0.16), transparent 60%),
                        radial-gradient(600px 500px at 100% 100%, rgba(14,165,233,0.35), transparent 60%),
                        linear-gradient(155deg, #4f46e5 0%, #6d28d9 55%, #0ea5e9 120%);
                }
                /* Branding panel: hidden by default (mobile portrait shows the
                   form only). It reappears whenever the viewport is in
                   landscape orientation — covering mobile landscape as well
                   as tablets/desktops, which are landscape by default. */
                @media (orientation: landscape) { .al-panel { display: flex; } }
                /* Very short landscape (small phones rotated) — the story
                   panel is a nice-to-have, not essential; drop it so the
                   form gets the full, short viewport instead of squeezing. */
                @media (orientation: landscape) and (max-height: 380px) { .al-panel { display: none; } }

                .al-blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.5; pointer-events: none; animation: al-float 16s ease-in-out infinite; }
                .al-blob-1 { width: 320px; height: 320px; background: #a5b4fc; top: -80px; left: -60px; }
                .al-blob-2 { width: 380px; height: 380px; background: #67e8f9; bottom: -140px; right: -100px; animation-duration: 20s; }
                @keyframes al-float { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-18px) scale(1.06); } }

                .al-panel-top { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
                .al-panel-logo { width: 42px; height: 42px; border-radius: 12px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; padding: 7px; flex-shrink: 0; }
                .al-panel-logo img { width: 100%; height: 100%; object-fit: contain; }
                .al-panel-brand { font-weight: 800; font-size: 15px; line-height: 1.2; }
                .al-panel-brand span { display: block; font-weight: 600; font-size: 11px; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.08em; }

                .al-panel-mid { position: relative; z-index: 1; max-width: 380px; overflow: hidden; }
                .al-panel-title { font-size: clamp(22px, 2.4vw, 32px); font-weight: 800; line-height: 1.2; margin: 0 0 12px; letter-spacing: -0.01em; }
                .al-panel-sub { font-size: 14px; line-height: 1.55; opacity: 0.88; margin: 0 0 22px; }

                .al-feature-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
                .al-feature { display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 600; }
                .al-feature-icon { width: 30px; height: 30px; border-radius: 9px; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22); display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }

                .al-panel-bottom { position: relative; z-index: 1; font-size: 11px; opacity: 0.7; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; flex-shrink: 0; }

                /* ===== RIGHT: form panel ===== */
                .al-form-panel {
                    flex: 1 1 58%;
                    min-width: 0;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding: clamp(16px, 3vw, 40px);
                    padding-top: max(clamp(16px, 3vw, 40px), env(safe-area-inset-top));
                    padding-bottom: max(clamp(16px, 3vw, 40px), env(safe-area-inset-bottom));
                    scrollbar-width: thin;
                    scrollbar-color: rgba(127,127,127,0.35) transparent;
                }
                .al-form-panel::-webkit-scrollbar { width: 6px; }
                .al-form-panel::-webkit-scrollbar-track { background: transparent; }
                .al-form-panel::-webkit-scrollbar-thumb { background: rgba(127,127,127,0.3); border-radius: 999px; }

                .al-card {
                    position: relative; z-index: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    text-align: left;
                    width: 100%;
                    max-width: 380px;
                    margin: auto;
                    border-radius: 22px;
                    padding: clamp(22px, 3vw, 34px) clamp(20px, 3vw, 34px);
                    animation: al-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                .al-wrapper.light .al-card { background: #ffffff; border: 1px solid #e7eaf3; box-shadow: 0 24px 48px -18px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.04); }
                .al-wrapper.dark .al-card { background: #10131b; border: 1px solid #1f2530; box-shadow: 0 24px 48px -18px rgba(0,0,0,0.55); }
                .al-card.is-wide { max-width: 560px; }
                .al-card > form,
                .al-card > .al-error,
                .al-card > .al-notice,
                .al-card > .al-footer {
                    width: 100%;
                }
                @keyframes al-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

                .al-mobile-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; text-decoration: none; color: inherit; }
                .al-mobile-brand img { width: 34px; height: 34px; object-fit: contain; border-radius: 10px; }
                .al-mobile-brand-text { font-weight: 800; font-size: 13.5px; line-height: 1.2; }
                .al-mobile-brand-text span { display: block; font-weight: 600; font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.06em; }
                @media (orientation: landscape) { .al-mobile-brand { display: none; } }

                .al-chip {
                    display: inline-flex; align-items: center; gap: 8px;
                    flex-shrink: 0;
                    padding: 6px 14px; border-radius: 999px;
                    font-size: 10.5px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase;
                    background: rgba(79, 70, 229, 0.10);
                    border: 1px solid rgba(79, 70, 229, 0.28);
                    color: #4f46e5; margin: 0 0 14px;
                    white-space: nowrap;
                }
                .al-chip .pulse { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,0.6); animation: al-pulse 1.8s ease-in-out infinite; }
                @keyframes al-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); } 50% { box-shadow: 0 0 0 8px rgba(34,197,94,0); } }

                .al-title { font-size: clamp(20px, 4.4vw, 25px); font-weight: 800; letter-spacing: -0.01em; margin: 0 0 5px; color: inherit; width: 100%; line-height: 1.2; }
                .al-title .grad {
                    background: linear-gradient(135deg, #4f46e5, #7c3aed 50%, #0ea5e9);
                    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
                }
                .al-sub { margin: 0 0 20px; font-size: 13px; opacity: 0.65; color: inherit; width: 100%; line-height: 1.5; }

                .al-field { width: 100%; text-align: left; }
                .al-field label { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; opacity: 0.62; margin-bottom: 6px; }
                .al-field input {
                    width: 100%; padding: 11px 14px; border-radius: 12px;
                    font-size: 15px; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease;
                    box-sizing: border-box;
                    -webkit-appearance: none; appearance: none;
                }
                .al-wrapper.light .al-field input { background: #fbfcfe; border: 1px solid #d9e0ec; color: #0b1220; }
                .al-wrapper.dark .al-field input { background: #12161f; border: 1px solid #2a3140; color: #e7ecf3; }
                .al-field input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }

                /* Icon-prefixed inputs (mirrors alumniApp's antd Input prefix icons) */
                .al-field-icon { position: relative; }
                .al-field-icon svg.al-input-icon {
                    position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
                    opacity: 0.5; pointer-events: none;
                }
                .al-field-icon input { padding-left: 42px; }
                .al-field-icon .al-toggle-visibility {
                    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                    background: none; border: none; padding: 4px; cursor: pointer; opacity: 0.55;
                    display: flex; align-items: center; justify-content: center;
                }
                .al-field-icon .al-toggle-visibility:hover { opacity: 0.9; }
                .al-field-icon.has-toggle input { padding-right: 42px; }

                .al-field select {
                    width: 100%; padding: 11px 14px; border-radius: 12px;
                    font-size: 15px; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease;
                    box-sizing: border-box; -webkit-appearance: none; appearance: none;
                }
                .al-wrapper.light .al-field select { background: #fbfcfe; border: 1px solid #d9e0ec; color: #0b1220; }
                .al-wrapper.dark .al-field select { background: #12161f; border: 1px solid #2a3140; color: #e7ecf3; }
                .al-field select:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }

                .al-hint { font-size: 11px; opacity: 0.55; margin-top: 5px; }

                /* Password strength meter */
                .al-strength { margin-top: 8px; }
                .al-strength__head { display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 700; opacity: 0.7; margin-bottom: 4px; }
                .al-strength__bar { height: 6px; border-radius: 999px; background: rgba(127,127,127,0.18); overflow: hidden; }
                .al-strength__bar > div { height: 100%; border-radius: 999px; transition: width 0.25s ease, background 0.25s ease; }

                /* Requirements checklist */
                .al-req-card { border-radius: 12px; padding: 11px 14px; margin: 12px 0; }
                .al-wrapper.light .al-req-card { background: rgba(79,70,229,0.05); border: 1px solid rgba(79,70,229,0.15); }
                .al-wrapper.dark .al-req-card { background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); }
                .al-req-card__title { font-size: 11.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; opacity: 0.85; }
                .al-req-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
                .al-req-item { display: flex; align-items: center; gap: 6px; font-size: 11.5px; opacity: 0.55; }
                .al-req-item.is-ok { opacity: 1; color: #16a34a; }
                .al-req-item svg { flex-shrink: 0; }

                .al-match { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-top: 6px; }
                .al-match.is-ok { color: #16a34a; }
                .al-match.is-bad { color: #ef4444; }

                /* Avatar / profile picture upload */
                .al-avatar-upload { display: flex; align-items: center; gap: 14px; margin-bottom: 4px; }
                .al-avatar-circle {
                    width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0;
                    display: flex; align-items: center; justify-content: center; overflow: hidden;
                    cursor: pointer; position: relative;
                }
                .al-wrapper.light .al-avatar-circle { background: #eef1f8; border: 2px dashed #c7cfe0; }
                .al-wrapper.dark .al-avatar-circle { background: #12161f; border: 2px dashed #2a3140; }
                .al-avatar-circle img { width: 100%; height: 100%; object-fit: cover; }
                .al-avatar-circle:hover { border-color: #6366f1; }
                .al-avatar-meta { display: flex; flex-direction: column; gap: 3px; }
                .al-avatar-btn {
                    font-size: 12px; font-weight: 700; color: #4f46e5; background: none; border: none;
                    padding: 0; cursor: pointer; text-align: left; width: fit-content;
                }
                .al-avatar-btn:hover { text-decoration: underline; }
                .al-avatar-remove { color: #ef4444; }

                .al-fieldset-title { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.5; margin: 18px 0 10px; }
                .al-fieldset-title:first-child { margin-top: 0; }

                .al-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                @media (max-width: 420px) { .al-grid-2 { grid-template-columns: 1fr; } }

                .al-radio-row { display: flex; flex-wrap: wrap; gap: 8px 16px; }
                .al-radio { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; opacity: 0.85; cursor: pointer; user-select: none; }
                .al-radio input { width: 15px; height: 15px; margin: 0; cursor: pointer; accent-color: #4f46e5; }

                .al-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 12px 0 20px; flex-wrap: wrap; }
                .al-remember { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; opacity: 0.85; cursor: pointer; user-select: none; }
                .al-remember input {
                    width: 16px; height: 16px; margin: 0; cursor: pointer; accent-color: #4f46e5;
                }
                .al-forgot { font-size: 13px; font-weight: 700; color: #4f46e5; text-decoration: none; }
                .al-forgot:hover { text-decoration: underline; }

                .al-btn {
                    width: 100%; padding: 12px 16px;
                    border: none; border-radius: 12px; font-size: 14.5px; font-weight: 700; color: #fff;
                    background: linear-gradient(135deg, #4f46e5, #7c3aed 50%, #0ea5e9);
                    cursor: pointer; transition: opacity 0.2s ease, transform 0.1s ease;
                    box-shadow: 0 10px 24px rgba(79,70,229,0.3);
                }
                .al-btn:hover { opacity: 0.92; }
                .al-btn:active { transform: translateY(1px); }
                .al-btn:disabled { opacity: 0.6; cursor: not-allowed; }

                .al-error {
                    background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.3);
                    color: #ef4444; font-size: 12.5px; padding: 10px 14px; border-radius: 12px; margin-bottom: 16px;
                }
                .al-notice {
                    background: rgba(34,197,94,0.10); border: 1px solid rgba(34,197,94,0.3);
                    color: #16a34a; font-size: 12.5px; padding: 10px 14px; border-radius: 12px; margin-bottom: 16px;
                }
                .al-footer { margin-top: 18px; font-size: 13px; text-align: left; opacity: 0.8; color: inherit; }
                .al-footer a { color: #4f46e5; font-weight: 700; text-decoration: none; }
                .al-footer a:hover { text-decoration: underline; }

                .al-theme-toggle {
                    position: absolute; top: 16px; right: 16px; z-index: 2;
                    width: 34px; height: 34px; border-radius: 10px; border: none; cursor: pointer;
                    display: inline-flex; align-items: center; justify-content: center; font-size: 16px;
                }
                .al-wrapper.light .al-theme-toggle { background: rgba(255,255,255,0.85); border: 1px solid #e2e8f0; }
                .al-wrapper.dark .al-theme-toggle { background: rgba(255,255,255,0.08); border: 1px solid #2a3140; }

                /* Short-viewport compaction — laptops with small browser
                   windows, or phones in landscape. Trims the header and
                   field rhythm so a full step keeps fitting without
                   forcing the inner scrollbar to kick in. */
                @media (max-height: 700px) {
                    .al-card { padding: clamp(16px, 2.4vw, 26px) clamp(18px, 2.6vw, 28px); }
                    .al-mobile-brand { margin-bottom: 14px; }
                    .al-chip { margin-bottom: 10px; }
                    .al-title { margin-bottom: 4px; }
                    .al-sub { margin-bottom: 14px; }
                }
                @media (max-height: 520px) {
                    .al-sub { display: none; }
                    .al-mobile-brand { margin-bottom: 10px; }
                }

                @media (prefers-reduced-motion: reduce) {
                    .al-blob, .al-card { animation: none !important; }
                }
            `}</style>

            <div className={`al-wrapper ${isDark ? "dark" : "light"}`}>
                <button type="button" className="al-theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                    {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
                </button>

                {/* ============ LEFT: BRANDING PANEL ============ */}
                <aside className="al-panel">
                    <span className="al-blob al-blob-1" />
                    <span className="al-blob al-blob-2" />

                    <div className="al-panel-top">
                        <span className="al-panel-logo"><img src={logo} alt="SCLF Logo" /></span>
                        <span className="al-panel-brand">SCLF<span>Opol Community College</span></span>
                    </div>

                    <div className="al-panel-mid">
                        <h2 className="al-panel-title">{panelTitle || "Smart Campus Lost & Found"}</h2>
                        <p className="al-panel-sub">
                            {panelSubtitle || "The fastest way to reunite students and staff with what they've misplaced around campus — report, browse, and get matched, all in one place."}
                        </p>
                        <ul className="al-feature-list">
                            {FEATURES.map((f) => {
                                const Icon = f.icon;
                                return (
                                    <li className="al-feature" key={f.text}>
                                        <span className="al-feature-icon"><Icon size={16} strokeWidth={2} /></span>
                                        {f.text}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div className="al-panel-bottom">Empowering a safer, connected campus</div>
                </aside>

                {/* ============ RIGHT: FORM PANEL ============ */}
                <div className="al-form-panel">
                    <div className={`al-card${wide ? " is-wide" : ""}`}>
                        <Link to="/" className="al-mobile-brand">
                            <img src={logo} alt="SCLF Logo" />
                            <span className="al-mobile-brand-text">SCLF<span>Opol Community College</span></span>
                        </Link>

                        <span className="al-chip">
                            <span className="pulse" />
                            {eyebrow}
                        </span>

                        <h1 className="al-title">{title}</h1>
                        {subtitle && <p className="al-sub">{subtitle}</p>}

                        {children}

                        {footer && <div className="al-footer">{footer}</div>}
                    </div>
                </div>
            </div>
        </>
    );
};

export default AuthLayout;
