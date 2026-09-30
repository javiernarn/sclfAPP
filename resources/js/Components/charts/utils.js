// Shared math/format helpers for the chart components.

export const PALETTE = ['var(--ch-1)', 'var(--ch-2)', 'var(--ch-3)', 'var(--ch-4)', 'var(--ch-5)', 'var(--ch-6)'];

export function niceMax(max) {
    if (max <= 0) return 4;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const n = max / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return Math.max(4, step * pow);
}

export const fmt = (n, d = 0) =>
    Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

// Smooth curve through points (Catmull-Rom → cubic Bézier), clamped so the
// line never overshoots below/above its neighbours.
export function smoothPath(pts) {
    if (!pts.length) return '';
    if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const lo = Math.min(p1[1], p2[1]);
        const hi = Math.max(p1[1], p2[1]);
        const c1y = Math.min(hi, Math.max(lo, p1[1] + (p2[1] - p0[1]) / 6));
        const c2y = Math.min(hi, Math.max(lo, p2[1] - (p3[1] - p1[1]) / 6));
        d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    return d;
}

export function timeAgo(date, now = Date.now()) {
    const s = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
