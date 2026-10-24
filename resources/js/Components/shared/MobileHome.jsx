import React from "react";
import { Link } from "react-router-dom";
import { useQuickActions } from "./MobileQuickActions";
import { ChevronRight, Plus, CircleCheck, Hourglass, ClipboardList, Handshake } from "../icons";
import { useAuth } from "../../context/AuthContext";
import useRoleTranslation from "../../hooks/useRoleTranslation";
import { greetingFor, firstNameOf, useOpolWeather, describeWeather } from "./DashboardGreeting";
import logo from "../../assets/images/site-logo.png";
import "./MobileHome.css";

// Phone-only home screen for students and instructors. Reads top to bottom
// like a native app's home tab:
//
//   1. hero          avatar, greeting, date + weather, big OCC logo faded behind the text
//   2. main action   one big "Lost something?" button
//   3. your numbers  four stat cards in a 2 x 2 grid (only when the numbers are loaded)
//   4. campus pulse  recovery rate + items waiting on the shelf
//
// Navigation is not repeated beyond that — the tab bar and Menu cover the rest.

const makeDateFmt = (locale) => new Intl.DateTimeFormat(locale, { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric" });

const initialsOf = (name) =>
    String(name || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "U";

export default function MobileHome({ name, role = "Student", kpis, campus }) {
    const { user } = useAuth();
    const { t, locale } = useRoleTranslation();
    const quick = useQuickActions();
    const { weather } = useOpolWeather();
    const [wText, wIcon] = weather ? describeWeather(weather.code, weather.isDay, t) : [];
    const now = new Date();
    const dateFmt = makeDateFmt(locale);
    const first = firstNameOf(name) || t("common.there");

    const stats = kpis
        ? [
            { label: t("dash.homeReports"), value: kpis.reports ?? 0, icon: ClipboardList },
            { label: t("dash.homePending"), value: kpis.pending ?? 0, icon: Hourglass },
            { label: t("dash.homeRecovered"), value: kpis.recovered ?? 0, icon: CircleCheck },
            { label: t("dash.homeActive"), value: kpis.active_claims ?? 0, icon: Handshake },
        ]
        : null;

    const rate = Math.max(0, Math.min(100, Number(campus?.recovery_rate ?? 0)));

    return (
        <section className="mh" aria-label={t("dash.homeLabel")}>
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
                        <small>{greetingFor(now, t)}</small>
                        <b>{first}</b>
                    </div>
                </div>
                <p className="mh-sub">
                    {dateFmt.format(now)}
                    {weather && <> · {wIcon} {weather.temp}°C {wText}</>}
                </p>
                <div className="mh-school">
                    <b>Opol Community College</b>
                    <span>{t("dash.homeSchoolLine", { role })}</span>
                </div>
            </header>

            {/* Opens the same "What do you need?" sheet as the raised + tab,
                so the user picks lost / found / incident / service. Falls back
                to the lost-item form if rendered outside the shell. */}
            {quick ? (
                <button type="button" className="mh-cta" onClick={() => quick.open()} aria-haspopup="dialog">
                <span className="mh-cta-icon"><Plus size={24} strokeWidth={1.8} /></span>
                <span className="mh-cta-text">
                    <b>{t("dash.ctaTitle")}</b>
                    <small>{t("dash.ctaSub")}</small>
                </span>
                <ChevronRight size={20} />
                </button>
            ) : (
                <Link to="/app/lost-items/create" className="mh-cta">
                <span className="mh-cta-icon"><Plus size={24} strokeWidth={1.8} /></span>
                <span className="mh-cta-text">
                    <b>{t("dash.ctaTitle")}</b>
                    <small>{t("dash.ctaSub")}</small>
                </span>
                <ChevronRight size={20} />
                </Link>
            )}

            {stats && (
                <>
                    <h3 className="mh-h">{t("dash.yourActivity")}</h3>
                    <div className="mh-stats" role="list">
                        {stats.map((s) => {
                            const Icon = s.icon;
                            return (
                                <div key={s.label} className="mh-stat" role="listitem">
                                    <span className="mh-stat-icon" aria-hidden="true"><Icon size={78} strokeWidth={1.3} /></span>
                                    <b>{s.value}</b>
                                    <small>{s.label}</small>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {campus && (
                <div className="mh-pulse">
                    <div
                        className="mh-ring"
                        style={{ "--p": `${rate}%` }}
                        role="img"
                        aria-label={t("dash.recoveryAria", { rate })}
                    >
                        <span>{rate}%</span>
                    </div>
                    <div className="mh-pulse-text">
                        <b>{t("dash.recoveryShort")}</b>
                        <small>
                            {t(Number(campus.items_on_shelf) === 1 ? "dash.shelfOne" : "dash.shelfMany", { count: campus.items_on_shelf ?? 0 })}
                        </small>
                    </div>
                </div>
            )}
        </section>
    );
}
