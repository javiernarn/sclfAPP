import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import logo from '../../assets/images/site-logo.png';
import './VisitorPortal.css';

/**
 * Public page opened by scanning the QR code on a visitor badge (/visitor/:token).
 * No login. Steps: "Are you <first name>?" -> type the last name to unlock the welcome
 * page, or "No" -> the page for someone who found the badge. The server releases
 * information step by step and checks the last name (see PublicVisitorController).
 */

const nameLine = (n) => [n?.last_name, n?.first_name].filter(Boolean).join(', ') || n?.full_name || '';
// The finder page never gets the full name: "Juan D."
const ownerLine = (o) => [o?.first_name, o?.last_initial].filter(Boolean).join(' ');
const timeText = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null);
const dateText = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : null);

// Good morning / noon / afternoon / evening, from the time on the visitor's phone.
//   05:00-11:59 morning · 12:00-12:59 noon · 13:00-17:59 afternoon · 18:00-04:59 evening
export const greetingFor = (d = new Date()) => {
    const h = d.getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h === 12) return 'Good noon';
    if (h >= 13 && h < 18) return 'Good afternoon';
    return 'Good evening';
};
const greetIcon = (g) => ({ 'Good morning': '🌅', 'Good noon': '☀️', 'Good afternoon': '🌤️', 'Good evening': '🌙' }[g]);

// Re-reads the clock every 30 s so the greeting changes if the page stays open.
function useNow() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(id);
    }, []);
    return now;
}

function Shell({ children, portal, footer = null, hero = false }) {
    const college = portal?.college || 'Opol Community College';
    return (
        <div className="vp-page">
            <header className="vp-appbar">
                <img src={logo} alt="" width="40" height="40" />
                <div className="vp-appbar-text">
                    <div className="vp-college">{college}</div>
                    <div className="vp-sub">Visitor Portal</div>
                </div>
            </header>
            {/* Only this area scrolls; the app bar above and the action bar below stay put. */}
            <div className="vp-scroll" id="vp-scroll">
                <main className={`vp-main${hero ? ' has-hero' : ''}`}>
                    <div className="vp-card" key={hero ? 'hero' : 'plain'}>
                        {children}
                    </div>
                    <p className="vp-foot">SCLF · {college}</p>
                </main>
            </div>
            {footer && <div className="vp-bar"><div className="vp-bar-inner">{footer}</div></div>}
        </div>
    );
}

// Where a visitor goes when they are done. Closing a tab from a script only works
// for tabs the page opened itself, so if the browser refuses we show a "you can close
// this tab" screen (and drop the visit details from memory) instead of doing nothing.
const GOOGLE_URL = 'https://www.google.com';
const goToGoogle = (e) => {
    e?.preventDefault?.();
    // replace(): the Back button must not bring the visit details back.
    window.location.replace(GOOGLE_URL);
};

function ExitButtons({ onClose, closeLabel = 'Close page', primary = 'close' }) {
    return (
        <>
            <button type="button" className={`vp-btn ${primary === 'close' ? 'vp-btn-primary' : 'vp-btn-ghost'}`} onClick={onClose}>
                <span aria-hidden="true">✕</span> {closeLabel}
            </button>
            <a className={`vp-btn ${primary === 'google' ? 'vp-btn-primary' : 'vp-btn-ghost'}`} href={GOOGLE_URL}
                rel="noopener noreferrer" onClick={goToGoogle}>
                <span aria-hidden="true">↗</span> Go to google.com
            </a>
        </>
    );
}

export default function VisitorPortal() {
    const { token } = useParams();
    const [step, setStep] = useState('loading'); // loading | ask | verify | welcome | found | locked | inactive | invalid | error | closed
    const [answerText, setAnswerText] = useState('');
    const [wrong, setWrong] = useState(null);      // { attempts_left } after a wrong answer
    const [lockedMinutes, setLockedMinutes] = useState(15);
    const [data, setData] = useState(null);      // answer to the first scan (name + portal texts)
    const [result, setResult] = useState(null);  // welcome / found payload
    const [busy, setBusy] = useState(false);
    const now = useNow();
    const greeting = greetingFor(now);
    const scrollTop = () => { document.getElementById('vp-scroll')?.scrollTo?.({ top: 0 }); };

    useEffect(() => {
        document.documentElement.classList.add('vp-root');
        return () => document.documentElement.classList.remove('vp-root');
    }, []);

    useEffect(() => {
        document.title = 'Visitor | SCLF - Opol Community College';
        let live = true;
        axios.get(`/public/visitor/${encodeURIComponent(token)}`, { silent: true })
            .then((res) => {
                if (!live) return;
                setData(res.data);
                setStep(res.data.state === 'active' ? 'ask' : 'inactive');
            })
            .catch((err) => {
                if (!live) return;
                const d = err?.response?.data;
                if (d?.portal) setData(d);
                setStep(err?.response?.status === 404 ? 'invalid' : 'error');
            });
        return () => { live = false; };
    }, [token]);

    const answer = async (kind, body = {}) => {
        setBusy(true);
        try {
            const res = await axios.post(`/public/visitor/${encodeURIComponent(token)}/${kind}`, body, { silent: true });
            if (res.data.state === 'welcome') { setResult(res.data); setStep('welcome'); }
            else if (res.data.state === 'found') { setResult(res.data); setStep('found'); }
            else { setStep('inactive'); }
        } catch (err) {
            const status = err?.response?.status;
            const d = err?.response?.data;
            if (status === 422 && d?.state === 'wrong') { setWrong({ attempts_left: d.attempts_left }); }
            else if (status === 429 || d?.state === 'locked') { setLockedMinutes(d?.minutes || 15); setStep('locked'); }
            else { setStep('error'); }
        } finally {
            setBusy(false);
            scrollTop();
        }
    };

    // Leave the page: try to close the tab; if the browser says no, show a calm
    // "you can close this tab" screen and wipe the visit details from memory.
    const portalKeep = useRef(null);
    const closePage = () => {
        portalKeep.current = result?.portal || data?.portal || null;
        try { window.close(); } catch { /* ignored: handled below */ }
        setTimeout(() => {
            setResult(null); setData(null); setAnswerText('');
            setStep('closed');
            scrollTop();
        }, 250);
    };

    const portal = result?.portal || data?.portal || portalKeep.current;

    if (step === 'loading') {
        return <Shell portal={portal}><p className="vp-muted" role="status">Opening your visitor page…</p></Shell>;
    }

    if (step === 'ask') {
        return (
            <Shell portal={portal} footer={(
                <>
                    <button type="button" className="vp-btn vp-btn-primary" disabled={busy} onClick={() => { setWrong(null); setAnswerText(''); setStep('verify'); }}>
                        Yes, that’s me — continue
                    </button>
                    <button type="button" className="vp-btn vp-btn-ghost" disabled={busy} onClick={() => answer('not-me')}>
                        No, I’m not this person
                    </button>
                </>
            )}>
                <div className="vp-ask">
                    <span className="vp-ask-icon" aria-hidden="true">{greetIcon(greeting)}</span>
                    <p className="vp-greeting">{greeting}!</p>
                    <h1 className="vp-title">Are you</h1>
                    <p className="vp-name">{data.visitor.first_name}?</p>
                    <p className="vp-badge-chip">Visitor badge <strong>{data.badge}</strong></p>
                </div>
            </Shell>
        );
    }

    if (step === 'verify') {
        const asksLast = data.verify_with !== 'name';
        return (
            <Shell portal={portal} footer={(
                <>
                    <button type="submit" form="vp-verify-form" className="vp-btn vp-btn-primary" disabled={busy || !answerText.trim()}>Unlock my visit</button>
                    <button type="button" className="vp-btn vp-btn-ghost" disabled={busy} onClick={() => setStep('ask')}>Back</button>
                </>
            )}>
                <h1 className="vp-title">One quick check</h1>
                <p className="vp-text">
                    To protect your visit details, {asksLast ? <>type your <strong>last name</strong></> : <>type your <strong>name</strong></>}, {data.visitor.first_name}.
                </p>
                <form id="vp-verify-form" onSubmit={(e) => { e.preventDefault(); if (answerText.trim()) answer('confirm', { last_name: answerText }); }}>
                    <label className="vp-label" htmlFor="vp-answer">{asksLast ? 'Last name' : 'Your name'}</label>
                    <input id="vp-answer" className="vp-input" value={answerText} autoFocus autoComplete="family-name"
                        autoCapitalize="words" enterKeyHint="go" maxLength={100} aria-invalid={!!wrong}
                        onChange={(e) => { setAnswerText(e.target.value); setWrong(null); }} />
                    {wrong && (
                        <p className="vp-error" role="alert">
                            That doesn’t match what we have. {wrong.attempts_left > 0
                                ? `You have ${wrong.attempts_left} ${wrong.attempts_left === 1 ? 'try' : 'tries'} left.`
                                : 'Please ask a Security Officer for help.'}
                        </p>
                    )}
                </form>
                <p className="vp-muted">Not {data.visitor.first_name}? <button type="button" className="vp-link" disabled={busy} onClick={() => answer('not-me')}>I’m not this person</button></p>
            </Shell>
        );
    }

    if (step === 'locked') {
        return (
            <Shell portal={portal} footer={<ExitButtons onClose={closePage} />}>
                <h1 className="vp-title">This page is locked</h1>
                <p className="vp-text">Too many answers did not match, so this badge page is locked for about {lockedMinutes} minutes to keep the visit details safe.</p>
                <p className="vp-text">If you are the visitor, please ask a Security Officer at {portal?.security_office || 'the Security Office'} to help you. If you found this badge, please return it there. Security has been told.</p>
            </Shell>
        );
    }

    if (step === 'welcome' && result) {
        const v = result.visit;
        const rows = [
            ['Purpose of visit', v.purpose_label],
            v.host_name && ['Visiting', [v.host_name, v.host_department].filter(Boolean).join(' · ')],
            !v.host_name && v.host_department && ['Office', v.host_department],
            v.student_name && ['Student', v.student_name],
            ['Badge', v.badge_number],
            v.campus && ['Campus', v.campus],
            ['Checked in', `${dateText(v.checked_in_at)}, ${timeText(v.checked_in_at)}`],
            v.leave_by && ['Please plan to leave by', timeText(v.leave_by)],
            ...result.details.map((d) => [d.label, d.value]),
        ].filter(Boolean);

        return (
            <Shell portal={portal} hero footer={(
                <>
                    <button type="button" className="vp-btn vp-btn-primary" onClick={closePage}>
                        <span aria-hidden="true">✓</span> I accept the details — close page
                    </button>
                    <a className="vp-btn vp-btn-ghost" href={GOOGLE_URL} rel="noopener noreferrer" onClick={goToGoogle}>
                        <span aria-hidden="true">↗</span> Go to google.com
                    </a>
                </>
            )}>
                <div className="vp-hero">
                    <p className="vp-hero-greet"><span aria-hidden="true">{greetIcon(greeting)}</span> {greeting}!</p>
                    <p className="vp-hero-date">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                    <p className="vp-eyebrow">Welcome to</p>
                    <h1 className="vp-title">{portal.college}</h1>
                    <p className="vp-name">{nameLine(result.visitor)}</p>
                    {v.badge_number && <p className="vp-badge-chip">Badge <strong>{v.badge_number}</strong></p>}
                </div>
                <p className="vp-thanks">Thank you for visiting us.</p>
                <p className="vp-text">{portal.intro}</p>

                <section className="vp-section">
                    <h2>Your visit</h2>
                    <dl className="vp-dl">
                        {rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
                    </dl>
                </section>

                <section className="vp-section vp-next">
                    <h2>What to do next</h2>
                    <ul>{result.guidance.map((g) => <li key={g}>{g}</li>)}</ul>
                </section>

                <section className="vp-section">
                    <h2>Please remember</h2>
                    <ul>{portal.conduct.map((c) => <li key={c}>{c}</li>)}</ul>
                    <p className="vp-return">Before you leave, return this badge to {portal.security_office}.</p>
                </section>

                <section className="vp-section vp-privacy">
                    <h2>Privacy notice</h2>
                    <p>{portal.privacy}</p>
                </section>
            </Shell>
        );
    }

    if (step === 'found' && result) {
        const v = result.visit;
        return (
            <Shell portal={portal} footer={<ExitButtons onClose={closePage} />}>
                <h1 className="vp-title">Thank you for helping</h1>
                <p className="vp-text">This visitor badge belongs to someone else. It is badge <strong>{v.badge_number}</strong>, issued to:</p>
                <p className="vp-name">{ownerLine(result.owner)}</p>
                <dl className="vp-dl">
                    <div><dt>Purpose of their visit</dt><dd>{v.purpose_label}</dd></div>
                    {v.host_name && <div><dt>They are visiting</dt><dd>{v.host_name}</dd></div>}
                    {v.host_department && <div><dt>Office</dt><dd>{v.host_department}</dd></div>}
                    {v.campus && <div><dt>Campus</dt><dd>{v.campus}</dd></div>}
                </dl>
                <section className="vp-section vp-next">
                    <h2>What you can do</h2>
                    <ul>
                        <li>If you can, find this person and give the badge back — look for the name above, or ask the office listed. The full name is kept by Security.</li>
                        <li>Otherwise, please bring the badge to {portal.security_office}. Any Security Officer can take it.</li>
                    </ul>
                </section>
                <p className="vp-muted">Security has been told that this badge may have been lost, so they can look for its owner.</p>
            </Shell>
        );
    }

    if (step === 'inactive') {
        return (
            <Shell portal={portal} footer={<ExitButtons onClose={closePage} />}>
                <h1 className="vp-title">This badge is not in use</h1>
                <p className="vp-text">This visitor badge is not linked to a visit right now — the visit has ended or the badge was returned.</p>
                <p className="vp-text">If you found this badge, please return it to {portal?.security_office || 'the Security Office'}. Thank you.</p>
            </Shell>
        );
    }

    if (step === 'invalid') {
        return (
            <Shell portal={portal} footer={<ExitButtons onClose={closePage} />}>
                <h1 className="vp-title">We can’t open this link</h1>
                <p className="vp-text">This QR code is not valid. If you are a visitor, please ask the Security Officer at the gate for help.</p>
            </Shell>
        );
    }

    if (step === 'closed') {
        return (
            <Shell portal={portal} footer={(
                <a className="vp-btn vp-btn-primary" href={GOOGLE_URL} rel="noopener noreferrer" onClick={goToGoogle}>
                    <span aria-hidden="true">↗</span> Go to google.com
                </a>
            )}>
                <div className="vp-ask">
                    <span className="vp-ask-icon" aria-hidden="true">✅</span>
                    <h1 className="vp-title">All done</h1>
                    <p className="vp-text">Your browser did not close this page by itself. You can safely close this tab now — your visit details have been cleared from the screen.</p>
                </div>
            </Shell>
        );
    }

    return (
        <Shell portal={portal} footer={(
            <>
                <button type="button" className="vp-btn vp-btn-primary" onClick={() => window.location.reload()}>Try again</button>
                <ExitButtons onClose={closePage} primary="none" />
            </>
        )}>
            <h1 className="vp-title">Something went wrong</h1>
            <p className="vp-text">We could not load this page. Please check your connection and scan the badge again, or ask a Security Officer for help.</p>
        </Shell>
    );
}
