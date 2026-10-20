import React from "react";
import { GraduationCap } from "../icons";
import { greetingFor, firstNameOf, useOpolWeather, describeWeather } from "./DashboardGreeting";
import logo from "../../assets/images/site-logo.png";
import "./MobileHome.css";

// Phone-only welcome card at the top of the dashboard: school name, role tag,
// ONE greeting, today's date + weather, and the OCC logo faded behind it.
// It replaces the desktop greeting/clock block on phones. Navigation is not
// repeated here — the bottom tab bar and Menu already cover it.

const dateFmt = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });

export default function MobileHome({ name, role = "Student" }) {
    const { weather } = useOpolWeather();
    const [wText, wIcon] = weather ? describeWeather(weather.code, weather.isDay) : [];
    const now = new Date();
    const first = firstNameOf(name) || "there";

    return (
        <section className="mh" aria-label="Welcome">
            <header className="mh-hero" style={{ "--mh-logo": `url("${logo}")` }}>
                <div className="mh-hero-top">
                    <div className="mh-school">
                        <b>Opol Community College</b>
                        <small>Smart Campus Lost &amp; Found</small>
                    </div>
                    <span className="mh-role"><GraduationCap size={14} /> {role}</span>
                </div>
                <h2 className="mh-hello">{greetingFor(now)}, {first} 👋</h2>
                <p className="mh-sub">
                    {dateFmt.format(now)}
                    {weather && <> · {wIcon} {weather.temp}°C {wText}</>}
                </p>
            </header>
        </section>
    );
}
