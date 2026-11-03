import React, { useEffect, useState } from 'react';

/**
 * Profile photo drawn as a real <img> on top of an avatar bubble.
 *
 * Keep the initials as the element's other content; the photo covers them once it
 * is ready:  <span className="ds-avatar">{initials}<AvatarPhoto src={url} /></span>
 *
 * Why it works the way it does (iPhone PWA + a host that may run several copies of
 * the app):
 *  - Every page has its own avatar, so each page change re-creates it. Previously each
 *    one started invisible and re-requested the image, which looked like the photo
 *    "disappearing and reappearing" while you tapped around.
 *  - So a photo is downloaded ONCE per session into memory (a blob: URL) and every
 *    avatar - on every page - shows it instantly from there.
 *  - A failed download (e.g. one app copy that does not have the file yet and restores it
 *    from the database on first request) is retried a few times instead of giving up.
 *  - The downloaded photo is also saved on the device (IndexedDB), so it still shows after
 *    the app is closed and reopened, and with NO connection. It is keyed by the photo's
 *    file path, not the full link: the link's signature changes every day, the file never
 *    does (every upload gets a new random file name). Cleared on sign-out.
 */

// ---- tiny IndexedDB store (every call is best effort: failure just means "not saved") ----
const DB_NAME = 'sclf-avatars';
const STORE = 'photos';
const MAX_SAVED = 20;

const keyOf = (src) => {
    try { return new URL(src, window.location.origin).pathname; } catch (e) { return src; }
};

function openDb() {
    return new Promise((resolve, reject) => {
        try {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } catch (e) { reject(e); }
    });
}

async function idb(mode, fn) {
    const db = await openDb();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const out = fn(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } finally { db.close(); }
}

const savedGet = (key) => idb('readonly', (st) => st.get(key)).catch(() => undefined);

async function savedPut(key, blob) {
    try {
        await idb('readwrite', (st) => { st.put({ blob, at: Date.now() }, key); });
        const keys = await idb('readonly', (st) => st.getAllKeys());
        if (keys && keys.length > MAX_SAVED) {
            await idb('readwrite', (st) => { keys.slice(0, keys.length - MAX_SAVED).forEach((k) => st.delete(k)); });
        }
    } catch (e) { /* private mode / quota: fine, memory copy still works */ }
}

const savedClear = () => idb('readwrite', (st) => { st.clear(); }).catch(() => {});


const ready = new Map();     // src -> blob: URL already downloaded this session
const pending = new Map();   // src -> Promise<blob: URL> currently downloading (shared)
const MAX_READY = 30;
const DELAYS = [0, 700, 1800, 4000]; // ms before each attempt

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function load(src) {
    if (ready.has(src)) return Promise.resolve(ready.get(src));
    if (pending.has(src)) return pending.get(src);

    const job = (async () => {
        const key = keyOf(src);

        // 1. Saved on this device from an earlier visit -> instant, works offline.
        const saved = await savedGet(key);
        if (saved && saved.blob && saved.blob.size) {
            const url = URL.createObjectURL(saved.blob);
            ready.set(src, url);
            return url;
        }

        // 2. Download it (retrying), then save it on the device.
        let lastErr = new Error('failed');
        for (const delay of DELAYS) {
            if (delay) {
                if (typeof navigator !== 'undefined' && navigator.onLine === false) break; // offline: retrying is pointless
                await sleep(delay);
            }
            try {
                const res = await fetch(src, { credentials: 'same-origin', cache: delay ? 'reload' : 'default' });
                if (!res.ok) throw new Error(`status ${res.status}`);
                const blob = await res.blob();
                if (!blob || !blob.size) throw new Error('empty');
                savedPut(key, blob);
                const url = URL.createObjectURL(blob);
                ready.set(src, url);
                if (ready.size > MAX_READY) {
                    const oldest = ready.keys().next().value;
                    URL.revokeObjectURL(ready.get(oldest));
                    ready.delete(oldest);
                }
                return url;
            } catch (e) {
                lastErr = e;
            }
        }
        throw lastErr;
    })();

    pending.set(src, job);
    const done = () => pending.delete(src);
    job.then(done, done);
    return job;
}

// Call on sign-out so one person's photo never lingers for the next.
export function clearAvatarCache() {
    ready.forEach((u) => URL.revokeObjectURL(u));
    ready.clear();
    pending.clear();
    savedClear();
}

export default function AvatarPhoto({ src }) {
    const [url, setUrl] = useState(() => (src && ready.get(src)) || '');

    useEffect(() => {
        if (!src) { setUrl(''); return undefined; }
        if (ready.has(src)) { setUrl(ready.get(src)); return undefined; }
        let alive = true;
        setUrl('');
        load(src).then((u) => { if (alive) setUrl(u); }).catch(() => {});
        return () => { alive = false; };
    }, [src]);

    if (!url) return null;

    return (
        <img
            className="sclf-avatar-img"
            src={url}
            alt=""
            decoding="async"
            draggable={false}
        />
    );
}
