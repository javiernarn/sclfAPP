import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import {
    PackageSearch,
    PackageCheck,
    Hourglass,
    ShieldAlert,
    Boxes,
} from '../../Components/icons';

// Found items arrive through two different channels (see
// FoundItem::CHANNEL_* on the backend), and they're different jobs for a
// Security Officer:
//  - "Found Item Reports" — a stranger turned something in online and it
//    needs review/verification before it's accepted into inventory.
//  - "Counter" — someone handed an item to you in person and you already
//    know whose it is; it's logged and auto-approved on the spot, and
//    later released the same way any claim is.
// These used to be blended into one stat grid ("Found Today", "Items
// Released", etc.) which made it unclear which workflow a given number
// belonged to. They're now two clearly-labeled sections, matching the
// Counter vs. Lost & Found split History already uses.
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

// Layout: the numbers are the point, so the stat grid takes the wide left
// column; the icon/title/description is a compact label sitting to its
// right. (DOM order is grid-then-head — see .ds-dashboard-section-body in
// DashboardShell.css, which also reverses this back to head-on-top on
// phones.)
function StatSection({ icon: SectionIcon, iconClass, title, desc, stats, values, loading }) {
    return (
        <div className="ds-dashboard-section">
            <div className="ds-dashboard-section-body">
                <div className="ds-stat-grid">
                    {loading && [...Array(stats.length)].map((_, i) => (
                        <div key={i} className="ds-stat-card ds-skeleton" style={{ height: 74 }} />
                    ))}
                    {!loading && values && stats.map(([key, label, Icon]) => (
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
            subtitle="Found item reports and counter activity, kept separate so it's clear which is which."
        >
            <StatSection
                icon={PackageSearch}
                iconClass="is-reports"
                title="Found Item Reports"
                desc="Items strangers turned in online — awaiting your review before they're accepted into inventory."
                stats={REPORT_STATS}
                values={stats?.found_reports}
                loading={loading}
            />

            <StatSection
                icon={Boxes}
                iconClass="is-counter"
                title="Counter"
                desc="Items handed to you in person by their known owner, and later released the same way as any claim."
                stats={COUNTER_STATS}
                values={stats?.counter}
                loading={loading}
            />

            <div className="ds-dashboard-section">
                <div className="ds-dashboard-section-body">
                    <div className="ds-stat-grid">
                        {loading && [...Array(2)].map((_, i) => <div key={i} className="ds-stat-card ds-skeleton" style={{ height: 74 }} />)}
                        {!loading && stats && (
                            <>
                                <div className="ds-stat-card">
                                    <div className="ds-stat-icon"><Hourglass size={20} strokeWidth={2} /></div>
                                    <div className="ds-stat-value">{stats.claims_waiting}</div>
                                    <div className="ds-stat-label">Claims Waiting</div>
                                </div>
                                <div className="ds-stat-card">
                                    <div className="ds-stat-icon"><ShieldAlert size={20} strokeWidth={2} /></div>
                                    <div className="ds-stat-value">{stats.suspicious_claims}</div>
                                    <div className="ds-stat-label">Suspicious Claims</div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="ds-dashboard-section-head">
                        <span className="ds-dashboard-section-icon is-reports">
                            <ShieldAlert size={18} strokeWidth={2} />
                        </span>
                        <div>
                            <h2 className="ds-dashboard-section-title">Claims</h2>
                            <p className="ds-dashboard-section-desc">Shared across both channels — a claim can be against a reported item or a counter item.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="ds-card">
                <h3>Quick Actions</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                    <Link to="/app/security/found-items" className="ds-btn ds-btn-primary">Review Found Items</Link>
                    <Link to="/app/security/counter" className="ds-btn ds-btn-secondary">Open Counter</Link>
                    <Link to="/app/security/claims" className="ds-btn ds-btn-secondary">Review Claims</Link>
                    <Link to="/app/security/inventory" className="ds-btn ds-btn-secondary">Manage Inventory</Link>
                    <Link to="/app/security/qr-scanner" className="ds-btn ds-btn-secondary">Scan Release Code</Link>
                </div>
            </div>
        </DashboardShell>
    );
}
