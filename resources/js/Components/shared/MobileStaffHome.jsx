import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Plus } from "../icons";
import { useAuth } from "../../context/AuthContext";
import { greetingFor, firstNameOf, useOpolWeather, describeWeather } from "./DashboardGreeting";
import { useQuickActions } from "./MobileQuickActions";
import logo from "../../assets/images/site-logo.png";
import "./MobileHome.css";

// Phone-only home screen for Admin, Staff and Security — the same app-style
// layout students get (see MobileHome.jsx), driven by whatever numbers the
// calling dashboard already loaded:
//
//   1. hero      avatar, greeting, date + weather, OCC logo behind the text
//   2. actions   one big "Quick actions" button (opens the raised "+" sheet)
//   3. alerts    optional "needs you now" rows, only the ones above zero
//   4. numbers   four stat cards in a 2 x 2 grid (only once loaded)
//
// Everything below it on the dashboard (charts, queues) stays as it was.

const dateFmt = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric" });

const initialsOf = (name) =>
    String(name || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "U";

export default function MobileStaffHome({ name, role = "Staff", stats, statsTitle = "Right now", alerts = [], actionTitle = "Quick actions", actionSub = "Start something new in one tap." }) {
    const { user } = useAuth();
    const quick = useQuickActions();
    const { weather } = useOpolWeather();
    const [wText, wIcon] = weather ? describeWeather(weather.code, weather.isDay) : [];
    const now = new Date();
    const first = firstNameOf(name) || "there";
    const live = (alerts || []).filter((a) => Number(a.n) > 0).slice(0, 3);

    return (
        <section className="mh" aria-label="Home">
            <header className="mh-hero" style={{ "--mh-logo": `url("${logo}")` }}>
                <div className="mh-hero-top">
                    <span
                        className="mh-avatar"
                        style={user?.profile_picture_url ? { backgroundImage: `url(${user.profile_picture_url})` } : undefined}
                        aria-hidden="true"
                    >
                        {!user?.profile_picture_url && initialsOf(name)}
                    </span>
                    <div className="mh-who">
                        <small>{greetingFor(now)}</small>
                        <b>{first}</b>
                    </div>
                </div>
                <p className="mh-sub">
                    {dateFmt.format(now)}
                    {weather && <> · {wIcon} {weather.temp}°C {wText}</>}
                </p>
                <div className="mh-school">
                    <b>Opol Community College</b>
                    <span>{role} · Smart Campus Lost &amp; Found</span>
                </div>
            </header>

            {quick && (
                <button type="button" className="mh-cta" onClick={() => quick.open()} aria-haspopup="dialog">
                    <span className="mh-cta-icon"><Plus size={24} strokeWidth={1.8} /></span>
                    <span className="mh-cta-text">
                        <b>{actionTitle}</b>
                        <small>{actionSub}</small>
                    </span>
                    <ChevronRight size={20} />
                </button>
            )}

            {live.length > 0 && (
                <>
                    <h3 className="mh-h">Needs you now</h3>
                    <div className="mh-alerts">
                        {live.map((a) => (
                            <Link key={a.label} to={a.to} className="mh-cta mh-alert">
                                <span className="mh-alert-n">{a.n}</span>
                                <span className="mh-cta-text">
                                    <b>{a.label}</b>
                                    {a.cta && <small>{a.cta}</small>}
                                </span>
                                <ChevronRight size={20} />
                            </Link>
                        ))}
                    </div>
                </>
            )}

            {stats && (
                <>
                    <h3 className="mh-h">{statsTitle}</h3>
                    <div className="mh-stats" role="list">
                        {stats.map((s) => {
                            const Icon = s.icon;
                            return (
                                <div key={s.label} className="mh-stat" role="listitem">
                                    {Icon && <span className="mh-stat-icon" aria-hidden="true"><Icon size={78} strokeWidth={1.3} /></span>}
                                    <b>{s.value ?? 0}</b>
                                    <small>{s.label}</small>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </section>
    );
}
