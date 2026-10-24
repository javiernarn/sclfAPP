import React, { useCallback, useMemo, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// SCLF translations
//
// English only for now. To add a language, add an entry to LANGUAGES and a
// folder of the same files under ./locales/<code>/ — the pickers in the login
// card and the avatar menus list whatever is in LANGUAGES. Dictionaries live in ./locales/<code>/<namespace>.js — every
// file default-exports a flat { key: 'text' } object and is picked up
// automatically (import.meta.glob), so adding a page's strings never touches
// another page's file. A key is addressed as "<namespace>.<key>", e.g.
// t('login.signIn').
//
//   const { t } = useTranslation();
//   t('login.signIn')
//   t('dash.shelfMany', { count: 3 })    // "{count} unclaimed items are waiting…"
//
// Anything missing in a language falls back to English, then to the key
// itself, so an untranslated string never renders blank.
//
// The choice is remembered in localStorage + a cookie, kept in sync between
// tabs, and mirrored onto <html lang>.
// ---------------------------------------------------------------------------

export const LANGUAGES = [
    { code: 'en', label: 'English', short: 'EN', htmlLang: 'en', intl: 'en-PH' },
];

export const DEFAULT_LANGUAGE = 'en';
const CODES = LANGUAGES.map((l) => l.code);
const STORAGE_KEY = 'sclf-lang';
const COOKIE_NAME = 'sclf-lang';
const CHANNEL_NAME = 'sclf-lang-channel';

// --- dictionaries ----------------------------------------------------------
const modules = import.meta.glob('./locales/*/*.js', { eager: true });
const DICT = {};
for (const [path, mod] of Object.entries(modules)) {
    const m = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.js$/);
    if (!m) continue;
    const [, lang, ns] = m;
    DICT[lang] = DICT[lang] || {};
    for (const [k, v] of Object.entries(mod.default || {})) {
        DICT[lang][`${ns}.${k}`] = v;
    }
}

export function translate(lang, key, vars) {
    const raw = DICT[lang]?.[key] ?? DICT[DEFAULT_LANGUAGE]?.[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : `{${name}}`));
}

// --- persistence + tiny store ---------------------------------------------
const read = () => {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (CODES.includes(stored)) return stored;
    } catch (e) { /* storage blocked */ }
    try {
        const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
        const value = match ? decodeURIComponent(match[1]) : null;
        if (CODES.includes(value)) return value;
    } catch (e) { /* ignore */ }
    return DEFAULT_LANGUAGE;
};

let current = typeof window !== 'undefined' ? read() : DEFAULT_LANGUAGE;
const listeners = new Set();

const applyHtmlLang = (code) => {
    if (typeof document === 'undefined') return;
    const entry = LANGUAGES.find((l) => l.code === code);
    document.documentElement.lang = entry ? entry.htmlLang : 'en';
};
applyHtmlLang(current);

const emit = () => listeners.forEach((fn) => fn());

export function setLanguage(code) {
    if (!CODES.includes(code) || code === current) return;
    current = code;
    try { window.localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* ignore */ }
    try { document.cookie = `${COOKIE_NAME}=${code}; path=/; max-age=31536000; SameSite=Lax`; } catch (e) { /* ignore */ }
    applyHtmlLang(code);
    emit();
    try {
        const ch = new BroadcastChannel(CHANNEL_NAME);
        ch.postMessage(code);
        ch.close();
    } catch (e) { /* unsupported */ }
}

if (typeof window !== 'undefined') {
    // Other tabs: BroadcastChannel where available, "storage" event as backup.
    const sync = (code) => {
        if (!CODES.includes(code) || code === current) return;
        current = code;
        applyHtmlLang(code);
        emit();
    };
    try {
        const ch = new BroadcastChannel(CHANNEL_NAME);
        ch.onmessage = (e) => sync(e.data);
    } catch (e) { /* unsupported */ }
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) sync(e.newValue);
    });
}

const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
const getSnapshot = () => current;
const getServerSnapshot = () => DEFAULT_LANGUAGE;

/**
 * useTranslation(enabled = true)
 *
 * `enabled = false` pins the caller to English. DashboardShell uses it so that
 * only student / instructor accounts see translated text — an admin signing in
 * on the same browser still gets the English interface.
 */
export function useTranslation(enabled = true) {
    const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const lang = enabled ? stored : DEFAULT_LANGUAGE;
    const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
    // `locale` is the Intl/BCP-47 tag for dates and numbers (browsers fall back
    // to the default locale for tags they don't know, so this is always safe).
    const locale = LANGUAGES.find((l) => l.code === lang)?.intl || 'en-PH';
    return useMemo(() => ({ t, lang, locale, language: stored, setLanguage }), [t, lang, locale, stored]);
}

export default useTranslation;

// "Some **bold** text" -> ['Some ', <strong>bold</strong>, ' text']. Lets a
// translated sentence keep emphasised numbers without splitting it in pieces.
export function rich(text) {
    return String(text).split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

// t(key) when the dictionary has it, otherwise the supplied fallback — used for
// server-provided values (statuses, categories) that may not all be listed.
export function tOr(t, key, fallback) {
    const out = t(key);
    return out === key ? fallback : out;
}
