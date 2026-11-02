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

/**
 * ConnectionErrorScreen — shown instead of a blank page when a screen crashes
 * or a page chunk fails to download (what a dropped connection looks like to
 * React). Offers a retry.
 */
export function ConnectionErrorScreen({ onRetry }) {
    const { t } = useTranslation();
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
            <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden="true">📡</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{t("offline.screenTitle")}</h1>
            <p style={{ margin: 0, maxWidth: 420, fontSize: 14.5, lineHeight: 1.6, opacity: 0.75 }}>
                {t("offline.screenText")}
            </p>
            <button
                type="button"
                onClick={onRetry}
                style={{
                    marginTop: 6, padding: "10px 22px", borderRadius: 12, border: "none",
                    background: "var(--sx-brand-grad, #2563eb)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
            >
                {t("offline.retry")}
            </button>
        </div>
    );
}

/**
 * ConnectionBoundary — catches render/chunk-load errors around the routes and
 * swaps the empty screen for ConnectionErrorScreen. Retry re-renders the tree;
 * if the failure was a stale/missing chunk it reloads the page instead.
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
        const msg = String(this.state.error?.message || "");
        const chunkFailure = /dynamically imported module|Loading chunk|Importing a module script failed|Failed to fetch/i.test(msg);
        if (chunkFailure) {
            window.location.reload();
            return;
        }
        this.setState({ error: null });
    }

    render() {
        if (this.state.error) return <ConnectionErrorScreen onRetry={this.retry} />;
        return this.props.children;
    }
}
