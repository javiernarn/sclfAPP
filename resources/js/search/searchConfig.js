import {
    LayoutDashboard,
    PackageSearch,
    PackageCheck,
    ClipboardCheck,
    AlertTriangle,
    ShieldCheck,
    Wrench,
    Bell,
    UserCircle,
    ListOrdered,
    Handshake,
    Boxes,
    UserCheck,
    QrCode,
    History,
    Activity,
    Plus,
} from '../Components/icons';

// Labels for the grouped results the API returns (one key per category).
export const CATEGORY_LABELS = {
    found_items: 'Found Items',
    lost_items: 'Lost Items',
    claims: 'Claims',
    security_incidents: 'Incidents',
    service_requests: 'Service Requests',
    visitors: 'Visitors',
    users: 'People',
};

// "Jump to a page" shortcuts. `keywords` lets typing "report" or "scan"
// surface the right page even when the label itself doesn't contain it.
// Mirrors the sidebar's NAV_BY_ROLE (DashboardShell.jsx) plus the "create"
// pages people look for most — if you add a sidebar page, add it here too.
const STUDENT_LINKS = [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: 'home overview', tokenized: true },
    { to: '/app/lost-items/create', label: 'Report a lost item', icon: Plus, keywords: 'lost report new missing create' },
    { to: '/app/found-items/create', label: 'Report a found item', icon: Plus, keywords: 'found report new turn in create' },
    { to: '/app/lost-items', label: 'Lost Items', icon: PackageSearch, keywords: 'lost reports missing' },
    { to: '/app/found-items', label: 'Found Items', icon: PackageCheck, keywords: 'found browse' },
    { to: '/app/claims', label: 'My Claims', icon: ClipboardCheck, keywords: 'claim status request' },
    { to: '/app/incidents', label: 'Security Incidents', icon: AlertTriangle, keywords: 'incident report security' },
    { to: '/app/service-requests', label: 'Service Requests', icon: Wrench, keywords: 'facilities repair request' },
    { to: '/app/notifications', label: 'Notifications', icon: Bell, keywords: 'alerts inbox' },
    { to: '/app/profile', label: 'My Profile', icon: UserCircle, keywords: 'account settings password' },
];

const SECURITY_LINKS = [
    { to: '/app/security/dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: 'home overview' },
    { to: '/app/security/counter', label: 'Counter', icon: PackageCheck, keywords: 'intake desk walk-in' },
    { to: '/app/security/counter-dashboard', label: 'Counter Dashboard', icon: ListOrdered, keywords: 'queue' },
    { to: '/app/security/found-items', label: 'Found Item Reviews', icon: PackageSearch, keywords: 'review approve found' },
    { to: '/app/lost-items', label: 'Lost Items', icon: PackageSearch, keywords: 'lost reports' },
    { to: '/app/security/matches', label: 'Matches', icon: Handshake, keywords: 'match lost found' },
    { to: '/app/security/claims', label: 'Claims', icon: ClipboardCheck, keywords: 'claim release' },
    { to: '/app/security/inventory', label: 'Inventory', icon: Boxes, keywords: 'storage stock' },
    { to: '/app/security/unclaimed-items', label: 'Unclaimed Items', icon: AlertTriangle, keywords: 'disposal expired' },
    { to: '/app/incidents', label: 'Incidents', icon: ShieldCheck, keywords: 'security report' },
    { to: '/app/service-requests', label: 'Service Requests', icon: Wrench, keywords: 'facilities repair' },
    { to: '/app/security/visitors', label: 'Visitors', icon: UserCheck, keywords: 'visitor log badge check in' },
    { to: '/app/security/qr-scanner', label: 'QR Release Scanner', icon: QrCode, keywords: 'scan qr release' },
    { to: '/app/security/history', label: 'History', icon: History, keywords: 'released log' },
    { to: '/app/notifications', label: 'Notifications', icon: Bell, keywords: 'alerts inbox' },
    { to: '/app/profile', label: 'My Profile', icon: UserCircle, keywords: 'account settings password' },
];

const ADMIN_LINKS = [
    { to: '/app/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: 'home overview' },
    { to: '/app/lost-items', label: 'Lost Items', icon: PackageSearch, keywords: 'lost reports' },
    { to: '/app/found-items', label: 'Found Items', icon: PackageCheck, keywords: 'found browse' },
    { to: '/app/security/matches', label: 'Matches', icon: Handshake, keywords: 'match lost found' },
    { to: '/app/claims', label: 'Claims', icon: ClipboardCheck, keywords: 'claim release' },
    { to: '/app/admin/users', label: 'Users', icon: UserCircle, keywords: 'accounts people students staff' },
    { to: '/app/admin/requests', label: 'Staff Requests', icon: ClipboardCheck, keywords: 'approve pending', adminOnly: true },
    { to: '/app/admin/audit-log', label: 'Audit Log', icon: ShieldCheck, keywords: 'trail actions', adminOnly: true },
    { to: '/app/admin/activity', label: 'User Activity', icon: Activity, keywords: 'ip device spam', adminOnly: true },
    { to: '/app/security/counter-dashboard', label: 'Counter Dashboard', icon: ListOrdered, keywords: 'queue' },
    { to: '/app/security/unclaimed-items', label: 'Unclaimed Items', icon: AlertTriangle, keywords: 'disposal expired' },
    { to: '/app/incidents', label: 'Incidents', icon: ShieldCheck, keywords: 'security report' },
    { to: '/app/service-requests', label: 'Service Requests', icon: Wrench, keywords: 'facilities repair' },
    { to: '/app/security/visitors', label: 'Visitors', icon: UserCheck, keywords: 'visitor log badge' },
    { to: '/app/admin/history', label: 'History', icon: History, keywords: 'released log' },
    { to: '/app/notifications', label: 'Notifications', icon: Bell, keywords: 'alerts inbox' },
    { to: '/app/profile', label: 'My Profile', icon: UserCircle, keywords: 'account settings password' },
];

// Same role resolution as DashboardShell: admin/staff > security > student
// (instructors share the student set).
export function quickLinksFor(roles, user) {
    const list = Array.isArray(roles) ? roles : [];
    const isAdmin = list.includes('admin') || list.includes('staff');
    const isSecurity = list.includes('security_officer');
    const isStaffOnly = list.includes('staff') && !list.includes('admin');
    const base = isAdmin ? ADMIN_LINKS : isSecurity ? SECURITY_LINKS : STUDENT_LINKS;
    const token = user?.public_token;

    return base
        .filter((link) => !(link.adminOnly && isStaffOnly))
        .map((link) => (link.tokenized && token ? { ...link, to: `${link.to}/${token}` } : link));
}

// The handful shown before anything is typed.
export const FEATURED_LINK_COUNT = 5;

export function filterQuickLinks(links, query) {
    const q = query.trim().toLowerCase();
    if (!q) return links;
    return links.filter((l) => `${l.label} ${l.keywords || ''}`.toLowerCase().includes(q));
}
