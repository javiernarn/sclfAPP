// "Back to where you last were" for every signed-in page.
//
// React Router only knows the history stack, not WHICH screen sent you to the
// current one. This module remembers, for every history entry (location.key),
// the in-app page it was opened from — kept in sessionStorage so a reload of
// the tab doesn't lose it. The shared <BackLink /> (rendered by DashboardShell)
// reads it, so every role — admin, staff, security, instructor, student — gets
// a back path that follows what THEY actually clicked, e.g.
//   Users -> View details      =>  "Back to Users"
//   Notifications -> a claim   =>  "Back to Notifications"
//   Dashboard -> User Details  =>  "Back to Dashboard"
//
// trackLocation() runs once per navigation from RootApp. It is idempotent per
// location key, so React StrictMode's double render is harmless.

const STORE = 'sclf.nav.from';
const MAX_ENTRIES = 300;

let from = null; // { [locationKey]: { path, direct } | null }
let last = null; // { key, path }

const read = () => {
    if (from) return from;
    try {
        from = JSON.parse(window.sessionStorage.getItem(STORE) || '{}') || {};
    } catch {
        from = {};
    }
    return from;
};

const persist = () => {
    try {
        const keys = Object.keys(from);
        if (keys.length > MAX_ENTRIES) {
            keys.slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete from[k]);
        }
        window.sessionStorage.setItem(STORE, JSON.stringify(from));
    } catch {
        // storage unavailable — back links simply fall back to the parent page
    }
};

const isApp = (p) => typeof p === 'string' && p.startsWith('/app/');

/**
 * @param location  react-router location
 * @param navType   'PUSH' | 'REPLACE' | 'POP'
 */
export function trackLocation(location, navType) {
    const map = read();
    const key = location.key;
    const path = `${location.pathname}${location.search}`;

    if (!(key in map)) {
        let entry = null;
        if (last && last.key !== key) {
            const prevEntry = map[last.key] || null;
            if (navType === 'REPLACE') {
                // A redirect/replace takes the place of the entry before it,
                // so it inherits that entry's "came from".
                entry = prevEntry;
            } else if (navType === 'PUSH' && isApp(last.path)) {
                if (last.path.split('?')[0] === location.pathname) {
                    // Same page again (e.g. tapping a notification for the
                    // claim you're already on): keep the older origin.
                    entry = prevEntry ? { ...prevEntry, direct: false } : null;
                } else {
                    entry = { path: last.path, direct: true };
                }
            }
        }
        map[key] = entry;
        persist();
    }

    if (!last || last.key !== key) last = { key, path };
}

export function getCameFrom(locationKey) {
    return read()[locationKey] || null;
}

// Friendly page names for "Back to …".
const LABELS = [
    [/^\/app\/admin\/users\/[^/]+$/, 'User Details'],
    [/^\/app\/admin\/users$/, 'Users'],
    [/^\/app\/admin\/dashboard$/, 'Dashboard'],
    [/^\/app\/admin\/requests$/, 'Staff Requests'],
    [/^\/app\/admin\/audit-log$/, 'Audit Log'],
    [/^\/app\/admin\/activity$/, 'User Activity'],
    [/^\/app\/admin\/history$/, 'History'],
    [/^\/app\/admin\/print-report$/, 'Print Report'],
    [/^\/app\/security\/dashboard$/, 'Dashboard'],
    [/^\/app\/security\/matches$/, 'Matches'],
    [/^\/app\/security\/claims$/, 'Claims'],
    [/^\/app\/security\/qr-scanner$/, 'QR Scanner'],
    [/^\/app\/security\/inventory$/, 'Inventory'],
    [/^\/app\/security\/counter-dashboard$/, 'Counter Dashboard'],
    [/^\/app\/security\/counter$/, 'Counter'],
    [/^\/app\/security\/unclaimed-items$/, 'Unclaimed Items'],
    [/^\/app\/security\/visitors$/, 'Visitors'],
    [/^\/app\/security\/history$/, 'History'],
    [/^\/app\/security\/print-report$/, 'Print Report'],
    [/^\/app\/dashboard(\/.*)?$/, 'Dashboard'],
    [/^\/app\/print\/.+$/, 'Printed Report'],
    [/^\/app\/lost-items\/create$/, 'Report Lost Item'],
    [/^\/app\/lost-items\/[^/]+\/matches$/, 'Matches'],
    [/^\/app\/lost-items$/, 'Lost Items'],
    [/^\/app\/found-items\/create$/, 'Report Found Item'],
    [/^\/app\/found-items\/[^/]+$/, 'Found Item'],
    [/^\/app\/found-items$/, 'Found Items'],
    [/^\/app\/claims\/[^/]+$/, 'Claim'],
    [/^\/app\/claims$/, 'Claims'],
    [/^\/app\/notifications$/, 'Notifications'],
    [/^\/app\/profile$/, 'Profile'],
    [/^\/app\/incidents\/report$/, 'Report Incident'],
    [/^\/app\/incidents\/[^/]+$/, 'Incident'],
    [/^\/app\/incidents$/, 'Incidents'],
    [/^\/app\/service-requests\/new$/, 'New Service Request'],
    [/^\/app\/service-requests\/[^/]+$/, 'Service Request'],
    [/^\/app\/service-requests$/, 'Service Requests'],
];

export function labelForPath(path) {
    const pathname = String(path || '').split('?')[0].replace(/\/+$/, '');
    const hit = LABELS.find(([re]) => re.test(pathname));
    return hit ? hit[1] : 'previous page';
}

// Where a page "belongs" when we have no record of where the person came from
// (opened from a bookmark, an emailed link, or after a fresh sign-in).
const PARENTS = [
    [/^\/app\/admin\/users\/[^/]+$/, '/app/admin/users'],
    [/^\/app\/claims\/[^/]+$/, '/app/claims'],
    [/^\/app\/found-items\/create$/, '/app/found-items'],
    [/^\/app\/found-items\/[^/]+$/, '/app/found-items'],
    [/^\/app\/lost-items\/create$/, '/app/lost-items'],
    [/^\/app\/lost-items\/[^/]+\/matches$/, '/app/lost-items'],
    [/^\/app\/incidents\/report$/, '/app/incidents'],
    [/^\/app\/incidents\/[^/]+$/, '/app/incidents'],
    [/^\/app\/service-requests\/new$/, '/app/service-requests'],
    [/^\/app\/service-requests\/[^/]+$/, '/app/service-requests'],
];

export function parentPathFor(pathname) {
    const p = String(pathname || '').replace(/\/+$/, '');
    const hit = PARENTS.find(([re]) => re.test(p));
    return hit ? hit[1] : null;
}

// Role home pages have nothing "behind" them.
export const HOME_PATHS = ['/app/dashboard', '/app/admin/dashboard', '/app/security/dashboard'];
export const isHomePath = (pathname) => {
    const p = String(pathname || '').replace(/\/+$/, '');
    return HOME_PATHS.includes(p) || /^\/app\/dashboard\/[^/]+$/.test(p);
};
