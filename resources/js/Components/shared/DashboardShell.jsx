import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import RefreshButton from "./RefreshButton";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useToast } from "../../context/ToastContext";
import usePreventInspect, { guardImageEvents, ZoomWarningModal } from "../../hooks/usePreventInspect";
import logo from "../../assets/images/site-logo.png";
import AccountMenu from "./AccountMenu";
import GlobalSearchBar from "./GlobalSearchBar";
import Tooltip from "./Tooltip";
import HelpHints from "./HelpHints";
import NotificationBell from "./NotificationBell";
import useIsPhone from "../../hooks/useIsPhone";
import "./DashboardShell.css";
// Imported AFTER DashboardShell.css on purpose: its phone-only overrides
// rely on coming later in the cascade.
import MobileBottomNav from "./MobileBottomNav";
import {
    LayoutDashboard,
    PackageSearch,
    Megaphone,
    PanelLeftClose,
    PanelLeftOpen,
    X,
    LogOut,
    ChevronDown,
    ChevronUp,
    UserCircle,
    Palette,
    Check,
    ClipboardCheck,
    Bell,
    Boxes,
    QrCode,
    ShieldCheck,
    PackageCheck,
    ListOrdered,
    History,
    AlertTriangle,
    UserCheck,
    Wrench,
    Menu,
    Activity,
    Handshake,
} from "../icons";

// The five themes offered from the account menu's "Theme" picker. 'white'
// (Default) and 'black' (Dark) are plain — the same two the public login
// page toggles between. 'maroon' / 'blue' / 'yellow' are light, color-
// tinted themes matching each program's color (maroon for BSIT, blue for
// BEED/BSED, yellow for BSBA) — students aren't locked to their program's
// color, it's just offered as an option alongside the two plain modes.
const THEME_OPTIONS = [
    { key: "white", label: "Default" },
    { key: "black", label: "Dark" },
    { key: "blue", label: "Blue" },
    { key: "yellow", label: "Yellow" },
    { key: "maroon", label: "Maroon" },
];
const themeLabel = (key) => THEME_OPTIONS.find((t) => t.key === key)?.label || "Default";

// Shared "Theme" row + its "Choose Theme" flyout, used inside both the
// header and sidebar account menus. Picking an option no longer closes
// anything — it deliberately leaves both the popover and the parent
// account menu open, so the person can click through a few themes to
// compare them without the panel disappearing after the first pick.
//
// `side` (horizontal) and `align` (vertical) are independent:
//   - `side`: "left" opens toward the left, "right" opens toward the
//     right — pick whichever side actually has open screen space.
//   - `align`: "bottom" shares the account menu box's bottom edge
//     ("same ground"), "top" shares its top edge — matches whichever
//     way that particular account menu itself grows (sidebar menu grows
//     upward off the trigger, so its flyout is bottom-aligned; header
//     menu drops down, so its flyout is top-aligned).
const ThemePicker = ({ open, onToggle, current, onPick, side = "right", align = "top" }) => (
    <div className="ds-theme-row-wrap">
        <button
            type="button"
            className="ds-menu-item"
            onClick={onToggle}
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={open}
        >
            <Palette size={16} />
            Theme
            <span className="ds-theme-pill">{themeLabel(current)}</span>
        </button>
        {open && (
            <div
                className={`ds-theme-popover ds-theme-popover-side-${side} ds-theme-popover-align-${align}`}
                role="menu"
            >
                <div className="ds-theme-popover-title">Choose Theme</div>
                {THEME_OPTIONS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        className="ds-theme-option"
                        onClick={() => onPick(t.key)}
                        role="menuitemradio"
                        aria-checked={current === t.key}
                    >
                        <span className={`ds-theme-swatch ds-theme-swatch-${t.key}`} />
                        {t.label}
                        {current === t.key && <Check size={15} className="ds-theme-check" />}
                    </button>
                ))}
            </div>
        )}
    </div>
);

// Nav model per role. Each item now carries a lucide-react icon component
// instead of an emoji, so the sidebar reads as a real product UI.
const NAV_BY_ROLE = {
    student: [
        { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/app/lost-items", label: "Lost Items", icon: PackageSearch },
        { to: "/app/lost-items/create", label: "Report Lost Item", icon: Megaphone },
        { to: "/app/found-items", label: "Found Items", icon: PackageSearch },
        { to: "/app/found-items/create", label: "Report Found Item", icon: Megaphone },
        { to: "/app/claims", label: "My Claims", icon: ClipboardCheck },
        { to: "/app/incidents", label: "Security Incidents", icon: AlertTriangle },
        { to: "/app/service-requests", label: "Service Requests", icon: Wrench },
        { to: "/app/notifications", label: "Notifications", icon: Bell },
    ],
    security_officer: [
        { to: "/app/security/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/app/security/counter", label: "Counter", icon: PackageCheck },
        { to: "/app/security/counter-dashboard", label: "Counter Dashboard", icon: ListOrdered },
        { to: "/app/security/found-items", label: "Found Item Reviews", icon: PackageSearch },
        // Security is the hands-on handler of lost & found, so it sees the
        // lost reports too and works the match queue (not just found reviews).
        { to: "/app/lost-items", label: "Lost Items", icon: PackageSearch },
        { to: "/app/security/matches", label: "Matches", icon: Handshake },
        { to: "/app/security/claims", label: "Claims", icon: ClipboardCheck },
        { to: "/app/security/inventory", label: "Inventory", icon: Boxes },
        { to: "/app/security/unclaimed-items", label: "Unclaimed Items", icon: AlertTriangle },
        { to: "/app/incidents", label: "Incidents", icon: ShieldCheck },
        { to: "/app/service-requests", label: "Service Requests", icon: Wrench },
        { to: "/app/security/assets", label: "Assets", icon: Boxes },
        { to: "/app/security/visitors", label: "Visitors", icon: UserCheck },
        { to: "/app/security/qr-scanner", label: "QR Release Scanner", icon: QrCode },
        { to: "/app/security/history", label: "History", icon: History },
        { to: "/app/notifications", label: "Notifications", icon: Bell },
    ],
    admin: [
        { to: "/app/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/app/lost-items", label: "Lost Items", icon: PackageSearch },
        { to: "/app/found-items", label: "Found Items", icon: PackageSearch },
        // Same match queue Security works (admin oversees; staff can view,
        // actions need admin approval).
        { to: "/app/security/matches", label: "Matches", icon: Handshake },
        { to: "/app/claims", label: "Claims", icon: ClipboardCheck },
        { to: "/app/admin/users", label: "Users", icon: UserCircle },
        // Admin: approve/pending/reject staff requests. Staff: their own requests.
        { to: "/app/admin/requests", label: "Staff Requests", icon: ClipboardCheck, adminOnly: true },
        { to: "/app/admin/audit-log", label: "Audit Log", icon: ShieldCheck },
        // Raw request-level feed (IP/device/spam flags) — deliberately a
        // separate page from Audit Log above, which is the curated
        // "what actions happened" trail. See Admin\UserActivityController.
        { to: "/app/admin/activity", label: "User Activity", icon: Activity },
        // No separate /app/admin/counter-dashboard route exists — this
        // points straight at the security path, which ProtectedRoute
        // already allows admins into (securityRoutes' requiredRoles
        // includes 'admin'), same as how officers reach it.
        { to: "/app/security/counter-dashboard", label: "Counter Dashboard", icon: ListOrdered },
        // Same reuse pattern as Counter Dashboard above — no separate
        // /app/admin/unclaimed-items route, admins hit the security path.
        { to: "/app/security/unclaimed-items", label: "Unclaimed Items", icon: AlertTriangle },
        // /app/incidents is already open to any authenticated user and
        // self-scopes to "everything" for admin/officer roles inside the
        // controller — no separate /app/admin/incidents route needed.
        { to: "/app/incidents", label: "Incidents", icon: ShieldCheck },
        { to: "/app/service-requests", label: "Service Requests", icon: Wrench },
        { to: "/app/security/assets", label: "Assets", icon: Boxes },
        { to: "/app/security/visitors", label: "Visitors", icon: UserCheck },
        // Same Counter/Lost & Found release history Security sees at
        // /app/security/history — admins get their own nav entry into it too,
        // for oversight of what officers are checking in/releasing.
        { to: "/app/admin/history", label: "History", icon: History },
        { to: "/app/notifications", label: "Notifications", icon: Bell },
    ],
};

// Phone-only bottom tab bar (see MobileBottomNav.jsx). Four shortcuts per
// role — the pages that person opens most — and the fifth tab is always
// "Menu", which opens the full sidebar above (so everything NAV_BY_ROLE
// lists is still one tap away). Instructors share the "student" set.
//
//   to        must match a route in NAV_BY_ROLE
//   label     short text shown under the icon (must fit ~60px)
//   fullLabel optional longer name for screen readers
//
// To change what a role gets, just edit its four entries here.
const MOBILE_TABS_BY_ROLE = {
    student: [
        { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/app/lost-items", label: "Lost Items", icon: PackageSearch },
        { to: "/app/found-items", label: "Found Items", icon: PackageCheck },
        { to: "/app/claims", label: "My Claims", icon: ClipboardCheck },
    ],
    // Follows the intake → claim → release pipeline an officer works
    // through. Counter, Inventory, Visitors etc. live under Menu.
    security_officer: [
        { to: "/app/security/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/app/security/found-items", label: "Reviews", fullLabel: "Found Item Reviews", icon: PackageCheck },
        { to: "/app/security/claims", label: "Claims", icon: ClipboardCheck },
        { to: "/app/security/qr-scanner", label: "Scan", fullLabel: "QR Release Scanner", icon: QrCode },
    ],
    admin: [
        { to: "/app/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/app/security/counter-dashboard", label: "Counter", fullLabel: "Counter Dashboard", icon: ListOrdered },
        { to: "/app/lost-items", label: "Lost Items", icon: PackageSearch },
        { to: "/app/found-items", label: "Found Items", icon: PackageCheck },
    ],
};

const COLLAPSE_KEY = "sclf-sidebar-collapsed";

// Every page renders its own <DashboardShell>, so the sidebar is rebuilt on
// each navigation and its scroll position would reset to the top (hiding
// links near the bottom, like Notifications). This module-level value
// survives those remounts so the sidebar stays exactly where it was.
let savedNavScrollTop = 0;
const DESKTOP_QUERY = "(min-width: 960px)";

// Shared branded shell for every "logged in" screen (student + admin).
// Layout model: sidebar + header are pinned in place (never move); only
// the main content pane scrolls. Sidebar is fully visible on its own —
// no internal scrollbar — and can collapse to icons-only on desktop via
// the header burger, or slide over as an overlay on mobile.
const DashboardShell = ({ title, subtitle, eyebrow, actions, onRefresh, refreshing = false, children }) => {
    const { user, roles, logout } = useAuth();
    const { theme, setTheme } = useAppTheme();
    const toast = useToast();
    // Right-click / DevTools / browser-zoom guard — same behavior as the
    // public auth pages. See usePreventInspect.jsx to toggle site-wide.
    const { zoomModalOpen, closeZoomModal } = usePreventInspect();
    const isDark = theme === "black";
    const navigate = useNavigate();
    const location = useLocation();
    // True only on real phones (touch + phone-sized screen). Everything
    // phone-specific below is gated on this, so desktop/laptop/tablet
    // behave exactly as before.
    const isPhone = useIsPhone();

    const [menuOpen, setMenuOpen] = useState(false);
    const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
    const [themePickerOpen, setThemePickerOpen] = useState(false);
    const [sidebarThemePickerOpen, setSidebarThemePickerOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem(COLLAPSE_KEY) === "1";
    });
    // Tracks the same breakpoint that turns the sidebar from a persistent
    // column into a slide-over overlay. The sidebar's own account menu uses
    // this to switch how it positions itself: on desktop it's a flyout
    // pinned to the sidebar's right edge (plenty of room beside it); on
    // mobile/tablet, where the screen is nowhere near as wide, that same
    // flyout math pushes the panel almost off the right edge of the phone.
    // Below the breakpoint it instead anchors to the trigger button's own
    // left edge and grows upward — the same "pop up near the control that
    // opened it" behavior the header's account menu already has. See the
    // AccountMenu placement prop further down.
    const [isDesktopWidth, setIsDesktop] = useState(() => {
        if (typeof window === "undefined") return true;
        return window.matchMedia(DESKTOP_QUERY).matches;
    });
    // A phone always uses the slide-over sidebar, even a big one turned
    // sideways that is wider than the desktop breakpoint. For every
    // non-phone this is identical to the plain width check.
    const isDesktop = isDesktopWidth && !isPhone;
    // The icons-only collapsed rail is a desktop feature; a phone's
    // slide-over should never inherit it from a saved desktop preference.
    const railCollapsed = collapsed && !isPhone;

    // Top-of-header route progress bar. "idle" | "is-active" | "is-done".
    // Fires on every route change — a sidebar nav click, the account menu's
    // Profile link, logging out, anything that changes location.pathname —
    // by watching the router's own location, so it doesn't need every page
    // to individually report when it's "done"; it just plays a short,
    // NProgress-style sweep across the top edge of the header on navigation.
    const [routeProgress, setRouteProgress] = useState("idle");
    const isFirstRoute = useRef(true);
    useEffect(() => {
        if (isFirstRoute.current) {
            // Don't play it on first mount/initial page load — only on
            // subsequent in-app navigations.
            isFirstRoute.current = false;
            return;
        }
        setRouteProgress("is-active");
        const toDone = setTimeout(() => setRouteProgress("is-done"), 380);
        const toIdle = setTimeout(() => setRouteProgress("idle"), 700);
        return () => {
            clearTimeout(toDone);
            clearTimeout(toIdle);
        };
    }, [location.pathname]);

    // Fires the "Welcome back" toast once the person has actually landed
    // on a real dashboard-shell page — not at the moment they submitted
    // the login form. LoginPage sets this sessionStorage flag right
    // before routing through the MainPage loading screen; this is the
    // first DashboardShell mount after that screen hands off, so it's
    // the right moment to show it. Runs once per mount and immediately
    // clears the flag so navigating around the app afterward (or a
    // plain page refresh) doesn't replay it.
    useEffect(() => {
        try {
            if (window.sessionStorage.getItem('sclf-login-toast') === '1') {
                window.sessionStorage.removeItem('sclf-login-toast');
                toast.success('You have successfully logged in.', { title: 'Welcome back' });
            }
            // Same handoff, but for a brand-new account — RegisterPage sets
            // this flag right before routing through the MainPage loading
            // screen, so it fires here once they've actually landed instead
            // of mid-transition.
            if (window.sessionStorage.getItem('sclf-register-toast') === '1') {
                window.sessionStorage.removeItem('sclf-register-toast');
                toast.success('Welcome to SCLF! Your account has been created.', { title: 'Account created' });
            }
        } catch (e) {
            // ignore storage errors (private mode etc.)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Trigger-button refs (used by AccountMenu to compute where the portal
    // menu should be positioned) and menu refs (the portal's own root node)
    // — both are checked on outside-click since the menus themselves now
    // render outside their trigger's DOM subtree, in a portal.
    const menuTriggerRef = useRef(null);
    const menuRef = useRef(null);
    const sidebarMenuTriggerRef = useRef(null);
    const sidebarMenuRef = useRef(null);
    // Ref to the sidebar <nav> itself — the sidebar account menu flies out
    // from this element's right edge (see placement="top-after" below),
    // rather than from wherever the trigger button sits, so it lands in the
    // same spot whether the sidebar is collapsed or expanded.
    const sidebarRef = useRef(null);
    const navScrollRef = useRef(null);


    const isAdmin = Array.isArray(roles) && (roles.includes("admin") || roles.includes("staff"));
    const isSecurity = Array.isArray(roles) && roles.includes("security_officer");
    const navRole = isAdmin ? "admin" : isSecurity ? "security_officer" : "student";
    // Items flagged adminOnly (e.g. Staff Requests) are hidden from staff.
    const isStaffOnly = Array.isArray(roles) && roles.includes("staff") && !roles.includes("admin");
    const navItems = useMemo(
        () => NAV_BY_ROLE[navRole].filter((item) => !(item.adminOnly && isStaffOnly)),
        [navRole, isStaffOnly]
    );
    const homePath = isAdmin ? "/app/admin/dashboard" : isSecurity ? "/app/security/dashboard" : "/app/dashboard";
    const navLabel = isAdmin ? (roles.includes("admin") ? "Admin" : "Staff") : isSecurity ? "Security Officer" : roles.includes("instructor") ? "Instructor" : "Student";
    const mobileTabs = MOBILE_TABS_BY_ROLE[navRole];

    const handleLogout = async () => {
        try {
            await logout();
        } finally {
            navigate("/login", { replace: true });
        }
    };

    // Highlights exactly ONE nav link at a time. A plain `startsWith`
    // check (the old approach) lit up BOTH "Lost Items" (/lost-items)
    // and "Report Lost Item" (/lost-items/create) whenever you were on
    // the create page, since "/lost-items/create" also starts with
    // "/lost-items" — same for "Found Items" vs "Report Found Item".
    // Instead, find the single BEST match across every nav item (exact
    // match, or the longest "/prefix/" match), so a more specific route
    // like "/lost-items/create" always wins over its shorter sibling
    // "/lost-items" rather than lighting up both at once.
    const activeNavTo = React.useMemo(() => {
        const path = location.pathname;
        let best = null;
        for (const item of navItems) {
            const matches = item.end
                ? path === item.to
                : path === item.to || path.startsWith(`${item.to}/`);
            if (matches && (!best || item.to.length > best.length)) {
                best = item.to;
            }
        }
        return best;
    }, [location.pathname, navItems]);

    const isActive = (item) => item.to === activeNavTo;

    // Restore the sidebar's scroll position after a route change, and make
    // sure the active link is visible (e.g. when opened directly on a page
    // whose link sits below the fold).
    useLayoutEffect(() => {
        const el = navScrollRef.current;
        if (!el) return;
        el.scrollTop = savedNavScrollTop;
        const activeLink = el.querySelector(".ds-nav-link.active");
        if (activeLink) {
            // Measure with bounding rects, NOT offsetTop: in the collapsed
            // icon rail each link sits inside a positioned tooltip wrapper,
            // so offsetTop is relative to that wrapper (~0) and would
            // wrongly scroll the sidebar back to the top.
            const c = el.getBoundingClientRect();
            const r = activeLink.getBoundingClientRect();
            if (r.height > 0) {
                if (r.top < c.top) el.scrollTop += r.top - c.top - 8;
                else if (r.bottom > c.bottom) el.scrollTop += r.bottom - c.bottom + 8;
            }
        }
        savedNavScrollTop = el.scrollTop;
        // navItems.length: the role's links can arrive after the first render.
    }, [navItems.length, railCollapsed]);

    const initials = (user?.name || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("");

    // When the logged-in account has an uploaded profile picture, the
    // avatar bubble in both the sidebar (bottom-left) and the header
    // (top-right) shows that photo instead of the initials fallback —
    // same treatment the Profile page itself already uses.
    const avatarStyle = user?.profile_picture_url
        ? {
              backgroundImage: `url(${user.profile_picture_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
          }
        : undefined;
    const avatarContent = user?.profile_picture_url ? null : initials || "U";

    // Single burger button drives two different behaviours depending on
    // viewport: collapse the persistent sidebar on desktop, or open/close
    // the slide-over overlay on mobile.
    const handleBurgerClick = () => {
        if (isDesktop) {
            setCollapsed((v) => {
                const next = !v;
                try {
                    window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
                } catch (e) {
                    // ignore storage errors (private mode etc.)
                }
                return next;
            });
        } else {
            setSidebarOpen((v) => !v);
        }
    };

    // Phone sidebar: close it whenever the route changes (browser back
    // button, a notification deep-link, etc. — link clicks already close it
    // themselves) and on Escape, so the tab bar always comes back.
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!sidebarOpen) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") setSidebarOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [sidebarOpen]);

    // Close the account dropdown on outside click / Escape instead of the
    // previous onMouseLeave (which closed the menu the instant the mouse
    // drifted off it, before a click could register).
    useEffect(() => {
        if (!menuOpen) {
            setThemePickerOpen(false);
            return;
        }
        const onClick = (e) => {
            if (menuTriggerRef.current?.contains(e.target)) return;
            if (menuRef.current?.contains(e.target)) return;
            setMenuOpen(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [menuOpen]);

    // Same pattern for the sidebar's own account dropdown (bottom-left).
    useEffect(() => {
        if (!sidebarMenuOpen) {
            setSidebarThemePickerOpen(false);
            return;
        }
        const onClick = (e) => {
            if (sidebarMenuTriggerRef.current?.contains(e.target)) return;
            if (sidebarMenuRef.current?.contains(e.target)) return;
            setSidebarMenuOpen(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") setSidebarMenuOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [sidebarMenuOpen]);

    // Close the mobile overlay automatically if the viewport grows past
    // the desktop breakpoint while it's open.
    useEffect(() => {
        const mq = window.matchMedia(DESKTOP_QUERY);
        const onChange = (e) => {
            setIsDesktop(e.matches);
            if (e.matches) setSidebarOpen(false);
        };
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);

    return (
        <>
        <div className={`ds-shell ds-layout ${theme} ${isDark ? "dark" : "light"} ${isPhone ? "ds-phone" : ""}`}>
                <div
                    className={`ds-sidebar-backdrop ${sidebarOpen ? "open" : ""}`}
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden={!sidebarOpen}
                />

                <nav id="ds-sidebar" ref={sidebarRef} className={`ds-sidebar ${sidebarOpen ? "open" : ""} ${railCollapsed ? "collapsed" : ""}`}>
                    {/* Phone-only (CSS hides it elsewhere): explicit close,
                        which also brings the bottom tab bar back. */}
                    <button
                        type="button"
                        className="ds-icon-btn ds-sidebar-close"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close menu"
                    >
                        <X size={18} />
                    </button>
                    <Link
                        to={homePath}
                        className="ds-brand"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <img src={logo} alt="SCLF Logo" {...guardImageEvents} />
                        <span className="ds-brand-text">
                            <span className="ds-brand-name">SCLF</span>
                            <span className="ds-brand-sub">Opol Community College</span>
                        </span>
                    </Link>

                    <div className="ds-nav-label">{navLabel}</div>

                    {/* Everything below the nav label that can outgrow the
                        sidebar's own height (nav links + spacer) now lives
                        in its own scroll container, instead of the whole
                        sidebar being `overflow: hidden`. This is what fixes
                        short viewports — mobile landscape phones especially,
                        where the sidebar overlay's height barely fits half
                        the nav — being unable to reach the lower nav items:
                        the brand row, nav label, and the account footer
                        below all stay pinned in place, and only this middle
                        region scrolls. The scrollbar itself is hidden (see
                        .ds-nav-scroll in the CSS) so it doesn't look like a
                        classic browser scrollbar wedged into the sidebar —
                        scrolling still works via touch/drag/wheel. */}
                    <div className="ds-nav-scroll" ref={navScrollRef} onScroll={(e) => { savedNavScrollTop = e.currentTarget.scrollTop; }}>
                        <ul className="ds-nav">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item);
                                const link = (
                                    <Link
                                        to={item.to}
                                        className={`ds-nav-link ${active ? "active" : ""}`}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <span className="ds-nav-icon">
                                            <Icon size={18} strokeWidth={2} active={active} />
                                        </span>
                                        <span className="ds-nav-text">{item.label}</span>
                                    </Link>
                                );
                                return (
                                    <li key={item.to}>
                                        {railCollapsed ? <Tooltip label={item.label} side="right">{link}</Tooltip> : link}
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="ds-sidebar-spacer" />
                    </div>

                    {/* Phones don't show the pinned page footer (the tab bar
                        replaces it), so the developer credit lives here. */}
                    {isPhone && (
                        <div className="ds-sidebar-credit">
                            <span className="ds-footer-credit">
                                {"</> "}Developed by{" "}
                                <a
                                    href="https://antiquina-folio.vercel.app/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ds-footer-credit-link"
                                >
                                    {"</> "}Antiquina, Jonee John R.
                                </a>
                            </span>
                        </div>
                    )}

                    {/* Single Account control pinned at the very bottom of the
                        sidebar. Opens a menu (Profile / theme / log out) via
                        AccountMenu, which portals it into <body> and
                        positions it from the trigger's real on-screen
                        position — never clipped by the sidebar's own
                        `overflow: hidden`.
                        - Desktop (>=960px): a flyout pinned to the sidebar's
                          own right edge, so it lands in the same spot
                          whether the sidebar is collapsed or expanded.
                        - Mobile/tablet (<960px): there isn't room beside a
                          250px-wide sidebar on a phone-width screen, so it
                          instead anchors to the trigger button's own left
                          edge and grows upward — the same "pop up near the
                          control that opened it" behavior as the header's
                          account menu, instead of a flyout that gets
                          clamped hard against the screen's right edge. */}
                    <div className="ds-sidebar-footer">
                        <div className="ds-sidebar-menu-wrap">
                            <AccountMenu
                                open={sidebarMenuOpen}
                                onClose={() => setSidebarMenuOpen(false)}
                                triggerRef={sidebarMenuTriggerRef}
                                alignRef={isDesktop ? sidebarRef : undefined}
                                menuRef={sidebarMenuRef}
                                placement={isDesktop ? "level-after" : "level-start"}
                                offset={12}
                                width={260}
                                theme={isDark ? "dark" : "light"}
                                flyoutOpen={sidebarThemePickerOpen}
                                className="ds-menu ds-sidebar-menu"
                            >
                                <div className="ds-menu-name">{user?.name || "Account"}</div>
                                <div className="ds-menu-email">{user?.email || ""}</div>
                                <div className="ds-menu-divider" />
                                <Link
                                    to="/app/profile"
                                    className="ds-menu-item"
                                    onClick={() => setSidebarMenuOpen(false)}
                                    role="menuitem"
                                >
                                    <UserCircle size={16} /> Profile
                                </Link>
                                <ThemePicker
                                    open={sidebarThemePickerOpen}
                                    onToggle={() => setSidebarThemePickerOpen((v) => !v)}
                                    current={theme}
                                    onPick={(key) => setTheme(key)}
                                    side="right"
                                    align="bottom"
                                />
                                <div className="ds-menu-divider" />
                                <button
                                    type="button"
                                    className="ds-menu-item danger"
                                    onClick={handleLogout}
                                    role="menuitem"
                                >
                                    <LogOut size={16} /> Log out
                                </button>
                            </AccountMenu>

                            <button
                                type="button"
                                ref={sidebarMenuTriggerRef}
                                className="ds-user-row ds-user-row-btn"
                                onClick={() => setSidebarMenuOpen((v) => !v)}
                                aria-label="Account menu"
                                aria-expanded={sidebarMenuOpen}
                                aria-haspopup="true"
                                title={railCollapsed ? user?.name || "Account" : undefined}
                            >
                                <span className="ds-avatar" style={avatarStyle}>{avatarContent}</span>
                                <div className="ds-user-text" style={{ minWidth: 0 }}>
                                    <div className="ds-user-name">{user?.name || "Account"}</div>
                                    <div className="ds-user-email">{user?.email || ""}</div>
                                </div>
                                <ChevronUp size={15} className="ds-user-row-chevron" />
                            </button>
                        </div>
                    </div>
                </nav>

                <div className="ds-content">
                    <header className="ds-topbar">
                        <div
                            className={`ds-route-progress ${routeProgress !== "idle" ? routeProgress : ""}`}
                            aria-hidden="true"
                        />
                        <div className="ds-topbar-left">
                            <Tooltip label={isPhone ? "Menu" : railCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
                                <button
                                    type="button"
                                    className="ds-icon-btn ds-hamburger"
                                    onClick={handleBurgerClick}
                                    aria-label={isPhone ? "Open menu" : railCollapsed ? "Expand sidebar" : "Toggle sidebar"}
                                >
                                    {sidebarOpen ? (
                                        <span className="ds-hamburger-icon" key="x"><X size={18} /></span>
                                    ) : isPhone ? (
                                        <span className="ds-hamburger-icon" key="menu"><Menu size={18} /></span>
                                    ) : railCollapsed ? (
                                        <span className="ds-hamburger-icon" key="open"><PanelLeftOpen size={18} /></span>
                                    ) : (
                                        <span className="ds-hamburger-icon" key="close"><PanelLeftClose size={18} /></span>
                                    )}
                                </button>
                            </Tooltip>
                            <Link to={homePath} className="ds-topbar-brand">
                                <img src={logo} alt="SCLF Logo" {...guardImageEvents} />
                                <span>SCLF</span>
                            </Link>
                        </div>

                        <div className="ds-topbar-actions">
                            <GlobalSearchBar />
                            <HelpHints roles={roles} navRole={navRole} isDark={isDark} />
                            <NotificationBell isDark={isDark} />
                            <div className="ds-menu-wrap">
                                <button
                                    type="button"
                                    ref={menuTriggerRef}
                                    className="ds-profile-btn"
                                    onClick={() => setMenuOpen((v) => !v)}
                                    aria-label="Account menu"
                                    aria-expanded={menuOpen}
                                    aria-haspopup="true"
                                >
                                    <span className="ds-avatar" style={avatarStyle}>{avatarContent}</span>
                                    <span className="ds-profile-btn-name">{user?.name || "Account"}</span>
                                    <ChevronDown size={16} className="ds-profile-chevron" />
                                </button>

                                <AccountMenu
                                    open={menuOpen}
                                    onClose={() => setMenuOpen(false)}
                                    triggerRef={menuTriggerRef}
                                    menuRef={menuRef}
                                    placement="bottom-end"
                                    width={220}
                                    theme={isDark ? "dark" : "light"}
                                    flyoutOpen={themePickerOpen}
                                    className="ds-menu"
                                >
                                    <div className="ds-menu-name">{user?.name || "Account"}</div>
                                    <div className="ds-menu-email">{user?.email || ""}</div>
                                    <div className="ds-menu-divider" />
                                    <Link
                                        to="/app/profile"
                                        className="ds-menu-item"
                                        onClick={() => setMenuOpen(false)}
                                        role="menuitem"
                                    >
                                        <UserCircle size={16} /> Profile
                                    </Link>
                                    <ThemePicker
                                        open={themePickerOpen}
                                        onToggle={() => setThemePickerOpen((v) => !v)}
                                        current={theme}
                                        onPick={(key) => setTheme(key)}
                                        side="left"
                                        align="top"
                                    />
                                    <div className="ds-menu-divider" />
                                    <button
                                        type="button"
                                        className="ds-menu-item danger"
                                        onClick={handleLogout}
                                        role="menuitem"
                                    >
                                        <LogOut size={16} /> Log out
                                    </button>
                                </AccountMenu>
                            </div>
                        </div>
                    </header>

                    <main className="ds-main">
                        {(title || actions || onRefresh) && (
                            <div className="ds-header">
                                <div className="ds-header-text">
                                    {eyebrow && <span className="ds-eyebrow">{eyebrow}</span>}
                                    {title && <h1 className="ds-title">{title}</h1>}
                                    {subtitle && <p className="ds-subtitle">{subtitle}</p>}
                                </div>
                                {(actions || onRefresh) && (
                                    <div className="ds-actions">
                                        {onRefresh && <RefreshButton onRefresh={onRefresh} loading={refreshing} />}
                                        {actions}
                                    </div>
                                )}
                            </div>
                        )}

                        {children}
                    </main>

                    {/* Pinned footer — part of the .ds-content flex column, same
                        as .ds-topbar above. It never scrolls with the page;
                        only .ds-main (between the topbar and this footer) does.
                        On phones held in portrait, everything collapses down to
                        just the developer credit; landscape phones/tablets and
                        desktop show the full row. */}
                    {isPhone ? (
                        <MobileBottomNav
                            tabs={mobileTabs}
                            pathname={location.pathname}
                            hidden={sidebarOpen}
                            menuOpen={sidebarOpen}
                            onMenu={() => setSidebarOpen(true)}
                            sidebarId="ds-sidebar"
                        />
                    ) : (
                    <footer className="ds-footer">
                        <div className="ds-footer-inner">
                            <span className="ds-footer-credit">
                                {"</> "}Developed by{" "}
                                <a
                                    href="https://antiquina-folio.vercel.app/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ds-footer-credit-link"
                                >
                                    {"</> "}Antiquina, Jonee John R.
                                </a>
                            </span>

                            <span className="ds-footer-sep ds-footer-extra" aria-hidden="true">|</span>

                            <div className="ds-footer-links ds-footer-extra">
                                <span className="ds-footer-badge">
                                    <ShieldCheck size={12} /> Secure
                                </span>
                                <span className="ds-footer-dot">•</span>
                                <span className="ds-footer-badge">
                                    <PackageSearch size={12} /> Lost &amp; Found
                                </span>
                                <span className="ds-footer-dot">•</span>
                                <span className="ds-footer-badge">
                                    <Boxes size={12} /> Opol Community College
                                </span>
                            </div>

                            <span className="ds-footer-sep ds-footer-extra" aria-hidden="true">|</span>

                            <span className="ds-footer-copy ds-footer-extra">
                                © {new Date().getFullYear()} SCLF • Built with ❤️
                            </span>
                        </div>
                    </footer>
                    )}
                </div>
            </div>

            <ZoomWarningModal open={zoomModalOpen} onClose={closeZoomModal} />
        </>
    );
};

export default DashboardShell;