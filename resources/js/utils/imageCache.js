// Image preloading + caching, so photos are already on their way (or already
// downloaded and decoded) by the time a page draws them.
//
// Three pieces:
//   1. preloadImage / preloadImages  - start downloading + decoding a photo
//      early. Same URL = same browser cache entry, so the real <img> later
//      shows instantly instead of popping in.
//   2. preloadFromApiData            - called from the axios response hook:
//      scans an API reply for photo URLs (image_url, profile_picture_url...)
//      and preloads them the moment the data arrives, on every page.
//   3. getProtectedImageUrl          - private report attachments need the
//      Authorization header, so they are fetched as blobs. This keeps those
//      blobs for the session (small cap) so re-opening a report does not
//      download the same photo again.

const MAX_KEPT = 300;          // decoded images we keep a reference to
const MAX_PER_REPLY = 60;      // never flood the network from one big list
const PHOTO_KEYS = new Set(['image_url', 'profile_picture_url', 'photo_url', 'avatar_url']);

// url -> HTMLImageElement. Holding the element keeps the decoded bitmap warm.
const kept = new Map();

const isPreloadable = (url) =>
    typeof url === 'string' &&
    url.length > 0 &&
    // Only our own signed /media links or same-origin paths; never data:/blob:
    // URLs and never third-party hosts.
    (url.startsWith('/') || url.startsWith(window.location.origin));

export function preloadImage(url) {
    if (typeof window === 'undefined' || !isPreloadable(url) || kept.has(url)) return;

    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    kept.set(url, img);

    // Decode off the main thread now, so painting it later costs nothing.
    if (typeof img.decode === 'function') img.decode().catch(() => {});

    if (kept.size > MAX_KEPT) {
        const oldest = kept.keys().next().value;
        kept.delete(oldest);
    }
}

export function preloadImages(urls, limit = MAX_PER_REPLY) {
    if (!Array.isArray(urls)) return;
    let n = 0;
    for (const url of urls) {
        if (n >= limit) break;
        if (isPreloadable(url) && !kept.has(url)) {
            preloadImage(url);
            n += 1;
        }
    }
}

// Walk an API reply (bounded) and preload every photo URL found in it.
export function preloadFromApiData(data) {
    if (!data || typeof data !== 'object') return;
    const found = [];
    const stack = [data];
    let visited = 0;

    while (stack.length && visited < 5000 && found.length < MAX_PER_REPLY) {
        const node = stack.pop();
        visited += 1;
        if (Array.isArray(node)) {
            for (let i = node.length - 1; i >= 0; i -= 1) {
                if (node[i] && typeof node[i] === 'object') stack.push(node[i]);
            }
        } else {
            for (const key of Object.keys(node)) {
                const value = node[key];
                if (PHOTO_KEYS.has(key)) {
                    if (isPreloadable(value)) found.push(value);
                } else if (value && typeof value === 'object') {
                    stack.push(value);
                }
            }
        }
    }

    preloadImages(found);
}

// ---- Private attachments (need the Authorization header) -------------------

const MAX_BLOBS = 60;
// id -> Promise<string> (object URL). Caching the promise also means two tiles
// asking for the same file at once share one download.
const blobUrls = new Map();

export function getProtectedImageUrl(id, fetchBlob) {
    if (blobUrls.has(id)) {
        // refresh recency
        const hit = blobUrls.get(id);
        blobUrls.delete(id);
        blobUrls.set(id, hit);
        return hit;
    }

    const promise = fetchBlob()
        .then((blob) => window.URL.createObjectURL(blob))
        .catch((err) => {
            blobUrls.delete(id); // let a later attempt retry
            throw err;
        });
    blobUrls.set(id, promise);

    if (blobUrls.size > MAX_BLOBS) {
        const oldestId = blobUrls.keys().next().value;
        const oldest = blobUrls.get(oldestId);
        blobUrls.delete(oldestId);
        oldest.then((u) => window.URL.revokeObjectURL(u)).catch(() => {});
    }
    return promise;
}

// Call on sign-out so one person's private photos never linger for the next.
export function clearImageCaches() {
    kept.clear();
    blobUrls.forEach((p) => p.then((u) => window.URL.revokeObjectURL(u)).catch(() => {}));
    blobUrls.clear();
}
