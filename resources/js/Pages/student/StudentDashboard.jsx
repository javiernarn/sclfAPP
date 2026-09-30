import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    ClipboardList, Hourglass, CircleCheck, PackageSearch, Megaphone, Handshake,
    Wrench, ShieldAlert, Activity,
} from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import DashboardSkeleton from '../../Components/shared/DashboardSkeleton';
import {
    KpiCard, ChartCard, AreaChart, DonutChart, LiveBadge, usePolling, humanize, PALETTE,
} from '../../Components/charts';

export default function StudentDashboard() {
    const { user, roles } = useAuth();
    const isInstructor = Array.isArray(roles) && roles.includes('instructor');
    const { data, loading, error, updatedAt } = usePolling('/analytics/me', { interval: 20000 });

    useEffect(() => {
        document.title = "Dashboard | SCLF - Opol Community College";
    }, []);

    if (loading && !data) {
        return (
            <DashboardShell
                eyebrow={isInstructor ? 'Instructor Portal' : 'Student Portal'}
                title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'} 👋`}
                subtitle="Report items you've lost, or check what's been found around campus."
            >
                <DashboardSkeleton statCount={3} cardCount={2} />
            </DashboardShell>
        );
    }

    const kpis = data?.kpis || {};
    const dailySeries = (data?.daily || []).map((d) => d.count);
    const svcByStatus = data?.service_requests_by_status || {};
    const incByStatus = data?.incidents_by_status || {};

    return (
        <DashboardShell
            eyebrow={isInstructor ? 'Instructor Portal' : 'Student Portal'}
            title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'} 👋`}
            subtitle="Report items you've lost, or check what's been found around campus."
        >
            <div className="ch-toolbar">
                <LiveBadge updatedAt={updatedAt} error={error} />
            </div>

            {/* ---- Personal KPIs ---- */}
            <div className="ch-kpi-grid">
                <KpiCard icon={ClipboardList} label="Total Reports" value={kpis.reports} color="var(--ch-1)" series={dailySeries} />
                <KpiCard icon={Hourglass} label="Pending" value={kpis.pending} color="var(--ch-4)" goodWhen="down" />
                <KpiCard icon={CircleCheck} label="Recovered" value={kpis.recovered} color="var(--ch-good)" />
                <KpiCard icon={Handshake} label="Active Claims" value={kpis.active_claims} color="var(--ch-3)" />
            </div>

            {/* ---- Trend + status ---- */}
            <div className="ch-row cols-2-1">
                <ChartCard title="Your Activity" subtitle="Reports and claims you've filed, last 6 months." icon={Activity}>
                    <AreaChart
                        data={data.monthly}
                        xKey="label"
                        series={[
                            { key: 'reports', label: 'Reports', color: 'var(--ch-1)' },
                            { key: 'claims', label: 'Claims', color: 'var(--ch-3)' },
                        ]}
                    />
                </ChartCard>

                <ChartCard title="Report Status" subtitle="What's happened to what you've reported." icon={ClipboardList}>
                    {Object.keys(data.lost_by_status || {}).length ? (
                        <DonutChart
                            centerLabel="Reports"
                            data={Object.entries(data.lost_by_status).map(([k, v], i) => ({ label: humanize(k), value: v, color: PALETTE[i % PALETTE.length] }))}
                        />
                    ) : (
                        <p className="ch-empty">Nothing reported yet</p>
                    )}
                </ChartCard>
            </div>

            {/* ---- Instructor extras: service requests + incidents they've filed ---- */}
            {isInstructor && (svcByStatus && Object.keys(svcByStatus).length > 0 || incByStatus && Object.keys(incByStatus).length > 0) && (
                <div className="ch-row cols-1-1">
                    <ChartCard title="Your Service Requests" subtitle="Facilities/IT requests you've submitted." icon={Wrench}>
                        {Object.keys(svcByStatus).length ? (
                            <DonutChart centerLabel="Requests" size={140} thickness={16}
                                data={Object.entries(svcByStatus).map(([k, v], i) => ({ label: humanize(k), value: v, color: PALETTE[i % PALETTE.length] }))} />
                        ) : <p className="ch-empty">No service requests yet</p>}
                    </ChartCard>
                    <ChartCard title="Your Incident Reports" subtitle="Security incidents you've reported." icon={ShieldAlert}>
                        {Object.keys(incByStatus).length ? (
                            <DonutChart centerLabel="Incidents" size={140} thickness={16}
                                data={Object.entries(incByStatus).map(([k, v], i) => ({ label: humanize(k), value: v, color: PALETTE[(i + 2) % PALETTE.length] }))} />
                        ) : <p className="ch-empty">No incidents reported</p>}
                    </ChartCard>
                </div>
            )}

            {/* ---- Campus-wide headline (no personal data of others exposed) ---- */}
            <div className="ds-card" style={{ marginBottom: 16 }}>
                <div className="ds-card-title ds-card-title-icon"><CircleCheck size={18} strokeWidth={2} /> Campus Recovery Rate</div>
                <p className="ds-card-desc" style={{ marginBottom: 0 }}>
                    <strong>{data.campus?.recovery_rate ?? 0}%</strong> of lost items reported campus-wide have been recovered, with{' '}
                    <strong>{data.campus?.items_on_shelf ?? 0}</strong> unclaimed items currently on the shelf.
                </p>
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
        </DashboardShell>
    );
}
