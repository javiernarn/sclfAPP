import { useEffect, useState } from "react";

// "Real phone" detection for the mobile bottom tab bar.
//
// This is deliberately NOT just a width breakpoint. A desktop or laptop
// browser dragged narrow must keep the normal desktop/laptop layout, so the
// query requires a *coarse* primary pointer (a finger — true on phones and
// tablets, false for a mouse/trackpad) AND a phone-sized screen:
//
//   1. Portrait phones:  width <= 600px
//   2. Landscape phones: height <= 500px
//      (a phone turned sideways can be ~900px wide but is never taller than
//       ~450px; tablets in landscape are taller than that, so they're
//       excluded and keep the existing tablet layout)
//
// Written as a comma-separated media query list (= "or") instead of the newer
// nested `or` syntax so it works on older Android WebViews and iOS Safari.
export const PHONE_QUERY =
    "(pointer: coarse) and (max-width: 600px), " +
    "(pointer: coarse) and (orientation: landscape) and (max-height: 500px)";

const getMatch = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false;
    }
    return window.matchMedia(PHONE_QUERY).matches;
};

export default function useIsPhone() {
    const [isPhone, setIsPhone] = useState(getMatch);

    useEffect(() => {
        if (typeof window.matchMedia !== "function") return undefined;
        const mq = window.matchMedia(PHONE_QUERY);
        const onChange = (e) => setIsPhone(e.matches);

        setIsPhone(mq.matches);
        if (mq.addEventListener) {
            mq.addEventListener("change", onChange);
            return () => mq.removeEventListener("change", onChange);
        }
        // Safari < 14
        mq.addListener(onChange);
        return () => mq.removeListener(onChange);
    }, []);

    return isPhone;
}
