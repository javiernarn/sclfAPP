import React from 'react';
import { Navigate } from 'react-router-dom';
import lazyWithRetry from '../utils/lazyWithRetry';
import LoginPage from '../Pages/Auth/LoginPage';
// Every page except the login screen is loaded on demand (one JS file each),
// so a student never downloads the admin or security code, and the QR
// scanner's camera/worker bundle still only loads on its own page. RootApp
// wraps the routes in <Suspense>, and lazyWithRetry recovers from stale chunk
// names after a deploy. Pages that appear in several routes share one chunk.
const RegisterPage = lazyWithRetry(() => import('../Pages/Auth/RegisterPage'));
const ForgotPassword = lazyWithRetry(() => import('../Pages/Auth/ForgotPassword'));
const ResetPassword = lazyWithRetry(() => import('../Pages/Auth/ResetPassword'));
// Public page opened by scanning a visitor badge QR (no login).
const VisitorPortal = lazyWithRetry(() => import('../Pages/Public/VisitorPortal'));
const AdminDashboard = lazyWithRetry(() => import('../Pages/admin/AdminDashboard'));
const AdminUsers = lazyWithRetry(() => import('../Pages/admin/AdminUsers'));
const AdminUserDetail = lazyWithRetry(() => import('../Pages/admin/AdminUserDetail'));
const AdminAuditLog = lazyWithRetry(() => import('../Pages/admin/AdminAuditLog'));
const AdminUserActivity = lazyWithRetry(() => import('../Pages/admin/AdminUserActivity'));
const AdminActionRequests = lazyWithRetry(() => import('../Pages/admin/AdminActionRequests'));
const StudentDashboard = lazyWithRetry(() => import('../Pages/student/StudentDashboard'));
const LostItemsList = lazyWithRetry(() => import('../Pages/student/LostItemsList'));
const LostItemCreate = lazyWithRetry(() => import('../Pages/student/LostItemCreate'));
const LostItemMatches = lazyWithRetry(() => import('../Pages/student/LostItemMatches'));
const FoundItemsList = lazyWithRetry(() => import('../Pages/shared/FoundItemsList'));
const FoundItemCreate = lazyWithRetry(() => import('../Pages/shared/FoundItemCreate'));
const FoundItemDetail = lazyWithRetry(() => import('../Pages/shared/FoundItemDetail'));
const ClaimDetail = lazyWithRetry(() => import('../Pages/shared/ClaimDetail'));
const MyClaimsList = lazyWithRetry(() => import('../Pages/shared/MyClaimsList'));
const NotificationsPage = lazyWithRetry(() => import('../Pages/shared/NotificationsPage'));
const ProfilePage = lazyWithRetry(() => import('../Pages/Profile/ProfilePage'));
const SecurityDashboard = lazyWithRetry(() => import('../Pages/security/SecurityDashboard'));
const PrintReport = lazyWithRetry(() => import('../Pages/shared/PrintReport'));
const StudentPrintReport = lazyWithRetry(() => import('../Pages/shared/StudentPrintReport'));
const SecurityQrScanner = lazyWithRetry(() => import('../Pages/security/SecurityQrScanner'));
const SecurityMatches = lazyWithRetry(() => import('../Pages/security/SecurityMatches'));
const SecurityInventory = lazyWithRetry(() => import('../Pages/security/SecurityInventory'));
const SecurityCounter = lazyWithRetry(() => import('../Pages/security/SecurityCounter'));
const SecurityCounterDashboard = lazyWithRetry(() => import('../Pages/security/SecurityCounterDashboard'));
const SecurityUnclaimedItems = lazyWithRetry(() => import('../Pages/security/SecurityUnclaimedItems'));
const SecurityVisitors = lazyWithRetry(() => import('../Pages/security/SecurityVisitors'));
const SecurityHistory = lazyWithRetry(() => import('../Pages/security/SecurityHistory'));
const IncidentsList = lazyWithRetry(() => import('../Pages/shared/IncidentsList'));
const IncidentCreate = lazyWithRetry(() => import('../Pages/shared/IncidentCreate'));
const IncidentDetail = lazyWithRetry(() => import('../Pages/shared/IncidentDetail'));
const ServiceRequestsList = lazyWithRetry(() => import('../Pages/shared/ServiceRequestsList'));
const ServiceRequestCreate = lazyWithRetry(() => import('../Pages/shared/ServiceRequestCreate'));
const ServiceRequestDetail = lazyWithRetry(() => import('../Pages/shared/ServiceRequestDetail'));

const publicRoutes = [
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegisterPage },
    { path: '/forgot-password', component: ForgotPassword },
    // Static route first on purpose: it's the "password changed" page the form
    // is replaced with after a successful reset (see ResetPassword.jsx).
    { path: '/reset-password/success', component: ResetPassword },
    { path: '/reset-password/:token', component: ResetPassword },
    // Visitor badge QR: /visitor/{signed badge token}. Outside /app/ on purpose (see PwaManifestController).
    { path: '/visitor/:token', component: VisitorPortal },
];

// All authenticated routes live under /app/ so the installed PWA's
// manifest scope ("/app/") only ever claims these — not /login,
// /register, /forgot-password, or /reset-password/:token, which must
// stay reachable as plain browser pages (see PwaManifestController).
const RedirectToFoundReview = () => React.createElement(Navigate, { to: '/app/found-items?tab=review', replace: true });
const RedirectToLostReview = () => React.createElement(Navigate, { to: '/app/lost-items?tab=review', replace: true });

const adminRoutes = [
    { path: '/app/admin/dashboard', component: AdminDashboard },
    // Printable dashboard report — opened from the SCLF logo menu.
    { path: '/app/admin/print-report', component: PrintReport },
    { path: '/app/admin/users', component: AdminUsers },
    { path: '/app/admin/users/:id', component: AdminUserDetail },
    { path: '/app/admin/requests', component: AdminActionRequests },
    { path: '/app/admin/audit-log', component: AdminAuditLog },
    { path: '/app/admin/activity', component: AdminUserActivity },
    // Reuses the same page/endpoints Security uses at /app/security/history —
    // HistoryController already allows both security_officer and admin
    // (see routes/api.php), this just gives admins their own nav entry
    // and URL instead of making them guess the security path.
    { path: '/app/admin/history', component: SecurityHistory },
];

const securityRoutes = [
    { path: '/app/security/dashboard', component: SecurityDashboard },
    { path: '/app/security/print-report', component: PrintReport },
    // Reviews now live on the Found Items / Lost Items pages ("Pending review"
    // tab). Old links, bookmarks and notification links still land there.
    { path: '/app/security/found-items', component: RedirectToFoundReview },
    { path: '/app/security/lost-items', component: RedirectToLostReview },
    // Match queue for whoever handles lost & found (security / admin / staff).
    { path: '/app/security/matches', component: SecurityMatches },
    { path: '/app/security/claims', component: MyClaimsList },
    { path: '/app/security/qr-scanner', component: SecurityQrScanner },
    { path: '/app/security/inventory', component: SecurityInventory },
    { path: '/app/security/counter', component: SecurityCounter },
    { path: '/app/security/counter-dashboard', component: SecurityCounterDashboard },
    { path: '/app/security/unclaimed-items', component: SecurityUnclaimedItems },
    { path: '/app/security/visitors', component: SecurityVisitors },
    { path: '/app/security/history', component: SecurityHistory },
];

// Routes reachable by any authenticated users such as (student, instructor, security
// officer, admin) — role-specific restrictions on WHAT they can do inside
// these pages are still enforced by the backend ,live server-side .
const studentRoutes = [
    { path: '/app/dashboard', component: StudentDashboard },
    // The dashboard URL carries the account's own user token. /app/dashboard
    // (no token) redirects to it — see StudentDashboard.
    { path: '/app/dashboard/:token', component: StudentDashboard },
    // Printed copy of a student's / instructor's dashboard; its QR code opens this
    // page for admin / staff / security. Access is decided by the server.
    { path: '/app/print/:token', component: StudentPrintReport },
    { path: '/app/lost-items', component: LostItemsList },
    { path: '/app/lost-items/create', component: LostItemCreate },
    { path: '/app/lost-items/:id/matches', component: LostItemMatches },
    { path: '/app/found-items', component: FoundItemsList },
    { path: '/app/found-items/create', component: FoundItemCreate },
    { path: '/app/found-items/:id', component: FoundItemDetail },
    { path: '/app/claims', component: MyClaimsList },
    { path: '/app/claims/:id', component: ClaimDetail },
    { path: '/app/notifications', component: NotificationsPage },
    { path: '/app/profile', component: ProfilePage },
    { path: '/app/incidents', component: IncidentsList },
    { path: '/app/incidents/report', component: IncidentCreate },
    { path: '/app/incidents/:id', component: IncidentDetail },
    { path: '/app/service-requests', component: ServiceRequestsList },
    { path: '/app/service-requests/new', component: ServiceRequestCreate },
    { path: '/app/service-requests/:id', component: ServiceRequestDetail },
];

export { publicRoutes, adminRoutes, securityRoutes, studentRoutes };