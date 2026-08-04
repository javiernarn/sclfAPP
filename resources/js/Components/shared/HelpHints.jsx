import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, LayoutDashboard, PackageSearch, Megaphone, ClipboardCheck, QrCode, Boxes, ShieldCheck, Users } from 'lucide-react';
import Tooltip from './Tooltip';

// Short, plain-language tips per role — what each part of the sidebar is
// actually for and how the day-to-day workflow goes. Instructor share the
// student nav, so they get the student tips plus one instructor-specific note.
const HINTS_BY_ROLE = {
    student: {
        title: 'How SCLF works for you',
        intro: "You're signed in as a Student. Here's what each part of the system does:",
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', text: 'A quick snapshot of your open reports and any claims waiting on you.' },
            { icon: PackageSearch, label: 'Lost & Found', text: "Lost something? File a report here. Found something? Report it so staff can log it in. You'll also see the browsable catalog of found items." },
            { icon: ClipboardCheck, label: 'Claims', text: 'Track the status of items you\'ve claimed — from "pending verification" to "ready for pickup."' },
            { icon: Megaphone, label: 'Announcements', text: 'Campus-wide notices from the registrar\'s office, including matches to your reports.' },
        ],
        tip: 'Tip: keep your phone number and email accurate in your Profile — that\'s how staff reach you about a match.',
    },
    instructor: {
        title: 'How SCLF works for you',
        intro: "You're signed in as Instructor. You use the same Lost & Found tools as students, with one addition:",
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', text: 'A quick snapshot of your open reports and any claims waiting on you.' },
            { icon: PackageSearch, label: 'Lost & Found', text: "File a lost report, log an item you found, or browse what's been turned in." },
            { icon: ClipboardCheck, label: 'Claims', text: 'Track the status of anything you\'ve claimed.' },
            { icon: Users, label: 'Student support', text: 'When a student asks for help finding something, you can walk them through filing a report the same way you would for yourself.' },
        ],
        tip: 'Tip: keep your phone number and email accurate in your Profile — that\'s how staff reach you about a match.',
    },
    security_officer: {
        title: 'How SCLF works for you',
        intro: "You're signed in as Security. Your job is verifying items and matching claims:",
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', text: 'Overview of items awaiting verification and claims awaiting your review.' },
            { icon: Boxes, label: 'Inventory', text: 'The physical log of everything currently held at the desk — what it is, where it\'s stored, and its verification status.' },
            { icon: QrCode, label: 'QR Scan / Verify', text: 'Scan an item\'s tag to pull up its record instantly instead of searching by hand.' },
            { icon: ClipboardCheck, label: 'Claims', text: 'Review a claimant\'s proof against the item on file, then approve or deny the release.' },
        ],
        tip: 'Tip: always verify the claimant\'s ID and description details against the stored item before releasing it.',
    },
    admin: {
        title: 'How SCLF works for you',
        intro: "You're signed in as Administrator. You have oversight of the whole system:",
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', text: 'System-wide activity: reports filed, claims in progress, and items awaiting verification.' },
            { icon: Users, label: 'User Management', text: 'Create Instructor, Security Officer, and Admin accounts here. Students self-register — you never need to create student accounts manually.' },
            { icon: ShieldCheck, label: 'Audit Log', text: 'A read-only trail of who did what and when — account changes, claim approvals, item edits.' },
            { icon: Boxes, label: 'Inventory & Claims', text: 'The same tools Security uses, with full edit and override access.' },
        ],
        tip: 'Tip: disabling an account signs the person out immediately and blocks login, but keeps their history intact — it\'s reversible from the same page.',
    },
};

export default function HelpHints({ roles, navRole, isDark }) {
    const [open, setOpen] = useState(false);

    const isInstructor = Array.isArray(roles) && roles.includes('instructor');
    const key = isInstructor && navRole === 'student' ? 'instructor' : (HINTS_BY_ROLE[navRole] ? navRole : 'student');
    const content = HINTS_BY_ROLE[key];

    return (
        <>
            <Tooltip label="How this works">
                <button
                    type="button"
                    className="ds-icon-btn"
                    onClick={() => setOpen(true)}
                    aria-label="Help — how this system works for your role"
                >
                    <HelpCircle size={18} />
                </button>
            </Tooltip>

            {open && createPortal(
                <div className="sclf-help-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
                    <aside className={`sclf-help-panel ${isDark ? 'is-dark' : 'is-light'}`} role="dialog" aria-modal="true" aria-label={content.title}>
                        <div className="sclf-help-head">
                            <h2>{content.title}</h2>
                            <button type="button" className="sclf-help-close" onClick={() => setOpen(false)} aria-label="Close help">
                                <X size={16} />
                            </button>
                        </div>
                        <p className="sclf-help-intro">{content.intro}</p>
                        <ul className="sclf-help-list">
                            {content.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <li key={item.label}>
                                        <span className="sclf-help-item-icon"><Icon size={16} /></span>
                                        <div>
                                            <div className="sclf-help-item-label">{item.label}</div>
                                            <div className="sclf-help-item-text">{item.text}</div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="sclf-help-footnote">{content.tip}</div>
                    </aside>
                </div>,
                document.body
            )}

            <style>{`
                .sclf-help-backdrop {
                    position: fixed; inset: 0; z-index: 9500;
                    background: rgba(11,13,25,0.45);
                    display: flex; justify-content: flex-end;
                    animation: sclf-help-fade 0.15s ease both;
                }
                .sclf-help-panel {
                    width: 100%; max-width: 360px; height: 100%;
                    padding: 22px 20px; overflow-y: auto;
                    box-shadow: -12px 0 40px rgba(0,0,0,0.25);
                    animation: sclf-help-slide 0.22s cubic-bezier(0.22,1,0.36,1) both;
                    font-family: var(--font-body, 'Inter', sans-serif);
                }
                .sclf-help-panel.is-light { background: #fff; color: #0b1220; }
                .sclf-help-panel.is-dark { background: #12151f; color: #e7ecf3; }
                .sclf-help-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
                .sclf-help-head h2 { font-size: 17px; font-weight: 800; margin: 0; }
                .sclf-help-close { background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; padding: 4px; border-radius: 6px; }
                .sclf-help-close:hover { opacity: 1; background: rgba(127,127,127,0.15); }
                .sclf-help-intro { font-size: 13px; opacity: 0.75; line-height: 1.5; margin: 10px 0 18px; }
                .sclf-help-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
                .sclf-help-list li { display: flex; gap: 12px; align-items: flex-start; }
                .sclf-help-item-icon {
                    flex-shrink: 0; width: 32px; height: 32px; border-radius: 9px;
                    display: inline-flex; align-items: center; justify-content: center;
                    background: rgba(79,70,229,0.12); color: #6366f1;
                }
                .sclf-help-item-label { font-weight: 700; font-size: 13.5px; margin-bottom: 2px; }
                .sclf-help-item-text { font-size: 12.5px; opacity: 0.72; line-height: 1.5; }
                .sclf-help-footnote {
                    margin-top: 22px; padding: 12px 13px; border-radius: 10px; font-size: 12px; line-height: 1.5;
                    background: rgba(212,167,61,0.12); color: inherit; opacity: 0.9;
                }
                @keyframes sclf-help-fade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes sclf-help-slide { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @media (prefers-reduced-motion: reduce) { .sclf-help-backdrop, .sclf-help-panel { animation: none; } }
            `}</style>
        </>
    );
}
