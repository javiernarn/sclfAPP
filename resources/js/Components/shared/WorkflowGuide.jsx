import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ArrowRight, Check, Info } from '../icons';

// ---------------------------------------------------------------------------
// The two real processes a security officer / counter handler runs, written
// as plain step-by-step guides. The wording mirrors what the backend actually
// enforces (see CounterIntakeService, ClaimService, ItemReleaseService), so
// the guide never promises something the system will refuse to do.
// ---------------------------------------------------------------------------

export const WORKFLOW_LANES = {
    counter: {
        key: 'counter',
        label: 'Walk-in at the counter',
        blurb: 'The owner is standing in front of you and hands you their item.',
        steps: [
            {
                title: 'Call the next person',
                where: 'Counter Dashboard',
                to: '/app/security/counter-dashboard',
                what: 'Call the next ticket, then mark it "Serving" once they reach your desk.',
                done: 'The ticket shows as Serving.',
            },
            {
                title: 'Confirm who they are',
                where: 'Counter',
                to: '/app/security/counter',
                what: 'Search by school ID or name. Check that their face matches the photo on file before selecting them.',
                done: 'The owner is selected on the page.',
            },
            {
                title: 'Check their lost report',
                where: 'Counter (step 2)',
                to: '/app/security/counter',
                what: 'If the owner already filed a lost report, pick the one that is this item. If none fits, choose "No lost report" — do not force a link.',
                done: 'A report is chosen, or "No lost report" is chosen on purpose.',
            },
            {
                title: 'Log the item and check in',
                where: 'Counter (step 3)',
                to: '/app/security/counter',
                what: 'Enter the item name, pick the counter where it will sit, add notes on condition. Press Check In once.',
                done: 'You see "Checked in". The owner is notified and the claim is already approved.',
            },
            {
                title: 'Release when they come back',
                where: 'Claims → Scan Release Code',
                to: '/app/security/claims',
                what: 'Open the owner\'s claim, generate the release code, then scan it (or release manually with a written reason if they cannot show it).',
                done: 'The claim shows Released.',
            },
        ],
    },
    online: {
        key: 'online',
        label: 'Item turned in by a finder',
        blurb: 'Someone found an item and reported it. The owner is not known yet.',
        steps: [
            {
                title: 'Verify the found report',
                where: 'Found Items',
                to: '/app/security/found-items',
                what: 'Look at the photo and description, then approve or reject. Only approved items go into inventory and into matching.',
                done: 'The report is approved (or rejected with a reason).',
            },
            {
                title: 'Store it and record where',
                where: 'Inventory',
                to: '/app/security/inventory',
                what: 'Assign a storage location so anyone can find the item later. Every move is logged.',
                done: 'The item shows a storage location.',
            },
            {
                title: 'Review possible matches',
                where: 'Matches',
                to: '/app/security/matches',
                what: 'Open a match and compare the lost report and the found item side by side. Notify the owner only when the key details agree; dismiss weak matches.',
                done: 'Strong matches are notified, weak ones dismissed.',
            },
            {
                title: 'Review the claim and its proof',
                where: 'Claims',
                to: '/app/security/claims',
                what: 'Compare the claimant\'s evidence to the item on file. Approve, ask for more evidence, or reject. Watch for the suspicious-claim flag.',
                done: 'The claim is Approved, Rejected, or waiting on more evidence.',
            },
            {
                title: 'Release the item',
                where: 'Claims → Scan Release Code',
                to: '/app/security/qr-scanner',
                what: 'Generate the release code on the approved claim and scan it at hand-over. Use manual release only with a written reason.',
                done: 'The claim shows Released and the lost report closes.',
            },
            {
                title: 'Handle what nobody claims',
                where: 'Unclaimed Items',
                to: '/app/security/unclaimed-items',
                what: 'Review items that have waited too long and follow the disposition process.',
                done: 'The item is disposed of or restored, with the action logged.',
            },
        ],
    },
};

const STORAGE_KEY = 'sclf.workflowGuide.open';

function readOpen(defaultOpen) {
    try {
        const v = window.localStorage.getItem(STORAGE_KEY);
        return v === null ? defaultOpen : v === '1';
    } catch (e) {
        return defaultOpen;
    }
}

function writeOpen(open) {
    try { window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); } catch (e) { /* storage can be unavailable */ }
}

// Full step-by-step guide with a lane switcher. `lane` pre-selects a lane
// (e.g. the Counter page opens on the counter lane).
export default function WorkflowGuide({ lane = 'counter', defaultOpen = true, compact = false }) {
    const [open, setOpen] = useState(() => readOpen(defaultOpen));
    const [active, setActive] = useState(lane);
    const current = WORKFLOW_LANES[active] || WORKFLOW_LANES.counter;

    const toggle = () => {
        const next = !open;
        setOpen(next);
        writeOpen(next);
    };

    return (
        <div className="ds-card sclf-wf" style={{ borderLeft: '3px solid var(--accent, #1B1F3B)' }}>
            <div className="sclf-wf-head">
                <div className="ds-card-title" style={{ margin: 0 }}>
                    <span className="ds-card-title-icon"><Info size={17} /> Step-by-step guide</span>
                </div>
                <button type="button" className="ds-btn ds-btn-secondary" onClick={toggle} aria-expanded={open}>
                    {open ? <>Hide <ChevronUp size={15} /></> : <>Show <ChevronDown size={15} /></>}
                </button>
            </div>

            {open && (
                <>
                    <div className="sclf-wf-tabs" role="tablist" aria-label="Which process">
                        {Object.values(WORKFLOW_LANES).map((l) => (
                            <button
                                key={l.key}
                                type="button"
                                role="tab"
                                aria-selected={active === l.key}
                                className={`sclf-wf-tab ${active === l.key ? 'is-active' : ''}`}
                                onClick={() => setActive(l.key)}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>
                    <p className="ds-card-desc" style={{ margin: '10px 0 14px' }}>{current.blurb}</p>

                    <ol className="sclf-wf-steps">
                        {current.steps.map((s, i) => (
                            <li key={s.title} className="sclf-wf-step">
                                <span className="sclf-wf-num">{i + 1}</span>
                                <div className="sclf-wf-body">
                                    <div className="sclf-wf-title">{s.title}</div>
                                    {!compact && <div className="sclf-wf-what">{s.what}</div>}
                                    <div className="sclf-wf-done"><Check size={13} /> {s.done}</div>
                                    <Link to={s.to} className="sclf-wf-link">{s.where} <ArrowRight size={13} /></Link>
                                </div>
                            </li>
                        ))}
                    </ol>
                </>
            )}

            <style>{`
                .sclf-wf-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
                .sclf-wf-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
                .sclf-wf-tab { border: 1px solid rgba(127,127,127,0.35); background: transparent; color: inherit; padding: 7px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
                .sclf-wf-tab.is-active { background: var(--accent, #1B1F3B); border-color: var(--accent, #1B1F3B); color: #fff; }
                .sclf-wf-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
                .sclf-wf-step { display: flex; gap: 12px; align-items: flex-start; }
                .sclf-wf-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; background: rgba(79,70,229,0.14); color: #6366f1; }
                .sclf-wf-title { font-weight: 700; font-size: 13.5px; }
                .sclf-wf-what { font-size: 12.5px; opacity: 0.78; line-height: 1.5; margin-top: 2px; }
                .sclf-wf-done { font-size: 12px; margin-top: 4px; opacity: 0.85; display: flex; align-items: center; gap: 5px; }
                .sclf-wf-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; font-size: 12px; font-weight: 700; color: #6366f1; text-decoration: none; }
                .sclf-wf-link:hover { text-decoration: underline; }
            `}</style>
        </div>
    );
}

// Slim progress strip for a page that is itself a multi-step form
// (e.g. the Counter check-in). `current` is the 1-based active step.
export function StepTracker({ steps, current }) {
    return (
        <ol className="sclf-tracker" aria-label="Progress">
            {steps.map((label, i) => {
                const n = i + 1;
                const state = n < current ? 'is-done' : n === current ? 'is-current' : '';
                return (
                    <li key={label} className={`sclf-tracker-item ${state}`} aria-current={n === current ? 'step' : undefined}>
                        <span className="sclf-tracker-dot">{n < current ? <Check size={12} /> : n}</span>
                        <span className="sclf-tracker-label">{label}</span>
                    </li>
                );
            })}
            <style>{`
                .sclf-tracker { list-style: none; display: flex; gap: 6px; flex-wrap: wrap; margin: 0 0 14px; padding: 0; }
                .sclf-tracker-item { display: flex; align-items: center; gap: 7px; padding: 6px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; border: 1px solid rgba(127,127,127,0.3); opacity: 0.6; }
                .sclf-tracker-item.is-current { opacity: 1; border-color: var(--accent, #1B1F3B); }
                .sclf-tracker-item.is-done { opacity: 0.9; }
                .sclf-tracker-dot { width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; background: rgba(79,70,229,0.14); color: #6366f1; }
                .sclf-tracker-item.is-done .sclf-tracker-dot { background: #16a34a; color: #fff; }
                .sclf-tracker-item.is-current .sclf-tracker-dot { background: var(--accent, #1B1F3B); color: #fff; }
            `}</style>
        </ol>
    );
}
