// season.js — which look the whole app wears.
//
//   default   -> the normal SCLF look (nothing changes)
//   halloween -> FIRST theme  (bats, pumpkins, bones, cobwebs, purple + orange)
//   christmas -> SECOND theme (snow, lights, tree, ornaments, red + green)
//   newyear   -> THIRD theme  (fireworks, confetti, clock, champagne, gold + midnight)
//
// The value comes from the server (.env  APP_SEASON=...), which writes it on
// <html data-season="..."> before the first paint, so there is never a flash
// of the wrong theme. "first" / "second" are accepted as aliases.
//
// Handy for testing without touching .env:  open any page with
//   ?season=halloween   ?season=christmas   ?season=newyear   ?season=default
// (remembered for the browser tab only; ?season=off clears it).

export const SEASONS = ['default', 'halloween', 'christmas', 'newyear'];

const ALIASES = {
    first: 'halloween',
    '1': 'halloween',
    second: 'christmas',
    '2': 'christmas',
    xmas: 'christmas',
    third: 'newyear',
    '3': 'newyear',
    ny: 'newyear',
    'new-year': 'newyear',
    new_year: 'newyear',
    newyears: 'newyear',
    normal: 'default',
    none: 'default',
    off: 'default',
    '': 'default',
};

export const normalizeSeason = (value) => {
    const v = String(value ?? '').trim().toLowerCase();
    if (SEASONS.includes(v)) return v;
    return ALIASES[v] ?? 'default';
};

const PREVIEW_KEY = 'sclf-season-preview';

export const getSeason = () => {
    if (typeof document === 'undefined') return 'default';
    try {
        const q = new URLSearchParams(window.location.search).get('season');
        if (q !== null) {
            const next = normalizeSeason(q);
            if (next === 'default' && q.toLowerCase() === 'off') window.sessionStorage.removeItem(PREVIEW_KEY);
            else window.sessionStorage.setItem(PREVIEW_KEY, next);
        }
        const preview = window.sessionStorage.getItem(PREVIEW_KEY);
        if (preview) return normalizeSeason(preview);
    } catch (e) {
        // storage blocked — fall through to the server value
    }
    return normalizeSeason(document.documentElement.getAttribute('data-season'));
};

// Run once, as early as possible (imported by main.jsx), so a ?season=
// preview paints correctly from the first frame.
export const applySeason = () => {
    if (typeof document === 'undefined') return 'default';
    const season = getSeason();
    // default = no attribute at all, so no seasonal rule can ever match
    if (season === 'default') document.documentElement.removeAttribute('data-season');
    else document.documentElement.setAttribute('data-season', season);
    return season;
};

export const isSeasonal = (season) => season === 'halloween' || season === 'christmas' || season === 'newyear';

// Colour of the phone status bar / PWA title bar for each season.
export const seasonBarColor = (season, isDark) => {
    if (season === 'halloween') return isDark ? '#12071f' : '#f97316';
    if (season === 'christmas') return isDark ? '#06140f' : '#b91c1c';
    if (season === 'newyear') return isDark ? '#0b0f2e' : '#b45309';
    return null;
};

// Page colour behind everything (matches the first paint from the server).
export const seasonCanvas = (season, isDark) => {
    if (season === 'halloween') return isDark ? '#0d0618' : '#fff4e6';
    if (season === 'christmas') return isDark ? '#06121c' : '#f1f8f6';
    if (season === 'newyear') return isDark ? '#070a1f' : '#fff4d6';
    return null;
};
