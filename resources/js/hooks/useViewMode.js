import { useEffect, useState } from 'react';

// Remembers whether a given list page is showing "cards" (the default,
// friendlier row/card layout) or "table" (all columns at a glance) —
// scoped per page via `key` and persisted so the choice survives a
// refresh or coming back later, e.g. an admin who always wants Table
// on Users doesn't have to re-click it every visit.
const PREFIX = 'sclf.viewMode.';

export default function useViewMode(key, defaultMode = 'cards') {
    const storageKey = `${PREFIX}${key}`;

    const [mode, setMode] = useState(() => {
        try {
            const saved = window.localStorage.getItem(storageKey);
            return saved === 'cards' || saved === 'table' ? saved : defaultMode;
        } catch {
            return defaultMode;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey, mode);
        } catch {
            // Private-browsing / storage disabled — the toggle still works
            // for this session, it just won't be remembered next time.
        }
    }, [mode, storageKey]);

    return [mode, setMode];
}
