import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { publicRoutes, adminRoutes, studentRoutes } from './routes';

function ProtectedRoute({ children, requiredRole }) {
    const { user, roles, loading } = useAuth();

    if (loading) return <div>Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (requiredRole && !roles.includes(requiredRole)) return <Navigate to="/dashboard" replace />;

    return children;
}

export default function RootApp() {
    const { user } = useAuth();

    return (
        <Routes>
            <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />

            {publicRoutes.map(({ path, component: Component }) => (
                <Route key={path} path={path} element={<Component />} />
            ))}

            {studentRoutes.map(({ path, component: Component }) => (
                <Route key={path} path={path} element={<ProtectedRoute><Component /></ProtectedRoute>} />
            ))}

            {adminRoutes.map(({ path, component: Component }) => (
                <Route key={path} path={path} element={<ProtectedRoute requiredRole="admin"><Component /></ProtectedRoute>} />
            ))}

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}