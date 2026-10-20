import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme, isDarkTheme } from "../../hooks/useAppTheme";
import usePreventInspect, { ZoomWarningModal } from "../../hooks/usePreventInspect";
import { canOpenPath } from "../../utils/redirectGuard";

// Shown at "/" before we know where the visitor belongs, and again right
// after a successful login/register — same screen, same delay, same
// "figuring out where you go" job either time (mirrors alumniAPP's
// MainPage.js, adapted to sclfAPP's AuthContext instead of a raw
// userRole flag in storage).
// `routing={false}` renders only the loading screen with no redirect logic.
// Used where MainPage is just a fallback (auth check in progress, lazy chunk
// loading) — otherwise a slow chunk could trigger the 7s redirect and yank
// the person away from the page they were opening.
// Go straight to the right screen (no artificial wait).
const REDIRECT_DELAY_MS = 0;

const MainPage = ({ routing = true }) => {
    const navigate = useNavigate();
    const { user, roles, loading } = useAuth();
    const { theme } = useAppTheme();
    const isDark = isDarkTheme(theme);
    // Right-click / DevTools / browser-zoom guard — same behavior as the
    // public auth pages. See usePreventInspect.jsx to toggle site-wide.
    const { zoomModalOpen, closeZoomModal } = usePreventInspect();

    useEffect(() => {
        document.title = "Loading | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        if (!routing) return; // fallback-only usage: never redirect
        if (loading) return; // wait for the /me check to resolve first

        const t = setTimeout(() => {
            if (!user) {
                navigate("/login", { replace: true });
                return;
            }

            // A notification email's "Login to View" button stashes the
            // page it actually pointed at (a specific claim, match, found
            // item, or the Notifications list) before bouncing through
            // /login — honor that once instead of dropping the person on
            // their generic role dashboard, then clear it so it's a
            // one-time hop and not sticky across future logins.
            // Admin-created staff account that hasn't set its own
            // password/photo/name yet — send it straight to the setup
            // gate instead of a dashboard (or notification deep link)
            // it'll just get bounced out of anyway (see ProtectedRoute
            // in RootApp.jsx). Checked before the deep-link redirect
            // below on purpose — a locked account has nowhere else to go
            // yet, deep link or not.
            if (user.must_setup_profile) {
                navigate("/app/setup-account", { replace: true });
                return;
            }

            try {
                const redirect = window.sessionStorage.getItem("sclf-post-login-redirect");
                const forUid = window.sessionStorage.getItem("sclf-post-login-uid");
                window.sessionStorage.removeItem("sclf-post-login-redirect");
                window.sessionStorage.removeItem("sclf-post-login-uid");
                // A link addressed to a different account (uid mismatch) is
                // dropped: this person lands on their own dashboard instead.
                if (redirect && canOpenPath(redirect, roles || []) && (!forUid || String(user.id) === String(forUid))) {
                    navigate(redirect, { replace: true });
                    return;
                }
            } catch (e) {
                // ignore storage errors (private mode etc.) — falls through
                // to the normal role-based landing below.
            }

            if (roles?.includes("admin") || roles?.includes("staff")) {
                navigate("/app/admin/dashboard", { replace: true });
                return;
            }
            if (roles?.includes("security_officer")) {
                navigate("/app/security/dashboard", { replace: true });
                return;
            }
            navigate("/app/dashboard", { replace: true });
        }, REDIRECT_DELAY_MS);

        return () => clearTimeout(t);
    }, [routing, loading, user, roles, navigate]);

    // No splash card / spinner here on purpose: the page that opens next has its
    // own loading state, so people see ONE loading, not two. This only paints the
    // theme's background so there is no white flash while the check finishes.
    return (
        <>
            <div
                aria-busy="true"
                style={{ height: "100dvh", width: "100%", background: isDark ? "#0a0c12" : "#f4f7fb" }}
            />
            <ZoomWarningModal open={zoomModalOpen} onClose={closeZoomModal} />
        </>
    );
};

export default React.memo(MainPage);
