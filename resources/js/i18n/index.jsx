import React, { useCallback, useMemo } from 'react';

// ---------------------------------------------------------------------------
// SCLF text (English only)
//
// Dictionaries live in ./locales/en/<namespace>.js — every file default-exports
// a flat { key: 'text' } object and is picked up automatically
// (import.meta.glob). A key is addressed as "<namespace>.<key>", e.g.
// t('login.signIn').
//
//   const { t } = useTranslation();
//   t('login.signIn')
//   t('dash.shelfMany', { count: 3 })    // "{count} unclaimed items are waiting…"
//
// A key missing from the dictionary renders as the key itself, so an
// untranslated string never renders blank.
// ---------------------------------------------------------------------------

const LOCALE = 'en-PH'; // Intl tag used for dates and numbers

// --- dictionary ------------------------------------------------------------
const modules = import.meta.glob('./locales/en/*.js', { eager: true });
const DICT = {};
for (const [path, mod] of Object.entries(modules)) {
    const m = path.match(/\.\/locales\/en\/([^/]+)\.js$/);
    if (!m) continue;
    for (const [k, v] of Object.entries(mod.default || {})) {
        DICT[`${m[1]}.${k}`] = v;
    }
}

if (typeof document !== 'undefined') document.documentElement.lang = 'en';

export function translate(key, vars) {
    const raw = DICT[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : `{${name}}`));
}

export function useTranslation() {
    const t = useCallback((key, vars) => translate(key, vars), []);
    return useMemo(() => ({ t, locale: LOCALE }), [t]);
}

export default useTranslation;

// "Some **bold** text" -> ['Some ', <strong>bold</strong>, ' text']. Lets a
// sentence keep emphasised numbers without splitting it in pieces.
export function rich(text) {
    return String(text).split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

// t(key) when the dictionary has it, otherwise the supplied fallback — used for
// server-provided values (statuses, categories) that may not all be listed.
export function tOr(t, key, fallback) {
    const out = t(key);
    return out === key ? fallback : out;
}
