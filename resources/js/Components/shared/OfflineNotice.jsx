import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../../i18n";

// Tracks the browser's online/offline state.
export function useOnlineStatus() {
    const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener("online", up);
        window.addEventListener("offline", down);
        return () => {
            window.removeEventListener("online", up);
            window.removeEventListener("offline", down);
        };
    }, []);
    return online;
}

// The banner no longer floats over the page. While it is visible, <html> gets
// the `sclf-offbar` class and the layout becomes: [banner][app]. The app
// (#app) is made the containing block for every `position: fixed` screen
// (login, dashboard sidebar, bottom nav, modals…) and shrinks to the space
// under the banner, so the header / login page is pushed DOWN instead of being
// covered. When the connection returns, the class is removed and everything
// goes back to normal.
const OFFBAR_CSS = `
    html.sclf-offbar body { display: flex; flex-direction: column; }
    html.sclf-offbar #app {
        flex: 1 1 auto; min-height: 0; height: auto;
        position: relative; overflow: hidden; /* no scrollbars: the app is viewport-locked */
        transform: translateZ(0); /* fixed children now measure from #app, not the screen */
    }
    html.sclf-offbar #app .al-wrapper,
    html.sclf-offbar #app .lg-wrap,
    html.sclf-offbar #app .ds-shell,
    html.sclf-offbar #app .mp-wrapper,
    html.sclf-offbar #app .vp-page { height: 100% !important; }
    html.sclf-offbar body { width: 100%; max-width: 100vw; overflow-x: hidden; }
    .sclf-offbar-host { flex: 0 0 auto; width: 100%; max-width: 100vw; min-width: 0; overflow: hidden; }
    .sclf-offbar-bar {
        box-sizing: border-box; position: relative; z-index: 2000;
        width: 100%; max-width: 100%; min-width: 0;
        display: flex; align-items: center; justify-content: center; gap: 10px;
        padding: calc(env(safe-area-inset-top, 0px) + 8px)
                 calc(env(safe-area-inset-right, 0px) + 14px)
                 8px
                 calc(env(safe-area-inset-left, 0px) + 14px);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        text-align: center; color: #fff;
        box-shadow: 0 4px 16px rgba(2,6,23,0.25);
    }
    .sclf-offbar-bar > span { min-width: 0; white-space: normal; overflow-wrap: anywhere; text-wrap: balance; }
    /* Phones: slightly smaller text and tighter padding so the message wraps
       neatly on every width (320px compact phones up to large ones). */
    @media (max-width: 480px) {
        .sclf-offbar-bar { font-size: 12.5px; padding-left: calc(env(safe-area-inset-left, 0px) + 10px); padding-right: calc(env(safe-area-inset-right, 0px) + 10px); }
    }
    @media (max-width: 360px) {
        .sclf-offbar-bar { font-size: 12px; line-height: 1.35; }
    }
`;

/**
 * OfflineNotice — a banner that appears the moment the connection drops and
 * confirms when it is back, in the language the person picked. Mounted once in
 * main.jsx so it covers every screen (login, dashboard, everything). It sits
 * ABOVE the app and pushes it down; it never covers the header.
 */
export default function OfflineNotice() {
    const online = useOnlineStatus();
    const { t } = useTranslation();
    const [showBack, setShowBack] = useState(false);
    const wasOffline = useRef(false);

    useEffect(() => {
        if (!online) {
            wasOffline.current = true;
            setShowBack(false);
            return undefined;
        }
        if (wasOffline.current) {
            wasOffline.current = false;
            setShowBack(true);
            const id = setTimeout(() => setShowBack(false), 3000);
            return () => clearTimeout(id);
        }
        return undefined;
    }, [online]);

    const visible = !online || showBack;
    const [host, setHost] = useState(null);

    // Create the banner's slot as the FIRST thing inside <body>, directly above
    // #app, and flag <html> so the app shrinks to the space underneath it.
    // Both are undone the moment the banner goes away (back to normal).
    useLayoutEffect(() => {
        if (!visible) return undefined;
        const root = document.documentElement;
        const el = document.createElement("div");
        el.className = "sclf-offbar-host";
        const app = document.getElementById("app");
        if (app && app.parentNode) app.parentNode.insertBefore(el, app);
        else document.body.insertBefore(el, document.body.firstChild);
        root.classList.add("sclf-offbar");
        setHost(el);
        return () => {
            root.classList.remove("sclf-offbar");
            el.remove();
            setHost(null);
        };
    }, [visible]);

    if (!visible || !host) return null;

    return createPortal(
        <>
            <style>{OFFBAR_CSS}</style>
            <div
                className="sclf-offbar-bar"
                role="status"
                aria-live="polite"
                style={{ background: online ? "#15803d" : "#b45309" }}
            >
                {online ? (
                    <span>{t("offline.backOnline")}</span>
                ) : (
                    <span>
                        <strong>{t("offline.bannerTitle")}.</strong> {t("offline.bannerText")}
                    </span>
                )}
            </div>
        </>,
        host
    );
}

// Wipes the service worker + its saved copies so a reload gets the freshest
// build (a stale cached build after a deploy is a common cause of a crash).
async function hardReload() {
    try {
        if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
        }
        if (window.caches) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
        }
    } catch (e) { /* best effort */ }
    window.location.reload();
}

// What kind of failure was it?
//   "offline" — the device really has no internet
//   "stale"   — online, but a page file is missing (new deploy, old cached build)
//   "error"   — the screen itself crashed (a bug / bad data / server problem)
function classifyError(error) {
    const msg = String(error?.message || "");
    const chunkFailure = /dynamically imported module|Loading chunk|Importing a module script failed|Failed to fetch|error loading dynamically/i.test(msg);
    const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
    if (chunkFailure && !online) return "offline";
    if (chunkFailure) return "stale";
    return "error";
}

/**
 * ConnectionErrorScreen — shown instead of a blank page when a screen crashes
 * or a page chunk fails to download. The wording depends on the real cause:
 * no internet, a just-deployed update, or an actual error in the system.
 */
export function ConnectionErrorScreen({ onRetry, error }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const kind = error ? classifyError(error) : "offline";
    const code = error ? `${error.name || "Error"}: ${String(error.message || "").slice(0, 160)}` : "";

    const copy = {
        offline: { icon: "📡", title: t("offline.screenTitle"), text: t("offline.screenText"), btn: t("offline.retry") },
        stale: { icon: "🔄", title: t("offline.staleTitle"), text: t("offline.staleText"), btn: t("offline.staleRetry") },
        error: { icon: "⚠️", title: t("offline.errorTitle"), text: t("offline.errorText"), btn: t("offline.retry") },
    }[kind];

    const retry = () => {
        setBusy(true);
        if (kind === "offline") onRetry?.();
        else hardReload();
    };

    return (
        <div
            role="alert"
            style={{
                minHeight: "100dvh", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 12,
                padding: 24, textAlign: "center", fontFamily: "inherit",
                background: "var(--ds-bg, #f8fafc)", color: "var(--ds-text, #0b1220)",
            }}
        >
            <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden="true">{copy.icon}</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{copy.title}</h1>
            <p style={{ margin: 0, maxWidth: 440, fontSize: 14.5, lineHeight: 1.6, opacity: 0.75 }}>
                {copy.text}
            </p>
            {kind === "error" && (
                <ol style={{ margin: "4px 0 0", padding: 0, listStylePosition: "inside", maxWidth: 440, fontSize: 13.5, lineHeight: 1.7, opacity: 0.8, textAlign: "left" }}>
                    <li>{t("offline.errorStep1")}</li>
                    <li>{t("offline.errorStep2")}</li>
                    <li>{t("offline.errorStep3")}</li>
                </ol>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
                <button
                    type="button"
                    onClick={retry}
                    disabled={busy}
                    style={{
                        padding: "10px 22px", borderRadius: 12, border: "none",
                        background: "var(--sx-brand-grad, #2563eb)", color: "#fff", fontWeight: 700, fontSize: 14,
                        cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
                    }}
                >
                    {busy ? t("offline.errorRetrying") : copy.btn}
                </button>
                {kind === "error" && (
                    <button
                        type="button"
                        onClick={() => { window.location.href = "/"; }}
                        style={{
                            padding: "10px 22px", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer",
                            background: "transparent", color: "inherit", border: "1.5px solid currentColor", opacity: 0.8,
                        }}
                    >
                        {t("offline.errorHome")}
                    </button>
                )}
            </div>
            {kind === "error" && code && (
                <p style={{ margin: "10px 0 0", maxWidth: 520, fontSize: 12, opacity: 0.55, wordBreak: "break-word" }}>
                    {t("offline.errorCode")}: <code>{code}</code>
                </p>
            )}
        </div>
    );
}

/**
 * ConnectionBoundary — catches render/chunk-load errors around the routes and
 * swaps the blank screen for ConnectionErrorScreen, worded for the real cause.
 * Retry: a plain re-render only when truly offline; otherwise a hard reload
 * (clears the service worker + saved copies) because re-rendering a crashed
 * screen would just crash again — which is why "Try again" used to do nothing.
 */
export class ConnectionBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
        this.retry = this.retry.bind(this);
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error) {
        // eslint-disable-next-line no-console
        console.error("Screen failed to render:", error);
    }

    retry() {
        this.setState({ error: null });
    }

    render() {
        if (this.state.error) return <ConnectionErrorScreen error={this.state.error} onRetry={this.retry} />;
        return this.props.children;
    }
}
