import React, { useState } from "react";
import { useTranslation } from "../../i18n";

// SystemScreen — the ONLY thing shown while SCLF_SYSTEM_MODE is not "false".
// It is rendered by main.jsx INSTEAD of the app, so no router, login check,
// notifications, API call or page chunk runs underneath it. It therefore must
// not use any context (toast, auth, preferences…).
//
//   mode="default"     -> the "No connection" screen
//   mode="maintenance" -> the Maintenance screen
//   mode="error"       -> the "Oops! Something went wrong" screen

const CSS = `
    .sclf-sys {
        box-sizing: border-box; min-height: 100vh; min-height: 100dvh;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 12px; padding: 24px; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background: #f8fafc; color: #0b1220;
    }
    html[data-theme="black"] .sclf-sys { background: #0a0c12; color: #f1f5f9; }
    .sclf-sys h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .sclf-sys p { margin: 0; max-width: 440px; font-size: 14.5px; line-height: 1.6; opacity: .75; }
    .sclf-sys ol { margin: 4px 0 0; padding: 0; list-style-position: inside; max-width: 440px; font-size: 13.5px; line-height: 1.7; opacity: .8; text-align: left; }
    .sclf-sys-icon { font-size: 44px; line-height: 1; }
    .sclf-sys-btn {
        padding: 10px 22px; border-radius: 12px; border: none; font-weight: 700; font-size: 14px;
        color: #fff; background: var(--sx-brand-grad, #2563eb); cursor: pointer; margin-top: 6px;
    }
    .sclf-sys-btn:disabled { cursor: default; opacity: .7; }
`;

export default function SystemScreen({ mode }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);

    const copy = {
        default: {
            icon: "📡",
            title: t("offline.screenTitle"),
            text: t("offline.screenText"),
            btn: t("offline.retry"),
        },
        maintenance: {
            icon: "🛠️",
            title: t("offline.maintTitle"),
            text: t("offline.maintText"),
            note: t("offline.maintNote"),
            btn: t("offline.maintRetry"),
        },
        error: {
            icon: "⚠️",
            title: t("offline.errorTitle"),
            text: t("offline.sysErrorText"),
            steps: [t("offline.sysErrorStep1"), t("offline.sysErrorStep2")],
            btn: t("offline.retry"),
        },
    }[mode] || null;

    if (!copy) return null;

    // A plain reload: the server re-reads SCLF_SYSTEM_MODE, so once it is back
    // to "false" the person lands in the normal app.
    const retry = () => {
        setBusy(true);
        window.location.reload();
    };

    return (
        <div className="sclf-sys" role={mode === "maintenance" ? "status" : "alert"} data-system-mode={mode}>
            <style>{CSS}</style>
            <div className="sclf-sys-icon" aria-hidden="true">{copy.icon}</div>
            <h1>{copy.title}</h1>
            <p>{copy.text}</p>
            {copy.note && <p>{copy.note}</p>}
            {copy.steps && (
                <ol>
                    {copy.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
            )}
            <button type="button" className="sclf-sys-btn" onClick={retry} disabled={busy}>
                {busy ? t("offline.errorRetrying") : copy.btn}
            </button>
        </div>
    );
}
