// Auto Save — the on-device half of a draft.
//
// Every draft is written here first (instant, works offline) and then synced
// to the account on the server (see useAutoSaveDraft / DraftController), so it
// survives a refresh, a dropped connection, a closed tab or an accidental
// click on another sidebar item, and can be finished on another device. Keyed
// by account id so it never leaks to another account on a shared campus PC
// (also wiped on logout — see AuthContext). Every access is wrapped: storage
// can be blocked (private windows) or full, and none of that may ever break
// the form itself.

const DRAFT_PREFIX = 'sclf.draft.';
// A draft nobody came back to for a week is stale — drop it.
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const safe = (fn, fallback = null) => {
    try { return fn(); } catch { return fallback; }
};

const draftKey = (uid, form) => `${DRAFT_PREFIX}${uid}.${form}`;

export const readDraft = (uid, form) => {
    if (!uid) return null;
    return safe(() => {
        const raw = window.localStorage.getItem(draftKey(uid, form));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.data) return null;
        if (Date.now() - (parsed.savedAt || 0) > DRAFT_MAX_AGE_MS) {
            window.localStorage.removeItem(draftKey(uid, form));
            return null;
        }
        return parsed;
    });
};

// Returns the save timestamp, or null when it could not be stored.
export const writeDraft = (uid, form, data) => {
    if (!uid) return null;
    const savedAt = Date.now();
    const ok = safe(() => {
        window.localStorage.setItem(draftKey(uid, form), JSON.stringify({ v: 1, savedAt, data }));
        return true;
    }, false);
    return ok ? savedAt : null;
};

export const clearDraft = (uid, form) => {
    if (!uid) return;
    safe(() => window.localStorage.removeItem(draftKey(uid, form)));
};

// Every draft of one account (Auto Save switched off, or logging out).
export const clearAllDrafts = (uid) => {
    if (!uid) return;
    safe(() => {
        const prefix = `${DRAFT_PREFIX}${uid}.`;
        const doomed = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(prefix)) doomed.push(k);
        }
        doomed.forEach((k) => window.localStorage.removeItem(k));
    });
};
