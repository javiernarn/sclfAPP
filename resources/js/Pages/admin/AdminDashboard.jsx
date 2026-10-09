import { welcomeHeading } from '../../utils/welcome';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import useRoleLabel from '../../hooks/useRoleLabel';
import { Link } from 'react-router-dom';
import {
    ClipboardList, Handshake, Users, ShieldCheck, ScrollText,
    PackageSearch, CircleCheck, ShieldAlert, ListOrdered, Activity, Clock,
} from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import DashboardSkeleton from '../../Components/shared/DashboardSkeleton';
import {
    KpiCard, ChartCard, AreaChart, DonutChart, BarChart, RankedBars, ActivityFeed,
    LiveBadge, Segmented, usePolling, humanize, PALETTE,
} from '../../Components/charts';

const RANGE_OPTIONS = [
    { value: 7, label: '7d' },
    { value: 14, label: '14d' },
    { value: 30, label: '30d' },
];

export default function AdminDashboard() {
    const { user } = useAuth();
    const { isStaff, label: roleLabel } = useRoleLabel();
    const [days, setDays] = useState(14);
    const { data, loading, error, updatedAt, refresh } = usePolling('/analytics/dashboard', { interval: 15000, params: { days } });

    useEffect(() => {
        document.title = "Admin Dashboard | SCLF - Opol Community College";
    }, []);

    if (loading && !data) {
        return (
            <DashboardShell eyebrow={`${roleLabel || 'Admin'} Portal`} title={`${welcomeHeading(user?.name?.split(' ')[0] || roleLabel || 'Admin')} 👋`} subtitle="Oversee lost & found reports across Opol Community College.">
                <DashboardSkeleton statCount={4} cardCount={2} />
            </DashboardShell>
        );
    }

    const kpi = data?.kpis || {};
    const claimsByStatus = data?.claims_by_status || {};
    const usersByRole = data?.users_by_role || {};
    const q = data?.queue || {};

    return (
        <DashboardShell onRefresh={refresh}
            eyebrow={`${roleLabel || 'Admin'} Portal`}
            title={`${welcomeHeading(user?.name?.split(' ')[0] || roleLabel || 'Admin')} 👋`}
            subtitle="Oversee lost & found reports across Opol Community College."
        >
            <div className="ch-toolbar">
                <LiveBadge updatedAt={updatedAt} error={error} />
                <Segmented value={days} options={RANGE_OPTIONS} onChange={setDays} label="Date range" />
            </div>

            {/* ---- Headline KPIs ---- */}
            <div className="ch-kpi-grid">
                <KpiCard icon={ClipboardList} label="Lost Reports" value={kpi.lost?.value} prev={kpi.lost?.prev} series={kpi.lost?.series} color="var(--ch-1)" hint={`last ${days} days`} />
                <KpiCard icon={PackageSearch} label="Found Reports" value={kpi.found?.value} prev={kpi.found?.prev} series={kpi.found?.series} color="var(--ch-2)" hint={`online, last ${days} days`} />
                <KpiCard icon={Handshake} label="Claims Filed" value={kpi.claims?.value} prev={kpi.claims?.prev} series={kpi.claims?.series} color="var(--ch-3)" hint={`last ${days} days`} />
                <KpiCard icon={CircleCheck} label="Items Recovered" value={kpi.recovered?.value} prev={kpi.recovered?.prev} series={kpi.recovered?.series} color="var(--ch-good)" hint={`last ${days} days`} />
            </div>

            {/* ---- Trend + status split ---- */}
            <div className="ch-row cols-2-1">
                <ChartCard
                    title="Activity Trend"
                    subtitle="Lost reports, online found reports, counter check-ins and claims filed, day by day."
                    icon={Activity}
                    legend={[
                        { key: 'lost', label: 'Lost', color: 'var(--ch-1)' },
                        { key: 'found', label: 'Found', color: 'var(--ch-2)' },
                        { key: 'counter', label: 'Counter', color: 'var(--ch-4)' },
                        { key: 'claims', label: 'Claims', color: 'var(--ch-3)' },
                    ]}
                >
                    <AreaChart
                        data={data.trend}
                        xKey="label"
                        series={[
                            { key: 'lost', label: 'Lost', color: 'var(--ch-1)' },
                            { key: 'found', label: 'Found', color: 'var(--ch-2)' },
                            { key: 'counter', label: 'Counter', color: 'var(--ch-4)' },
                            { key: 'claims', label: 'Claims', color: 'var(--ch-3)' },
                        ]}
                    />
                </ChartCard>

                <ChartCard title="Claims by Status" subtitle="Where every claim currently sits." icon={Handshake}>
                    <DonutChart
                        centerLabel="Claims"
                        data={Object.entries(claimsByStatus).map(([k, v], i) => ({ label: humanize(k), value: v, color: PALETTE[i % PALETTE.length] }))}
                    />
                </ChartCard>
            </div>

            {/* ---- Categories / locations / peak hours ---- */}
            <div className="ch-row cols-3">
                <ChartCard title="Top Categories" subtitle="Most-reported lost item types." icon={ClipboardList}>
                    <RankedBars items={(data.categories || []).map((c) => ({ label: c.category, value: c.total }))} />
                </ChartCard>
                <ChartCard title="High-Risk Locations" subtitle="Where items go missing most." icon={ShieldAlert}>
                    <RankedBars items={(data.locations || []).map((c) => ({ label: c.location_lost, value: c.total }))} color={2} />
                </ChartCard>
                <ChartCard title="Peak Reporting Hours" subtitle="When lost reports are filed, 24h." icon={Clock}>
                    <BarChart
                        height={210}
                        data={(data.peak_hours || []).map((total, h) => ({ hour: h, total }))}
                        xKey="hour"
                        series={[{ key: 'total', label: 'Reports', color: 'var(--ch-4)' }]}
                        highlightMax
                        labelEvery={4}
                        formatX={(h) => `${h}h`}
                    />
                </ChartCard>
            </div>

            {/* ---- Live ops: activity + queue + users ---- */}
            <div className="ch-row cols-2-1">
                <ChartCard title="Live Campus Activity" subtitle="Freshest reports, found items and claims across campus." icon={Activity}>
                    <ActivityFeed items={data.recent_activity} />
                </ChartCard>

                <div style={{ display: 'grid', gap: 16 }}>
                    <ChartCard title="Counter Queue" subtitle="Right now, across all counters." icon={ListOrdered}>
                        <div className="ch-meter-grid">
                            <div className="ch-meter"><b>{q.waiting ?? 0}</b><span>Waiting</span></div>
                            <div className="ch-meter"><b>{q.serving ?? 0}</b><span>Serving</span></div>
                            <div className="ch-meter"><b>{q.completed_today ?? 0}</b><span>Done today</span></div>
                            <div className="ch-meter"><b>{q.avg_wait_minutes ?? '—'}{q.avg_wait_minutes != null ? 'm' : ''}</b><span>Avg wait</span></div>
                        </div>
                    </ChartCard>

                    {usersByRole && Object.keys(usersByRole).length > 0 && (
                        <ChartCard title="Users by Role" icon={Users}>
                            <DonutChart size={140} thickness={16} centerLabel="Users" data={Object.entries(usersByRole).map(([k, v], i) => ({ label: humanize(k), value: v, color: PALETTE[i % PALETTE.length] }))} />
                        </ChartCard>
                    )}
                </div>
            </div>

            {/* ---- Quick actions ---- */}
            <div className="ds-grid" style={{ marginTop: 4 }}>
                <div className="ds-card">
                    <div className="ds-card-title ds-card-title-icon"><Users size={18} strokeWidth={2} /> Manage Users</div>
                    <p className="ds-card-desc">Create Instructor, Security Officer, and Staff accounts.</p>
                    <Link to="/app/admin/users" className="ds-btn ds-btn-primary ds-btn-block">
                        Manage Users
                    </Link>
                </div>

                <div className="ds-card">
                    <div className="ds-card-title ds-card-title-icon"><ScrollText size={18} strokeWidth={2} /> Audit Log</div>
                    <p className="ds-card-desc">Review every sensitive action taken across the system.</p>
                    <Link to="/app/admin/audit-log" className="ds-btn ds-btn-secondary ds-btn-block">
                        View Audit Log
                    </Link>
                </div>
            </div>

            <div className="ds-card">
                <div className="ds-card-title ds-card-title-icon"><ShieldCheck size={18} strokeWidth={2} /> {isStaff ? 'This page is for Admin and Staff' : 'This page is admin-only'}</div>
                <p className="ds-card-desc" style={{ marginBottom: 0 }}>
                    You're signed in as <strong>{user?.email}</strong> {isStaff ? 'with staff access — you can view everything, but changes need the admin\'s approval.' : 'with administrator access.'}
                </p>
            </div>
        </DashboardShell>
    );
}
