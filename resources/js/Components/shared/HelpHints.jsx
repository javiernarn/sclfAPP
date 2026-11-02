import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, X, ArrowRight, Info } from '../icons';
import Tooltip from './Tooltip';
import GUIDES, { guideKeyFor } from './helpContent';
import './HelpHints.css';

/**
 * "How this works" — a role-aware guide (see helpContent.js for the wording).
 *
 *  - "What to do": the steps for THIS role, in order, with go-buttons.
 *  - "Pages": what each menu entry is for.
 *
 * The panel is portaled to <body>, so it carries the same theme classes as the
 * menus (`theme` = e.g. "white light" / "dark-blue dark dk-blue"). That is what
 * lets every accent theme AND the seasonal themes colour it (themes.css and
 * seasonSurfaces.css list .sclf-help-panel as a token host).
 */
export default function HelpHints({ roles, isDark, theme }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('todo');
    const navigate = useNavigate();
    const closeRef = useRef(null);

    const guide = GUIDES[guideKeyFor(roles)];
    const themeClass = (theme && theme.trim()) || (isDark ? 'dark' : 'light');

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeRef.current?.focus();
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [open]);

    const openPanel = () => { setTab('todo'); setOpen(true); };
    const go = (to) => { setOpen(false); if (to) navigate(to); };

    let stepNo = 0;
    return (
        <>
            <Tooltip label="How this works">
                <button type="button" className="ds-icon-btn" onClick={openPanel} aria-label="Help — how this system works for your role">
                    <HelpCircle size={18} />
                </button>
            </Tooltip>

            {open && createPortal(
                <div className="sclf-help-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
                    <aside className={`sclf-help-panel ${themeClass}`} role="dialog" aria-modal="true" aria-label={guide.title}>
                        <header className="sclf-help-head">
                            <div className="sclf-help-headtext">
                                <h2>{guide.title}</h2>
                                <span className="sclf-help-role">{guide.role}</span>
                            </div>
                            <button ref={closeRef} type="button" className="sclf-help-close" onClick={() => setOpen(false)} aria-label="Close help">
                                <X size={18} />
                            </button>
                        </header>

                        <div className="sclf-help-tabs" role="tablist" aria-label="Help sections">
                            <button type="button" role="tab" aria-selected={tab === 'todo'} className={tab === 'todo' ? 'is-on' : ''} onClick={() => setTab('todo')}>What to do</button>
                            <button type="button" role="tab" aria-selected={tab === 'pages'} className={tab === 'pages' ? 'is-on' : ''} onClick={() => setTab('pages')}>What each page is for</button>
                        </div>

                        <div className="sclf-help-body">
                            <p className="sclf-help-intro">{guide.intro}</p>

                            {tab === 'todo' && guide.todo.map((block, bi) => (
                                <section key={bi} className="sclf-help-lane">
                                    {block.lane && <h3 className="sclf-help-lanetitle">{block.lane}</h3>}
                                    <ol className="sclf-help-steps">
                                        {block.steps.map((s) => {
                                            stepNo += 1;
                                            return (
                                                <li key={s.title}>
                                                    <span className="sclf-help-num" aria-hidden="true">{block.lane ? block.steps.indexOf(s) + 1 : stepNo}</span>
                                                    <div className="sclf-help-steptext">
                                                        <strong>{s.title}</strong>
                                                        <p>{s.text}</p>
                                                        {s.to && (
                                                            <button type="button" className="sclf-help-go" onClick={() => go(s.to)}>
                                                                {s.go || 'Open'} <ArrowRight size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </section>
                            ))}

                            {tab === 'pages' && (
                                <ul className="sclf-help-list">
                                    {guide.pages.map((p) => {
                                        const Icon = p.icon;
                                        const inner = (
                                            <>
                                                <span className="sclf-help-icon"><Icon size={18} /></span>
                                                <span className="sclf-help-itemtext"><strong>{p.label}</strong><span>{p.text}</span></span>
                                            </>
                                        );
                                        return (
                                            <li key={p.label}>
                                                {p.to
                                                    ? <button type="button" className="sclf-help-item is-link" onClick={() => go(p.to)}>{inner}</button>
                                                    : <div className="sclf-help-item">{inner}</div>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}

                            <div className="sclf-help-notes">
                                {guide.notes.map((n) => (
                                    <p key={n}><Info size={15} /><span>{n}</span></p>
                                ))}
                            </div>
                        </div>
                    </aside>
                </div>,
                document.body
            )}
        </>
    );
}
