import React, { useEffect, useRef, useState } from "react";
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

const BAR = {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 2000,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    padding: "calc(env(safe-area-inset-top, 0px) + 8px) 14px 8px",
    fontSize: 13, lineHeight: 1.4, textAlign: "center", color: "#fff",
    boxShadow: "0 4px 16px rgba(2,6,23,0.25)",
};

/**
 * OfflineNotice — a banner that appears the moment the connection drops and
 * confirms when it is back, in the language the person picked. Mounted once in
 * main.jsx so it covers every screen (login, dashboard, everything).
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

    if (online && !showBack) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            style={{ ...BAR, background: online ? "#15803d" : "#b45309" }}
        >
            {online ? (
                <span>{t("offline.backOnline")}</span>
            ) : (
                <span>
                    <strong>{t("offline.bannerTitle")}.</strong> {t("offline.bannerText")}
                </span>
            )}
        </div>
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
                    background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
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
