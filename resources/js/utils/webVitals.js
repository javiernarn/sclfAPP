// Real-user speed: LCP, INP, CLS, TTFB (+ FCP) per page load, sent once when
// the page is hidden or closed, to POST /api/client-errors as one small beacon.
//
// The library is loaded with a dynamic import after the page has finished
// loading, so it is never part of the startup bundle.
import { sendTelemetry } from './telemetry';

// Share of page loads that report. 1 = everyone; fine for a campus-sized app.
// Lower it (e.g. 0.25) if the log ever grows too fast.
const SAMPLE_RATE = 1;

export function startWebVitals() {
    if (import.meta.env.DEV) return; // dev-server timings are meaningless
    if (typeof window === 'undefined' || Math.random() >= SAMPLE_RATE) return;

    // SPA route changes do not start a new "page load", so the measured page is the landing page.
    const landingPath = window.location.pathname;
    const metrics = {};
    let navType = '';
    let flushed = false;

    const flush = () => {
        if (flushed || !Object.keys(metrics).length) return;
        flushed = true;
        sendTelemetry({ type: 'vitals', path: landingPath, nav: navType, metrics: Object.values(metrics) });
    };

    const begin = async () => {
        try {
            const { onLCP, onINP, onCLS, onTTFB, onFCP } = await import('web-vitals');
            const record = (m) => {
                navType = m.navigationType || navType;
                metrics[m.name] = { name: m.name, value: m.value, rating: m.rating };
                flushed = false; // a later (better) value, e.g. final CLS, should be sent too
            };
            [onTTFB, onFCP, onLCP, onCLS, onINP].forEach((observe) => observe(record));

            // The reliable moment to send is when the user leaves or switches away.
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
            window.addEventListener('pagehide', flush);
        } catch { /* measuring speed must never break the app */ }
    };

    if (document.readyState === 'complete') begin();
    else window.addEventListener('load', () => setTimeout(begin, 0), { once: true });
}
