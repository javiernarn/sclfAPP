import React, { useEffect, useState } from "react";
import { MapPin } from "../icons";
import "./DashboardGreeting.css";

// Campus is in Opol, Misamis Oriental — clock and greeting use Philippine
// time so they always agree with the weather, wherever the device is.
const TZ = "Asia/Manila";
const OPOL = { lat: 8.5167, lon: 124.5667, label: "Opol, Misamis Oriental" };
const WEATHER_URL =
    `https://api.open-meteo.com/v1/forecast?latitude=${OPOL.lat}&longitude=${OPOL.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m` +
    `&timezone=${encodeURIComponent(TZ)}`;
// Re-check every minute and whenever the tab comes back into view. (The
// weather service itself publishes a new reading about every 15 minutes.)
const WEATHER_REFRESH_MS = 60 * 1000;

const manilaHour = (d) =>
    Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(d)) % 24;

// Good Morning 12:00 AM-11:59 AM, Good Noon 12:00-12:59 PM,
// Good Afternoon 1:00-5:59 PM, Good Evening 6:00 PM-11:59 PM.
export function greetingFor(date = new Date()) {
    const h = manilaHour(date);
    if (h < 12) return "Good Morning";
    if (h === 12) return "Good Noon";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
}

// Open-Meteo WMO weather codes -> short text + emoji.
function describeWeather(code, isDay) {
    if (code === 0) return isDay ? ["Clear sky", "☀️"] : ["Clear night", "🌙"];
    if (code === 1) return isDay ? ["Mostly clear", "🌤️"] : ["Mostly clear", "🌙"];
    if (code === 2) return ["Partly cloudy", "⛅"];
    if (code === 3) return ["Overcast", "☁️"];
    if (code === 45 || code === 48) return ["Foggy", "🌫️"];
    if (code >= 51 && code <= 57) return ["Drizzle", "🌦️"];
    if (code >= 61 && code <= 67) return ["Rain", "🌧️"];
    if (code >= 71 && code <= 77) return ["Cold snap", "🌨️"];
    if (code >= 80 && code <= 82) return ["Rain showers", "🌦️"];
    if (code >= 95) return ["Thunderstorm", "⛈️"];
    return ["Cloudy", "☁️"];
}

// Shared across dashboard mounts so navigating back doesn't refetch each time.
let weatherCache = null; // { at, data }

function useOpolWeather() {
    const [weather, setWeather] = useState(weatherCache?.data ?? null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (weatherCache && Date.now() - weatherCache.at < WEATHER_REFRESH_MS - 1000) {
                setWeather(weatherCache.data);
                return;
            }
            try {
                const res = await fetch(WEATHER_URL, { cache: "no-store" });
                if (!res.ok) throw new Error("weather");
                const c = (await res.json()).current;
                const data = {
                    temp: Math.round(c.temperature_2m),
                    feels: Math.round(c.apparent_temperature),
                    humidity: Math.round(c.relative_humidity_2m),
                    wind: Math.round(c.wind_speed_10m),
                    code: c.weather_code,
                    isDay: c.is_day === 1,
                };
                weatherCache = { at: Date.now(), data };
                if (!cancelled) { setWeather(data); setFailed(false); }
            } catch {
                if (!cancelled) setFailed(true);
            }
        };
        const onVisible = () => { if (document.visibilityState === "visible") load(); };
        load();
        const id = setInterval(load, WEATHER_REFRESH_MS);
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("online", load);
        return () => {
            cancelled = true;
            clearInterval(id);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("online", load);
        };
    }, []);

    return { weather, failed };
}

const dateFmt = new Intl.DateTimeFormat("en-PH", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });

// First name only ("Jonee John Antiquina" -> "Jonee").
export const firstNameOf = (full) => String(full || "").trim().split(/\s+/)[0] || "";

// Left: eyebrow, greeting, first name, description.
// Right (fills the empty middle of the header): live clock + date, then
// Opol weather. Refresh button stays at the far right (rendered by the shell).
export default function DashboardGreeting({ eyebrow, name, subtitle }) {
    const [now, setNow] = useState(() => new Date());
    const { weather, failed } = useOpolWeather();

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const [wText, wIcon] = weather ? describeWeather(weather.code, weather.isDay) : [];

    return (
        <>
            <div className="ds-header-text ds-greeting">
                {eyebrow && <span className="ds-eyebrow">{eyebrow}</span>}
                <h1 className="ds-title ds-greeting-title">
                    {greetingFor(now)}{firstNameOf(name) ? `, ${firstNameOf(name)}` : ""} 👋
                </h1>
                {subtitle && <p className="ds-greeting-sub">{subtitle}</p>}
            </div>

            <div className="ds-greeting-widget" aria-label="Date, time and weather in Opol">
                <div className="ds-gw-clock">
                    <span className="ds-gw-time">{timeFmt.format(now)}</span>
                    <span className="ds-gw-date">{dateFmt.format(now)}</span>
                </div>
                <span className="ds-gw-sep" aria-hidden="true" />
                <div className="ds-gw-weather">
                    {weather ? (
                        <>
                            <span className="ds-gw-wicon" aria-hidden="true">{wIcon}</span>
                            <div className="ds-gw-wtext">
                                <span className="ds-gw-temp">
                                    <b>{weather.temp}°C</b> <span>{wText}</span>
                                </span>
                                <span className="ds-gw-detail">
                                    Feels {weather.feels}° · {weather.humidity}% humidity · {weather.wind} km/h
                                </span>
                                <span className="ds-gw-loc">
                                    <i className="ds-gw-live" aria-hidden="true" />
                                    <MapPin size={12} strokeWidth={2} /> {OPOL.label}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="ds-gw-wtext">
                            <span className="ds-gw-temp"><span>{failed ? "Weather unavailable" : "Loading weather…"}</span></span>
                            <span className="ds-gw-loc"><MapPin size={12} strokeWidth={2} /> {OPOL.label}</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}