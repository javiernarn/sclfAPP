import React from "react";
import { Link } from "react-router-dom";
import { Menu, Plus } from "../icons";
import "./MobileBottomNav.css";

// Bottom tab bar for real phones (see hooks/useIsPhone.js — desktop and
// laptop never render this).
//
// Four role-specific shortcut tabs + a fifth "Menu" tab. Tapping Menu opens
// the full sidebar; while the sidebar is open the bar slides out of the way,
// and slides back in as soon as the sidebar closes (`hidden` prop).
//
// The bar is a normal flex child of .ds-content (it sits exactly where the
// pinned page footer used to be on phones) rather than `position: fixed`, so
// it can never cover page content and never fights the mobile browser's
// collapsing address bar.

// A tab is "active" on its own page AND on pages nested under it, so
// /app/lost-items/create and /app/lost-items/12/matches keep "Lost Items"
// lit instead of leaving the whole bar unhighlighted.
const isTabActive = (tab, pathname) =>
    tab.end
        ? pathname === tab.to
        : pathname === tab.to || pathname.startsWith(`${tab.to}/`);

const scrollPageToTop = () => {
    const main = document.querySelector(".ds-main");
    if (main && typeof main.scrollTo === "function") {
        main.scrollTo({ top: 0, behavior: "smooth" });
    }
};

// `fab` (optional): a raised, centred create button — used by the student /
// instructor app. `menuBadge` puts an unread dot on the Menu tab.
const MobileBottomNav = ({ tabs, pathname, hidden, menuOpen, onMenu, sidebarId, fab, menuBadge }) => {
    const fabAt = fab ? Math.ceil(tabs.length / 2) : -1;
    return (
    <nav
        className={`ds-bottomnav ${hidden ? "is-hidden" : ""}`}
        aria-label="Quick navigation"
        // `inert` (not aria-hidden): hiding the bar from assistive tech while the
        // tapped Menu button still has focus is blocked by browsers. inert hides
        // it AND makes it unfocusable/untappable, with no such conflict.
        inert={hidden ? "" : undefined}
    >
        {tabs.map((tab, i) => {
            const Icon = tab.icon;
            const active = isTabActive(tab, pathname);
            return (
                <React.Fragment key={tab.to}>
                {i === fabAt && (
                    <button
                        type="button"
                        className="ds-bottomnav-fab"
                        onClick={() => { try { navigator.vibrate?.(10); } catch { /* ignore */ } fab.onClick(); }}
                        aria-label={fab.label}
                        aria-haspopup="dialog"
                        tabIndex={hidden ? -1 : undefined}
                    >
                        <span className="ds-bottomnav-fab-btn"><Plus size={26} strokeWidth={2.6} /></span>
                        <span className="ds-bottomnav-label">{fab.short || "New"}</span>
                    </button>
                )}
                <Link
                    to={tab.to}
                    className={`ds-bottomnav-item ${active ? "is-active" : ""}`}
                    aria-label={tab.fullLabel || tab.label}
                    aria-current={active ? "page" : undefined}
                    tabIndex={hidden ? -1 : undefined}
                    // Re-tapping the tab you're already on scrolls back to
                    // the top, like a native app's tab bar.
                    onClick={() => {
                        // Light haptic tick where supported (Android), like a native tab bar.
                        try { navigator.vibrate?.(8); } catch { /* ignore */ }
                        if (active) scrollPageToTop();
                    }}
                >
                    <span className="ds-bottomnav-icon">
                        <Icon size={22} strokeWidth={2} active={active} />
                    </span>
                    <span className="ds-bottomnav-label">{tab.label}</span>
                </Link>
                </React.Fragment>
            );
        })}

        <button
            type="button"
            className="ds-bottomnav-item"
            onClick={onMenu}
            aria-label="Open menu"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-controls={sidebarId}
            tabIndex={hidden ? -1 : undefined}
        >
            <span className="ds-bottomnav-icon">
                <Menu size={22} strokeWidth={2} />
                {menuBadge > 0 && <i className="ds-bottomnav-dot" aria-label={`${menuBadge} unread`} />}
            </span>
            <span className="ds-bottomnav-label">Menu</span>
        </button>
    </nav>
    );
};

export default MobileBottomNav;
