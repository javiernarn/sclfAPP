import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    ClipboardList, Hourglass, CircleCheck, Handshake, Users, ShieldCheck, ScrollText,
    PackageSearch, PackageCheck, Boxes,
} from 'lucide-react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import DashboardSkeleton from '../../Components/shared/DashboardSkeleton';

// Same channel split Security's dashboard uses (see FoundItem::CHANNEL_* on
// the backend) — items reported online by strangers vs. items handed over
// in person at the Counter by a known owner. Keeping the two apart here
// too so an admin glancing at this page isn't left wondering whether a
// given number is about online reports or counter check-ins.
const REPORT_STATS = [
    ['today', 'Reported Today', PackageSearch],
    ['pending_verification', 'Pending Verification', Hourglass],
    ['released', 'Released', PackageCheck],
];

const COUNTER_STATS = [
    ['checked_in_today', 'Checked In Today', PackageCheck],
    ['awaiting_release', 'Awaiting Release', Hourglass],
    ['released', 'Released', PackageCheck],
];

// Layout: stat grid takes the wide left column, the icon/title/description
// label sits to its right in a compact column (see
// .ds-dashboard-section-body in DashboardShell.css — same pattern used on
// SecurityDashboard, and it reverses back to head-on-top on phones).
function StatSection({ icon: SectionIcon, iconClass, title, desc, stats, values }) {
    return (
        <div className="ds-dashboard-section">
            <div className="ds-dashboard-section-body">
                <div className="ds-stat-grid">
                    {values && stats.map(([key, label, Icon]) => (
                        <div key={key} className="ds-stat-card">
                            <div className="ds-stat-icon"><Icon size={20} strokeWidth={2} /></div>
                            <div className="ds-stat-value">{values[key]}</div>
                            <div className="ds-stat-label">{label}</div>
                        </div>
                    ))}
                </div>
                <div className="ds-dashboard-section-head">
                    <span className={`ds-dashboard-section-icon ${iconClass}`}>
                        <SectionIcon size={18} strokeWidth={2} />
                    </span>
                    <div>
                        <h2 className="ds-dashboard-section-title">{title}</h2>
                        <p className="ds-dashboard-section-desc">{desc}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = "Admin Dashboard | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        axios.get('/analytics/overview')
            .then(res => setStats(res.data))
            .finally(() => setLoading(false));
    }, []);

    return (
        <DashboardShell
            eyebrow="Admin Portal"
            title={`Welcome, ${user?.name?.split(' ')[0] || 'Admin'} 👋`}
            subtitle="Oversee lost & found reports across Opol Community College."
        >
            {loading ? (
                <DashboardSkeleton statCount={4} cardCount={2} />
            ) : (
                <>
                    <div className="ds-stat-grid">
                        <div className="ds-stat-card">
                            <div className="ds-stat-icon"><ClipboardList size={20} strokeWidth={2} /></div>
                            <div className="ds-stat-value">{stats.total_lost}</div>
                            <div className="ds-stat-label">Total Lost Reports</div>
                        </div>
                        <div className="ds-stat-card">
                            <div className="ds-stat-icon"><Hourglass size={20} strokeWidth={2} /></div>
                            <div className="ds-stat-value">{stats.claims_waiting}</div>
                            <div className="ds-stat-label">Claims Waiting</div>
                        </div>
                        <div className="ds-stat-card">
                            <div className="ds-stat-icon"><CircleCheck size={20} strokeWidth={2} /></div>
                            <div className="ds-stat-value">{stats.recovery_rate}%</div>
                            <div className="ds-stat-label">Recovery Rate</div>
                        </div>
                        <div className="ds-stat-card">
                            <div className="ds-stat-icon"><Handshake size={20} strokeWidth={2} /></div>
                            <div className="ds-stat-value">{stats.total_recovered}</div>
                            <div className="ds-stat-label">Items Recovered</div>
                        </div>
                    </div>

                    {stats.average_recovery_days !== null && (
                        <div className="ds-card" style={{ marginTop: 16, marginBottom: 26 }}>
                            <p style={{ margin: 0 }}>
                                Average time from report to release: <strong>{stats.average_recovery_days} day(s)</strong>
                            </p>
                        </div>
                    )}

                    <StatSection
                        icon={PackageSearch}
                        iconClass="is-reports"
                        title="Found Item Reports"
                        desc="Items strangers turned in online, awaiting Security's review before they're accepted into inventory."
                        stats={REPORT_STATS}
                        values={stats.found_reports}
                    />

                    <StatSection
                        icon={Boxes}
                        iconClass="is-counter"
                        title="Counter"
                        desc="Items handed to Security in person by their known owner, released the same way as any claim."
                        stats={COUNTER_STATS}
                        values={stats.counter}
                    />

                    <div className="ds-grid" style={{ marginTop: 4 }}>
                        <div className="ds-card">
                            <div className="ds-card-title ds-card-title-icon"><Users size={18} strokeWidth={2} /> Manage Users</div>
                            <p className="ds-card-desc">Create Instructor, Security Officer, and Admin accounts.</p>
                            <Link to="/admin/users" className="ds-btn ds-btn-primary ds-btn-block">
                                Manage Users
                            </Link>
                        </div>

                        <div className="ds-card">
                            <div className="ds-card-title ds-card-title-icon"><ScrollText size={18} strokeWidth={2} /> Audit Log</div>
                            <p className="ds-card-desc">Review every sensitive action taken across the system.</p>
                            <Link to="/admin/audit-log" className="ds-btn ds-btn-secondary ds-btn-block">
                                View Audit Log
                            </Link>
                        </div>
                    </div>

                    <div className="ds-card">
                        <div className="ds-card-title ds-card-title-icon"><ShieldCheck size={18} strokeWidth={2} /> This page is admin-only</div>
                        <p className="ds-card-desc" style={{ marginBottom: 0 }}>
                            You're signed in as <strong>{user?.email}</strong> with administrator access.
                        </p>
                    </div>
                </>
            )}
        </DashboardShell>
    );
}
