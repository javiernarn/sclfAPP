import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, X, Share2 } from "lucide-react";
import logo from "../../assets/images/site-logo.png";
import {
    isInstalled, isSnoozed, isIos, isInAppBrowser, canNativePrompt,
    promptInstall, snooze, subscribe,
} from "../../utils/pwaInstall";
import "./InstallPrompt.css";

// "Install the app" banner. Shows once per device until the person either
// installs (never shown again on that device) or taps "Not now" (asked again
// in a week). Never shows inside the installed app itself.
//
//   Android / desktop Chrome, Edge, Samsung  -> Install button opens the browser's install dialog
//   iPhone / iPad                            -> Safari has no install API, so we show the two taps
//
// Hidden on printable pages.

const HIDE_ON = [/^\/app\/print\//, /print-report$/];
const SHOW_DELAY_MS = 2500;      // let the page settle before asking

export default function InstallPrompt() {
    const { pathname } = useLocation();
    const [, force] = useState(0);
    const [ready, setReady] = useState(false);
    const [iosHelp, setIosHelp] = useState(false);

    useEffect(() => subscribe(() => force((n) => n + 1)), []);
    useEffect(() => {
        const t = setTimeout(() => setReady(true), SHOW_DELAY_MS);
        return () => clearTimeout(t);
    }, []);

    if (!ready || HIDE_ON.some((re) => re.test(pathname))) return null;
    if (isInstalled() || isSnoozed()) return null;

    const native = canNativePrompt();
    const ios = isIos() && !isInAppBrowser();
    if (!native && !ios) return null;     // this browser can't install: say nothing

    const notNow = () => { setIosHelp(false); snooze(); };

    return (
        <div className="ip-wrap" role="region" aria-label="Install the app">
            <div className="ip-card">
                <img className="ip-logo" src={logo} alt="" width="44" height="44" />
                <div className="ip-text">
                    <b>Install SCLF</b>
                    <small>
                        {iosHelp
                            ? <>Tap <Share2 size={13} className="ip-inline" /> <b>Share</b>, then <b>Add to Home Screen</b>.</>
                            : "Open it from your home screen and get lost-and-found updates faster."}
                    </small>
                </div>
                <button type="button" className="ip-x" onClick={notNow} aria-label="Not now">
                    <X size={16} />
                </button>
                <div className="ip-actions">
                    <button type="button" className="ip-later" onClick={notNow}>Not now</button>
                    {iosHelp ? (
                        <button type="button" className="ip-go" onClick={notNow}>Got it</button>
                    ) : (
                        <button
                            type="button"
                            className="ip-go"
                            onClick={() => (native ? promptInstall() : setIosHelp(true))}
                        >
                            <Download size={16} /> Install
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
