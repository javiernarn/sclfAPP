import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { publicRoutes, adminRoutes, securityRoutes, studentRoutes } from './routes';
import MainPage from './Pages/Main/MainPage';
import SetupAccountPage from './Pages/Profile/SetupAccountPage';
import ApprovalRequestModal from './Components/shared/ApprovalRequestModal';
import useServiceWorkerNavigation from './hooks/useServiceWorkerNavigation';

const SETUP_PATH = '/app/setup-account';

function ProtectedRoute({ children, requiredRoles }) {
    const { user, roles, loading } = useAuth();
    const location = useLocation();

    if (loading) return <MainPage />;
    if (!user) return <Navigate to="/login" replace />;

    // Admin-created staff accounts (instructor/security_officer/admin)
    // must finish SetupAccountPage — their own password/photo/name —
    // before touching anything else. Mirrors EnsureProfileSetupComplete
    // on the backend, which blocks the underlying API calls the same
    // way, so this is a UX convenience on top of an already-enforced
    // rule, not the only thing enforcing it.
    if (user.must_setup_profile && location.pathname !== SETUP_PATH) {
        return <Navigate to={SETUP_PATH} replace />;
    }

    if (requiredRoles && !requiredRoles.some((r) => roles.includes(r))) {
        return <Navigate to="/app/dashboard" replace />;
    }

    return children;
}

// Reachable by any authenticated user (any role can have been created by
// an admin and land here), but only while setup is actually still
// pending — once it's done, revisiting this URL just bounces to the
// dashboard instead of re-showing the form.
function SetupRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) return <MainPage />;
    if (!user) return <Navigate to="/login" replace />;
    if (!user.must_setup_profile) return <Navigate to="/app/dashboard" replace />;

    return children;
}

export default function RootApp() {
    // Lets tapping a background push notification jump straight to the
    // relevant claim/match/item when SCLF is already open in another tab.
    useServiceWorkerNavigation();

    return (
        // Suspense fallback covers the lazy-loaded SecurityQrScanner chunk
        // (see routes/index.js) — MainPage doubles as the loading screen
        // elsewhere in the app, so reuse it here for a consistent feel.
        <Suspense fallback={<MainPage />}>
            <ApprovalRequestModal />
            <Routes>
                {/* "/" always shows the loading screen first, which then decides
                    whether to send the visitor to /login or to their dashboard. */}
                <Route path="/" element={<MainPage />} />

                {publicRoutes.map(({ path, component: Component }) => (
                    <Route key={path} path={path} element={<Component />} />
                ))}

                <Route path={SETUP_PATH} element={<SetupRoute><SetupAccountPage /></SetupRoute>} />

                {studentRoutes.map(({ path, component: Component }) => (
                    <Route key={path} path={path} element={<ProtectedRoute><Component /></ProtectedRoute>} />
                ))}

                {securityRoutes.map(({ path, component: Component }) => (
                    <Route key={path} path={path} element={
                        <ProtectedRoute requiredRoles={['security_officer', 'admin', 'staff']}><Component /></ProtectedRoute>
                    } />
                ))}

                {adminRoutes.map(({ path, component: Component }) => (
                    <Route key={path} path={path} element={
                        <ProtectedRoute requiredRoles={['admin', 'staff']}><Component /></ProtectedRoute>
                    } />
                ))}

                {/* Unknown URLs fall back to the loading screen too, so it can
                    re-evaluate auth state and route the visitor correctly. */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}
