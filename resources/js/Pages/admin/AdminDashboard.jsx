import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif' }}>
            <h2>Admin Dashboard</h2>
            <p>Welcome, {user?.name} 👋</p>
            <p>This page is only visible to Admins.</p>
            <button onClick={handleLogout} style={{ padding: '8px 16px' }}>Logout</button>
        </div>
    );
}