import React, { createContext, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, PackageCheck, AlertTriangle, Wrench, X, ChevronRight } from "../icons";
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
    },
    {
        to: "/app/found-items/create",
        icon: PackageCheck,
        tone: "found",
        title: "I found something",
        sub: "Help it get back to its owner.",
    },
    {
        to: "/app/incidents/report",
        icon: AlertTriangle,
        tone: "incident",
        title: "Report an incident",
        sub: "Tell campus security what happened.",
    },
    {
        to: "/app/service-requests/new",
        icon: Wrench,
        tone: "service",
        title: "Request a service",
        sub: "Facilities or IT help.",
    },
];

export default function MobileQuickActions({ open, onClose }) {
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
                    <h2 id="qa-title">What do you need?</h2>
                    <button type="button" className="qa-close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>
                <ul className="qa-list">
                    {QUICK_ACTIONS.map((a) => {
                        const Icon = a.icon;
                        return (
                            <li key={a.to}>
                                <Link to={a.to} className="qa-item" onClick={onClose}>
                                    <span className={`qa-icon qa-${a.tone}`}><Icon size={22} strokeWidth={1.8} /></span>
                                    <span className="qa-text">
                                        <b>{a.title}</b>
                                        <small>{a.sub}</small>
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
