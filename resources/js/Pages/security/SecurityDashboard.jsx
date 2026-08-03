import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';

const STAT_LABELS = [
    ['lost_today', 'Lost Today'],
    ['found_today', 'Found Today'],
    ['claims_waiting', 'Claims Waiting'],
    ['items_pending_verification', 'Pending Verification'],
    ['items_released', 'Items Released'],
    ['suspicious_claims', 'Suspicious Claims'],
];

export default function SecurityDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = "Security Dashboard | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        axios.get('/analytics/overview')
            .then(res => setStats(res.data))
            .finally(() => setLoading(false));
    }, []);

    return (
        <DashboardShell
            eyebrow="Security"
            title="Security Officer Dashboard"
            subtitle="Pending reviews, claims, and inventory at a glance."
        >
            <div className="ds-stat-grid">
                {loading && [...Array(6)].map((_, i) => <div key={i} className="ds-stat-card ds-skeleton" style={{ height: 74 }} />)}
                {!loading && stats && STAT_LABELS.map(([key, label]) => (
                    <div key={key} className="ds-stat-card">
                        <div className="ds-stat-value">{stats[key]}</div>
                        <div className="ds-stat-label">{label}</div>
                    </div>
                ))}
            </div>

            <div className="ds-card" style={{ marginTop: 24 }}>
                <h3>Quick Actions</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                    <Link to="/security/found-items" className="ds-btn ds-btn-primary">Review Found Items</Link>
                    <Link to="/security/claims" className="ds-btn">Review Claims</Link>
                    <Link to="/security/inventory" className="ds-btn">Manage Inventory</Link>
                    <Link to="/security/qr-scanner" className="ds-btn">Scan Release Code</Link>
                </div>
            </div>
        </DashboardShell>
    );
}
