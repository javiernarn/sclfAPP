import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function StudentDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif' }}>
            <h2>Dashboard</h2>
            <p>Welcome, {user?.name} 👋</p>
            <p><Link to="/lost-items">View Lost Items</Link></p>
            <p><Link to="/lost-items/create">Report a Lost Item</Link></p>
            <button onClick={handleLogout} style={{ padding: '8px 16px' }}>Logout</button>
        </div>
    );
}