import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import AdminDashboard from '../pages/admin/AdminDashboard';
import StudentDashboard from '../pages/student/StudentDashboard';
import LostItemsList from '../pages/student/LostItemsList';
import LostItemCreate from '../pages/student/LostItemCreate';

const publicRoutes = [
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegisterPage },
];

const adminRoutes = [
    { path: '/admin/dashboard', component: AdminDashboard },
];

const studentRoutes = [
    { path: '/dashboard', component: StudentDashboard },
    { path: '/lost-items', component: LostItemsList },
    { path: '/lost-items/create', component: LostItemCreate },
];

export { publicRoutes, adminRoutes, studentRoutes };