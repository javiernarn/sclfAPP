import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { publicRoutes, adminRoutes, securityRoutes, studentRoutes } from './routes';
import MainPage from './Pages/Main/MainPage';

function ProtectedRoute({ children, requiredRoles }) {
    const { user, roles, loading } = useAuth();

    if (loading) return <MainPage />;
    if (!user) return <Navigate to="/login" replace />;
    if (requiredRoles && !requiredRoles.some((r) => roles.includes(r))) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

export default function RootApp() {
    return (
        // Suspense fallback covers the lazy-loaded SecurityQrScanner chunk
        // (see routes/index.js) — MainPage doubles as the loading screen
        // elsewhere in the app, so reuse it here for a consistent feel.
        <Suspense fallback={<MainPage />}>
            <Routes>
                {/* "/" always shows the loading screen first, which then decides
                    whether to send the visitor to /login or to their dashboard. */}
                <Route path="/" element={<MainPage />} />

                {publicRoutes.map(({ path, component: Component }) => (
                    <Route key={path} path={path} element={<Component />} />
                ))}

                {studentRoutes.map(({ path, component: Component }) => (
                    <Route key={path} path={path} element={<ProtectedRoute><Component /></ProtectedRoute>} />
                ))}

                {securityRoutes.map(({ path, component: Component }) => (
                    <Route key={path} path={path} element={
                        <ProtectedRoute requiredRoles={['security_officer', 'admin']}><Component /></ProtectedRoute>
                    } />
                ))}

                {adminRoutes.map(({ path, component: Component }) => (
                    <Route key={path} path={path} element={
                        <ProtectedRoute requiredRoles={['admin']}><Component /></ProtectedRoute>
                    } />
                ))}

                {/* Unknown URLs fall back to the loading screen too, so it can
                    re-evaluate auth state and route the visitor correctly. */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}
