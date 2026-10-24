import React, { createContext, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, PackageCheck, AlertTriangle, Wrench, X, ChevronRight, QrCode, UserCheck, ListOrdered, UserCircle } from "../icons";
import useRoleTranslation from "../../hooks/useRoleTranslation";
import "./MobileQuickActions.css";

// The raised "+" tab on the student/instructor tab bar opens this sheet:
// every "file something new" action in one place, one thumb-tap away from
// any screen — the same pattern native apps use for their main create button.

// Lets any page rendered inside DashboardShell (e.g. the phone home card
// "Lost something?") open the same sheet as the raised "+" tab.
export const QuickActionsContext = createContext(null);
export const useQuickActions = () => useContext(QuickActionsContext);

export const QUICK_ACTIONS = [
    {
        to: "/app/lost-items/create",
        icon: Search,
        tone: "lost",
        title: "I lost something",
        sub: "Describe it once — we'll watch for matches.",
        titleKey: "dash.qaLostTitle",
        subKey: "dash.qaLostSub",
    },
    {
        to: "/app/found-items/create",
        icon: PackageCheck,
        tone: "found",
        title: "I found something",
        sub: "Help it get back to its owner.",
        titleKey: "dash.qaFoundTitle",
        subKey: "dash.qaFoundSub",
    },
    {
        to: "/app/incidents/report",
        icon: AlertTriangle,
        tone: "incident",
        title: "Report an incident",
        sub: "Tell campus security what happened.",
        titleKey: "dash.qaIncidentTitle",
        subKey: "dash.qaIncidentSub",
    },
    {
        to: "/app/service-requests/new",
        icon: Wrench,
        tone: "service",
        title: "Request a service",
        sub: "Facilities or IT help.",
        titleKey: "dash.qaServiceTitle",
        subKey: "dash.qaServiceSub",
    },
];

// The same raised "+" tab for staff roles. Each role gets the things it files
// or starts most often on the go (the tab bar already covers the list pages).
export const SECURITY_QUICK_ACTIONS = [
    { to: "/app/security/counter", icon: PackageCheck, tone: "found", title: "Counter check-in", sub: "Take in an item handed over in person." },
    { to: "/app/security/qr-scanner", icon: QrCode, tone: "scan", title: "Scan release QR", sub: "Hand an approved claim to its owner." },
    { to: "/app/found-items/create", icon: Search, tone: "lost", title: "Log a found item", sub: "Record something turned in." },
    { to: "/app/security/visitors", icon: UserCheck, tone: "people", title: "Visitors", sub: "Check a visitor in or out." },
    { to: "/app/incidents/report", icon: AlertTriangle, tone: "incident", title: "Report an incident", sub: "Log what happened on campus." },
];

export const ADMIN_QUICK_ACTIONS = [
    { to: "/app/security/counter-dashboard", icon: ListOrdered, tone: "scan", title: "Counter dashboard", sub: "See who is waiting right now." },
    { to: "/app/found-items/create", icon: PackageCheck, tone: "found", title: "Log a found item", sub: "Record something turned in." },
    { to: "/app/admin/users", icon: UserCircle, tone: "people", title: "Manage users", sub: "Accounts, roles and approvals." },
    { to: "/app/incidents/report", icon: AlertTriangle, tone: "incident", title: "Report an incident", sub: "Log what happened on campus." },
    { to: "/app/service-requests/new", icon: Wrench, tone: "service", title: "Request a service", sub: "Facilities or IT help." },
];

export const QUICK_ACTIONS_BY_ROLE = {
    student: QUICK_ACTIONS,
    security_officer: SECURITY_QUICK_ACTIONS,
    admin: ADMIN_QUICK_ACTIONS,
};

export default function MobileQuickActions({ open, onClose, actions = QUICK_ACTIONS, title = "What do you need?" }) {
    const { t } = useRoleTranslation();
    // Esc closes it (external keyboards / emulators) and the page behind
    // doesn't scroll while the sheet is up.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="qa-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="qa-sheet" role="dialog" aria-modal="true" aria-labelledby="qa-title">
                <span className="qa-grab" aria-hidden="true" />
                <div className="qa-head">
                    <h2 id="qa-title">{title}</h2>
                    <button type="button" className="qa-close" onClick={onClose} aria-label={t("common.close")}>
                        <X size={18} />
                    </button>
                </div>
                <ul className="qa-list">
                    {actions.map((a) => {
                        const Icon = a.icon;
                        return (
                            <li key={a.to}>
                                <Link to={a.to} className="qa-item" onClick={onClose}>
                                    <span className={`qa-icon qa-${a.tone}`}><Icon size={22} strokeWidth={1.8} /></span>
                                    <span className="qa-text">
                                        <b>{a.titleKey ? t(a.titleKey) : a.title}</b>
                                        <small>{a.subKey ? t(a.subKey) : a.sub}</small>
                                    </span>
                                    <ChevronRight size={18} className="qa-chev" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
