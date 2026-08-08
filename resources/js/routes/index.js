import React from 'react';
import LoginPage from '../Pages/Auth/LoginPage';
import RegisterPage from '../Pages/Auth/RegisterPage';
import ForgotPassword from '../Pages/Auth/ForgotPassword';
import ResetPassword from '../Pages/Auth/ResetPassword';
import AdminDashboard from '../Pages/admin/AdminDashboard';
import AdminUsers from '../Pages/admin/AdminUsers';
import AdminUserDetail from '../Pages/admin/AdminUserDetail';
import AdminAuditLog from '../Pages/admin/AdminAuditLog';
import StudentDashboard from '../Pages/student/StudentDashboard';
import LostItemsList from '../Pages/student/LostItemsList';
import LostItemCreate from '../Pages/student/LostItemCreate';
import LostItemMatches from '../Pages/student/LostItemMatches';
import FoundItemsList from '../Pages/shared/FoundItemsList';
import FoundItemCreate from '../Pages/shared/FoundItemCreate';
import FoundItemDetail from '../Pages/shared/FoundItemDetail';
import ClaimDetail from '../Pages/shared/ClaimDetail';
import MyClaimsList from '../Pages/shared/MyClaimsList';
import NotificationsPage from '../Pages/shared/NotificationsPage';
import ProfilePage from '../Pages/Profile/ProfilePage';
import SecurityDashboard from '../Pages/security/SecurityDashboard';
import SecurityFoundItemsReview from '../Pages/security/SecurityFoundItemsReview';
import SecurityInventory from '../Pages/security/SecurityInventory';
import SecurityCounter from '../Pages/security/SecurityCounter';
import SecurityHistory from '../Pages/security/SecurityHistory';

// Lazy-loaded: pulls in the qr-scanner camera/worker bundle only when a
// security officer actually opens this page, instead of shipping it in
// everyone's main chunk (students, admins, etc. never touch this page).
const SecurityQrScanner = React.lazy(() => import('../Pages/security/SecurityQrScanner'));

const publicRoutes = [
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegisterPage },
    { path: '/forgot-password', component: ForgotPassword },
    { path: '/reset-password/:token', component: ResetPassword },
];

// All authenticated routes live under /app/ so the installed PWA's
// manifest scope ("/app/") only ever claims these — not /login,
// /register, /forgot-password, or /reset-password/:token, which must
// stay reachable as plain browser pages (see PwaManifestController).
const adminRoutes = [
    { path: '/app/admin/dashboard', component: AdminDashboard },
    { path: '/app/admin/users', component: AdminUsers },
    { path: '/app/admin/users/:id', component: AdminUserDetail },
    { path: '/app/admin/audit-log', component: AdminAuditLog },
    // Reuses the same page/endpoints Security uses at /app/security/history —
    // HistoryController already allows both security_officer and admin
    // (see routes/api.php), this just gives admins their own nav entry
    // and URL instead of making them guess the security path.
    { path: '/app/admin/history', component: SecurityHistory },
];

const securityRoutes = [
    { path: '/app/security/dashboard', component: SecurityDashboard },
    { path: '/app/security/found-items', component: SecurityFoundItemsReview },
    { path: '/app/security/claims', component: MyClaimsList },
    { path: '/app/security/qr-scanner', component: SecurityQrScanner },
    { path: '/app/security/inventory', component: SecurityInventory },
    { path: '/app/security/counter', component: SecurityCounter },
    { path: '/app/security/history', component: SecurityHistory },
];

// Routes reachable by any authenticated users such as (student, instructor, security
// officer, admin) — role-specific restrictions on WHAT they can do inside
// these pages are still enforced by the backend ,live server-side .
const studentRoutes = [
    { path: '/app/dashboard', component: StudentDashboard },
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
];

export { publicRoutes, adminRoutes, securityRoutes, studentRoutes };