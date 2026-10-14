// Is `path` a place this account may actually open?
//
// A post-login redirect (?redirect=/app/admin/... from a notification link or
// a page the previous person was on) must never drop a different account onto
// screens that belong to another role. Mirrors the role rules in RootApp.jsx.
export function canOpenPath(path, roles = []) {
    if (typeof path !== 'string' || !/^\/(?!\/)/.test(path)) return false;
    const has = (r) => roles.includes(r);
    const p = path.split(/[?#]/)[0];

    if (p === '/app/admin/requests' || p.startsWith('/app/admin/requests/')) return has('admin');
    if (p === '/app/admin' || p.startsWith('/app/admin/')) return has('admin') || has('staff');
    if (p === '/app/security' || p.startsWith('/app/security/')) return has('admin') || has('staff') || has('security_officer');
    if (p === '/app/dashboard' || p.startsWith('/app/dashboard/')) return has('student') || has('instructor');
    return true; // shared pages (claims, notifications, profile …) enforce access themselves
}
