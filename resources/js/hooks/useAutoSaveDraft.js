import { useCallback, useEffect, useRef, useState } from 'react';
import axios, { getStoredToken } from '../config/axiosConfig';
import { BASE_URL } from '../config/constant';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';
import { clearDraft as removeLocalDraft, readDraft, writeDraft } from '../utils/autosave';

const LOCAL_DEBOUNCE_MS = 500;   // this device: almost instant
const SERVER_DEBOUNCE_MS = 1500; // your account: a moment after you stop typing

/**
 * Auto Save for a report form.
 *
 *   const { autoSave, savedAt, synced, clearDraft } = useAutoSaveDraft({
 *       formKey: 'lost-item', value: form, initial: EMPTY_FORM, isDirty,
 *       onRestore: setForm,
 *   });
 *
 * - Switch OFF (default): does nothing at all — the form behaves as before.
 * - Switch ON: every change is written to this device straight away (so it
 *   survives a dropped connection or a closed tab) and a moment later to the
 *   person's account on the server (so it follows them to another device).
 *   Offline? It stays on the device and syncs by itself when the connection
 *   comes back. The next time the form opens, the newer of the two is put back.
 * - Call `clearDraft()` after a successful submit (or an explicit Cancel) so
 *   a finished report never comes back as a draft.
 *
 * Only plain field values are kept. Photos / videos / files can't be stored
 * this way and have to be attached again.
 */
export default function useAutoSaveDraft({ formKey, value, initial, isDirty, onRestore }) {
    const { user } = useAuth();
    const { autoSave } = usePreferences();
    const toast = useToast();
    const uid = user?.id ?? null;
    const enabled = !!uid && autoSave;

    const [savedAt, setSavedAt] = useState(null);
    const [synced, setSynced] = useState(false);
    // Set only once the restore for this account+form has FINISHED. Until then
    // the (still blank) form must never be saved or allowed to wipe the draft.
    const [readyKey, setReadyKey] = useState(null);

    const latest = useRef({ value, isDirty, enabled });
    const restoredFor = useRef(null);
    const suppress = useRef(false);      // set by clearDraft() so a late flush can't resurrect the draft
    const onRestoreRef = useRef(onRestore);
    const localVersion = useRef(0);      // bumps on every local write
    const syncedVersion = useRef(0);     // last local version the server has
    const flight = useRef(null);         // the PUT currently in the air
    const serverTimer = useRef(null);
    onRestoreRef.current = onRestore;
    latest.current = { value, isDirty, enabled };

    // ---- server sync ------------------------------------------------------
    const pushToServer = useCallback(async () => {
        if (!latest.current.enabled || suppress.current || flight.current) return;
        const snap = readDraft(uid, formKey);
        if (!snap || syncedVersion.current === localVersion.current) return;

        const version = localVersion.current;
        flight.current = axios
            .put(`/drafts/${formKey}`, { data: snap.data, saved_at: snap.savedAt }, { silent: true })
            .then(() => {
                syncedVersion.current = version;
                if (!suppress.current) setSynced(version === localVersion.current);
            })
            .catch(() => { setSynced(false); /* offline / server hiccup: retried on 'online' */ })
            .finally(() => {
                flight.current = null;
                // typed more while this was in flight -> send the newer text too
                if (!suppress.current && latest.current.enabled
                    && syncedVersion.current !== localVersion.current && navigator.onLine !== false) {
                    pushToServer();
                }
            });
    }, [uid, formKey]);

    // Page is going away: a normal request could be cancelled, `keepalive` is not.
    const pushWithKeepalive = useCallback(() => {
        const snap = readDraft(uid, formKey);
        const token = getStoredToken();
        if (!snap || !token || syncedVersion.current === localVersion.current) return;
        try {
            fetch(`${BASE_URL}api/drafts/${formKey}`, {
                method: 'PUT',
                keepalive: true,
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ data: snap.data, saved_at: snap.savedAt }),
            });
        } catch { /* best effort — the on-device copy is already safe */ }
    }, [uid, formKey]);

    // ---- restore ----------------------------------------------------------
    // Put the newest draft back once, when Auto Save is on and the form opens.
    useEffect(() => {
        if (!enabled) { restoredFor.current = null; setReadyKey(null); return undefined; }
        const marker = `${uid}:${formKey}`;
        if (restoredFor.current === marker) return undefined;

        // NOTE: `restoredFor` is only set when the restore has really finished
        // (below). Setting it up-front broke React StrictMode / re-runs: the
        // first, cancelled run marked it done and the second run then skipped
        // the restore, so the saved draft never came back.
        let cancelled = false;
        (async () => {
            const local = readDraft(uid, formKey);
            let remote = null;
            try {
                const res = await axios.get(`/drafts/${formKey}`, { silent: true, timeout: 4000 });
                if (res.data?.data) remote = { data: res.data.data, savedAt: res.data.saved_at || 0 };
            } catch { /* offline: the on-device copy is all there is */ }
            if (cancelled) return;

            restoredFor.current = marker;
            const best = remote && (!local || remote.savedAt > local.savedAt) ? remote : local;
            // Nothing saved, or already typing something new? Leave the form alone.
            if (best && !latest.current.isDirty) {
                onRestoreRef.current({ ...(initial || {}), ...best.data });
                setSavedAt(best.savedAt || Date.now());
                // keep a copy on this device too and note the account has it
                writeDraft(uid, formKey, best.data);
                localVersion.current += 1;
                syncedVersion.current = best === remote ? localVersion.current : 0;
                setSynced(best === remote);
                toast.info('We restored the draft you were working on. Fields stay locked until you tap Add Report.', { title: 'Draft restored' });
            }
            setReadyKey(marker);
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, uid, formKey]);

    // ---- save -------------------------------------------------------------
    // `dropIfClean`: only the debounced path (the person emptied the form
    // themselves) may delete a draft. Hide/offline/unmount flushes just write.
    const flush = useCallback((dropIfClean = false) => {
        const { value: v, isDirty: dirty, enabled: on } = latest.current;
        if (!on || suppress.current) return;
        if (!dirty) {
            if (dropIfClean) {
                removeLocalDraft(uid, formKey);
                localVersion.current += 1;
                syncedVersion.current = localVersion.current;
                axios.delete(`/drafts/${formKey}`, { silent: true }).catch(() => {});
                setSavedAt(null);
                setSynced(false);
            }
            return;
        }
        const at = writeDraft(uid, formKey, v);
        if (at) {
            localVersion.current += 1;
            setSavedAt(at);
            setSynced(false);
        }
    }, [uid, formKey]);

    // Debounced saves while typing: device first, account a moment later.
    useEffect(() => {
        if (!enabled) return undefined;
        // Don't save (or wipe a stored draft) with the blank first render
        // while the restore is still looking for that draft.
        if (readyKey !== `${uid}:${formKey}`) return undefined;
        suppress.current = false;
        const local = setTimeout(() => flush(true), LOCAL_DEBOUNCE_MS);
        clearTimeout(serverTimer.current);
        serverTimer.current = setTimeout(pushToServer, SERVER_DEBOUNCE_MS);
        return () => clearTimeout(local);
    }, [value, isDirty, enabled, readyKey, flush, pushToServer, uid, formKey]);

    // Page hidden / closed / connection dropped or back / leaving the form.
    useEffect(() => {
        if (!enabled) return undefined;
        const leaving = () => { flush(false); pushWithKeepalive(); };
        const onHide = () => { if (document.visibilityState === 'hidden') leaving(); };
        const onOffline = () => flush(false);
        const onOnline = () => pushToServer(); // connection is back: catch the account up
        window.addEventListener('pagehide', leaving);
        window.addEventListener('offline', onOffline);
        window.addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onHide);
        return () => {
            window.removeEventListener('pagehide', leaving);
            window.removeEventListener('offline', onOffline);
            window.removeEventListener('online', onOnline);
            document.removeEventListener('visibilitychange', onHide);
            clearTimeout(serverTimer.current);
            // unmount: leaving the form by any route (e.g. an accidental sidebar click) keeps the work
            flush(false);
            pushToServer();
        };
    }, [enabled, flush, pushToServer, pushWithKeepalive]);

    const clearDraft = useCallback(() => {
        suppress.current = true;
        clearTimeout(serverTimer.current);
        removeLocalDraft(uid, formKey);
        setSavedAt(null);
        setSynced(false);
        if (!uid) return;
        // wait for an in-flight save so it can't land after the delete
        Promise.resolve(flight.current)
            .catch(() => {})
            .then(() => axios.delete(`/drafts/${formKey}`, { silent: true }))
            .catch(() => {});
    }, [uid, formKey]);

    return { autoSave: enabled, savedAt, synced, clearDraft };
}
