import LoginPage from '../Pages/Auth/LoginPage';
import RegisterPage from '../Pages/Auth/RegisterPage';
import ForgotPassword from '../Pages/Auth/ForgotPassword';
import ResetPassword from '../Pages/Auth/ResetPassword';
import AdminDashboard from '../Pages/admin/AdminDashboard';
import AdminUsers from '../Pages/admin/AdminUsers';
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
import SecurityQrScanner from '../Pages/security/SecurityQrScanner';
import SecurityInventory from '../Pages/security/SecurityInventory';

const publicRoutes = [
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegisterPage },
    { path: '/forgot-password', component: ForgotPassword },
    { path: '/reset-password/:token', component: ResetPassword },
];

const adminRoutes = [
    { path: '/admin/dashboard', component: AdminDashboard },
    { path: '/admin/users', component: AdminUsers },
    { path: '/admin/audit-log', component: AdminAuditLog },
];

const securityRoutes = [
    { path: '/security/dashboard', component: SecurityDashboard },
    { path: '/security/found-items', component: SecurityFoundItemsReview },
    { path: '/security/claims', component: MyClaimsList },
    { path: '/security/qr-scanner', component: SecurityQrScanner },
    { path: '/security/inventory', component: SecurityInventory },
];

// Routes reachable by any authenticated user (student, faculty, security
// officer, admin) — role-specific restrictions on WHAT they can do inside
// these pages are still enforced by the backend (RBAC lives server-side).
const studentRoutes = [
    { path: '/dashboard', component: StudentDashboard },
    { path: '/lost-items', component: LostItemsList },
    { path: '/lost-items/create', component: LostItemCreate },
    { path: '/lost-items/:id/matches', component: LostItemMatches },
    { path: '/found-items', component: FoundItemsList },
    { path: '/found-items/create', component: FoundItemCreate },
    { path: '/found-items/:id', component: FoundItemDetail },
    { path: '/claims', component: MyClaimsList },
    { path: '/claims/:id', component: ClaimDetail },
    { path: '/notifications', component: NotificationsPage },
    { path: '/profile', component: ProfilePage },
];

export { publicRoutes, adminRoutes, securityRoutes, studentRoutes };