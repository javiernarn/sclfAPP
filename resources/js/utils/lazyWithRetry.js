import React from 'react';

const RELOAD_FLAG = 'sclf_chunk_reload';

/**
 * React.lazy for page components, made safe for deploys.
 *
 * After a new build, the file names of the page chunks change. A browser tab
 * (or installed PWA) that was opened BEFORE the deploy still asks for the old
 * names, gets a 404, and the dynamic import fails. When that happens we
 * reload the page once so it picks up the new index and chunk names. The flag
 * in sessionStorage stops a reload loop if the failure is something else
 * (for example the person is simply offline): the second failure is thrown
 * so the normal error handling shows it.
 */
export default function lazyWithRetry(factory) {
    return React.lazy(async () => {
        try {
            const module = await factory();
            try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* storage blocked: ignore */ }
            return module;
        } catch (error) {
            let alreadyReloaded = true;
            try {
                alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
                if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, '1');
            } catch { /* storage blocked: do not reload, just fail */ }

            if (!alreadyReloaded && typeof navigator !== 'undefined' && navigator.onLine !== false) {
                window.location.reload();
                // Keep the Suspense fallback up while the reload happens.
                return new Promise(() => {});
            }
            throw error;
        }
    });
}
