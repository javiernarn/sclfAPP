import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { ClipboardList, Hourglass, CircleCheck, PackageSearch, Megaphone } from '../../Components/icons';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import DashboardSkeleton from '../../Components/shared/DashboardSkeleton';

export default function StudentDashboard() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = "Dashboard | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        axios.get('/lost-items', { silent: true })
            .then(res => setItems(res.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const pending = items.filter(i => (i.status || '').toLowerCase() === 'pending').length;
    const found = items.filter(i => (i.status || '').toLowerCase() === 'found').length;

    return (
        <DashboardShell
            eyebrow="Student Portal"
            title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'} 👋`}
            subtitle="Report items you've lost, or check what's been found around campus."
        >
            {loading ? (
                <DashboardSkeleton statCount={3} cardCount={2} />
            ) : (
                <>
                    <div className="ds-stat-grid">
                        <div className="ds-stat-card">
                            <div className="ds-stat-icon"><ClipboardList size={20} strokeWidth={2} /></div>
                            <div className="ds-stat-value">{items.length}</div>
                            <div className="ds-stat-label">Total Reports</div>
                        </div>
                        <div className="ds-stat-card">
                            <div className="ds-stat-icon"><Hourglass size={20} strokeWidth={2} /></div>
                            <div className="ds-stat-value">{pending}</div>
                            <div className="ds-stat-label">Pending</div>
                        </div>
                        <div className="ds-stat-card">
                            <div className="ds-stat-icon"><CircleCheck size={20} strokeWidth={2} /></div>
                            <div className="ds-stat-value">{found}</div>
                            <div className="ds-stat-label">Found</div>
                        </div>
                    </div>

                    <div className="ds-grid">
                        <div className="ds-card">
                            <div className="ds-card-title ds-card-title-icon"><PackageSearch size={18} strokeWidth={2} /> View Lost Items</div>
                            <p className="ds-card-desc">Browse everything that's been reported lost so far.</p>
                            <Link to="/app/lost-items" className="ds-btn ds-btn-secondary ds-btn-block">
                                View Lost Items
                            </Link>
                        </div>

                        <div className="ds-card">
                            <div className="ds-card-title ds-card-title-icon"><Megaphone size={18} strokeWidth={2} /> Report a Lost Item</div>
                            <p className="ds-card-desc">Lost something on campus? Let the community know.</p>
                            <Link to="/app/lost-items/create" className="ds-btn ds-btn-primary ds-btn-block">
                                Report a Lost Item
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </DashboardShell>
    );
}
