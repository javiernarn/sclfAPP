import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import {
    PackageSearch, PackageCheck, Hourglass, ShieldAlert, Boxes, ListOrdered,
    Activity, Users,
} from '../../Components/icons';
import {
    KpiCard, ChartCard, AreaChart, DonutChart, BarChart, RankedBars, ActivityFeed,
    LiveBadge, Segmented, usePolling, humanize, PALETTE,
} from '../../Components/charts';

// Same channel split Security's dashboard uses (see FoundItem::CHANNEL_* on
// the backend) — items reported online by strangers vs. items handed over
// in person at the Counter by a known owner. Keeping the two apart here
// too so a Security Officer glancing at this page isn't left wondering
// whether a given number is about online reports or counter check-ins.
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

const RANGE_OPTIONS = [
    { value: 7, label: '7d' },
    { value: 14, label: '14d' },
    { value: 30, label: '30d' },
];

// Layout: stat grid takes the wide left column, the icon/title/description
// label sits to its right in a compact column (see
// .ds-dashboard-section-body in DashboardShell.css).
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
    const [days, setDays] = useState(14);
    const { data, loading, error, updatedAt } = usePolling('/analytics/dashboard', { interval: 12000, params: { days } });

    useEffect(() => {
        document.title = "Security Dashboard | SCLF - Opol Community College";
    }, []);

    const summary = data; // buildDashboard() payload doubles as the summary source for legacy stat cards below
    const kpi = data?.kpis || {};
    const q = data?.queue || {};
    const incidentsBySeverity = data?.incidents_by_severity || {};

    return (
        <DashboardShell
            eyebrow="Security"
            title="Security Officer Dashboard"
            subtitle="Found item reports and counter activity, kept separate so it's clear which is which."
        >
            <div className="ch-toolbar">
                <LiveBadge updatedAt={updatedAt} error={error} />
                <Segmented value={days} options={RANGE_OPTIONS} onChange={setDays} label="Date range" />
            </div>

            {/* ---- Live counter queue — the thing an officer checks first ---- */}
            <ChartCard title="Counter Queue — Live" subtitle="Refreshes automatically every few seconds." icon={ListOrdered}>
                <div className="ch-meter-grid">
                    <div className="ch-meter"><b>{q.waiting ?? 0}</b><span>Waiting</span></div>
                    <div className="ch-meter"><b>{q.called ?? 0}</b><span>Called</span></div>
                    <div className="ch-meter"><b>{q.serving ?? 0}</b><span>Serving</span></div>
                    <div className="ch-meter"><b>{q.completed_today ?? 0}</b><span>Done today</span></div>
                    <div className="ch-meter"><b>{q.no_show_today ?? 0}</b><span>No-shows</span></div>
                    <div className="ch-meter"><b>{q.avg_wait_minutes ?? '—'}{q.avg_wait_minutes != null ? 'm' : ''}</b><span>Avg wait</span></div>
                </div>
            </ChartCard>

            <StatSection
                icon={PackageSearch}
                iconClass="is-reports"
                title="Found Item Reports"
                desc="Items strangers turned in online — awaiting your review before they're accepted into inventory."
                stats={REPORT_STATS}
                values={summary?.summary?.found_reports}
                loading={loading}
            />

            <StatSection
                icon={Boxes}
                iconClass="is-counter"
                title="Counter"
                desc="Items handed to you in person by their known owner, and later released the same way as any claim."
                stats={COUNTER_STATS}
                values={summary?.summary?.counter}
                loading={loading}
            />

            {!loading && data && (
                <>
                    {/* ---- KPIs ---- */}
                    <div className="ch-kpi-grid">
                        <KpiCard icon={Hourglass} label="Claims Waiting" value={summary.summary?.claims_waiting} color="var(--ch-4)" goodWhen="down" />
                        <KpiCard icon={ShieldAlert} label="Suspicious Claims" value={summary.summary?.suspicious_claims} color="var(--ch-bad)" goodWhen="down" />
                        <KpiCard icon={PackageCheck} label="Found Items" value={kpi.found?.value} prev={kpi.found?.prev} series={kpi.found?.series} color="var(--ch-2)" hint={`last ${days} days`} />
                        <KpiCard icon={Boxes} label="Claims Filed" value={kpi.claims?.value} prev={kpi.claims?.prev} series={kpi.claims?.series} color="var(--ch-3)" hint={`last ${days} days`} />
                    </div>

                    {/* ---- Trend + incidents ---- */}
                    <div className="ch-row cols-2-1">
                        <ChartCard
                            title="Intake Trend"
                            subtitle="Lost reports vs. found items, day by day."
                            icon={Activity}
                            legend={[
                                { key: 'lost', label: 'Lost', color: 'var(--ch-1)' },
                                { key: 'found', label: 'Found', color: 'var(--ch-2)' },
                            ]}
                        >
                            <AreaChart
                                data={data.trend}
                                xKey="label"
                                series={[
                                    { key: 'lost', label: 'Lost', color: 'var(--ch-1)' },
                                    { key: 'found', label: 'Found', color: 'var(--ch-2)' },
                                ]}
                            />
                        </ChartCard>

                        <ChartCard title="Open Incidents by Severity" subtitle="Security incidents not yet closed." icon={ShieldAlert}>
                            {Object.keys(incidentsBySeverity).length ? (
                                <DonutChart
                                    centerLabel="Open"
                                    data={Object.entries(incidentsBySeverity).map(([k, v], i) => ({ label: humanize(k), value: v, color: PALETTE[(i + 3) % PALETTE.length] }))}
                                />
                            ) : (
                                <p className="ch-empty">No open incidents 🎉</p>
                            )}
                        </ChartCard>
                    </div>

                    {/* ---- Categories / locations / visitors ---- */}
                    <div className="ch-row cols-3">
                        <ChartCard title="Top Categories" subtitle="Most-reported lost item types." icon={PackageSearch}>
                            <RankedBars items={(data.categories || []).map((c) => ({ label: c.category, value: c.total }))} />
                        </ChartCard>
                        <ChartCard title="High-Risk Locations" subtitle="Where items go missing most." icon={ShieldAlert}>
                            <RankedBars items={(data.locations || []).map((c) => ({ label: c.location_lost, value: c.total }))} color={2} />
                        </ChartCard>
                        <ChartCard title="On Campus" subtitle="Visitors currently checked in." icon={Users}>
                            <div className="ch-donut" style={{ paddingTop: 18 }}>
                                <div className="ds-stat-value" style={{ fontSize: 40 }}>{data.visitors_on_site ?? 0}</div>
                            </div>
                            <p className="ch-empty" style={{ marginTop: 0 }}>Currently checked in</p>
                        </ChartCard>
                    </div>

                    <ChartCard title="Live Activity" subtitle="Freshest reports, found items and claims." icon={Activity}>
                        <ActivityFeed items={data.recent_activity} />
                    </ChartCard>
                </>
            )}

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
