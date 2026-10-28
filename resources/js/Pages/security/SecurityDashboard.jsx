import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardShell from '../../Components/shared/DashboardShell';
import RefreshButton from '../../Components/shared/RefreshButton';
import WorkflowGuide from '../../Components/shared/WorkflowGuide';
import MobileStaffHome from '../../Components/shared/MobileStaffHome';
import useIsPhone from '../../hooks/useIsPhone';
import {
    PackageSearch, PackageCheck, Hourglass, ShieldAlert, Boxes, ListOrdered,
    Activity, Users,
} from '../../Components/icons';
import {
    KpiCard, ChartCard, AreaChart, DonutChart, RankedBars, ActivityFeed,
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

// "What needs you now" — turns the numbers already on this dashboard into an
// ordered to-do list, most urgent first, so a new officer always knows which
// step of the process to do next. Uses only values the dashboard already loads.
function NextActions({ data, loading }) {
    if (loading || !data) return null;
    const sum = data.summary || {};
    const items = [
        { n: data.queue?.waiting ?? 0, label: 'people waiting at the counter', to: '/app/security/counter-dashboard', cta: 'Open Counter Dashboard' },
        { n: sum.found_reports?.pending_verification ?? 0, label: 'found reports to verify', to: '/app/security/found-items', cta: 'Review Found Items' },
        // QR already generated -> the next step is scanning it at hand-over, not the Claims list.
        { n: sum.release_ready ?? 0, label: 'approved claims ready to hand over (QR generated)', to: '/app/security/qr-scanner', cta: 'Open QR Scanner' },
        { n: sum.claims_waiting ?? 0, label: 'claims waiting for your review', to: '/app/security/claims', cta: 'Review Claims' },
        // Only counter items that still need their release QR generated (done from Claims).
        // Items whose QR already exists are counted in the hand-over row above instead.
        { n: sum.counter?.needs_qr ?? 0, label: 'counter items checked in — generate the release QR', to: '/app/security/claims?status=approved', cta: 'Open Claims' },
    ].filter((i) => i.n > 0);

    return (
        <div className="ds-card">
            <h3 style={{ marginTop: 0 }}>What needs you now</h3>
            {items.length === 0 ? (
                <p className="ds-card-desc" style={{ marginBottom: 0 }}>Nothing is waiting. New work will appear here automatically.</p>
            ) : (
                <ul className="ds-list">
                    {items.map((i) => (
                        <li key={i.label} className="ds-list-item">
                            <div className="ds-list-item-main">
                                <div>
                                    <p className="ds-list-item-title"><strong>{i.n}</strong> {i.label}</p>
                                </div>
                            </div>
                            <Link to={i.to} className="ds-btn ds-btn-primary">{i.cta}</Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Claims whose release QR is already generated, oldest claim first. This is
// the hand-over line: the officer serves #1 first (first come, first served)
// and presses "Open" to see the claim, or uses QR Release Scanner at the counter.
function ReleaseQueue({ queue, loading }) {
    if (loading) return null;
    const list = queue || [];
    const fmtExpiry = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null);
    return (
        <div className="ds-card">
            <h3 style={{ marginTop: 0 }}>Ready for release — serve in this order</h3>
            <p className="ds-card-desc">First come, first served. The oldest claim is at the top; scan its QR to hand the item over.</p>
            {list.length === 0 ? (
                <p className="ds-card-desc" style={{ marginBottom: 0 }}>No claims are waiting for hand-over. Once a release QR is generated, the claim shows up here.</p>
            ) : (
                <ul className="ds-list">
                    {list.map((c) => (
                        <li key={c.id} className="ds-list-item">
                            <div className="ds-list-item-main">
                                <span className="ds-badge ds-badge-claimed" style={{ minWidth: 34, justifyContent: 'center' }}>#{c.position}</span>
                                <div style={{ minWidth: 0 }}>
                                    <p className="ds-list-item-title">
                                        {c.item_name || 'Item'} <span className="ds-list-item-meta">for {c.claimant || 'claimant'}</span>
                                        {c.position === 1 && <span className="ds-badge ds-badge-found" style={{ marginLeft: 8 }}>Serve first</span>}
                                    </p>
                                    <p className="ds-list-item-meta">
                                        {c.public_code ? `${c.public_code}` : 'QR generated'}
                                        {c.location ? ` · ${c.location}` : ''}
                                        {fmtExpiry(c.expires_at) ? ` · QR valid until ${fmtExpiry(c.expires_at)}` : ''}
                                    </p>
                                </div>
                            </div>
                            <Link to={`/app/claims/${c.id}`} className="ds-btn ds-btn-primary ds-btn-sm">Open</Link>
                        </li>
                    ))}
                </ul>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Link to="/app/security/qr-scanner" className="ds-btn ds-btn-primary">QR Release Scanner</Link>
                <Link to="/app/security/claims?status=release_pending" className="ds-btn ds-btn-secondary">See all in queue</Link>
            </div>
        </div>
    );
}

export default function SecurityDashboard() {
    const { user } = useAuth();
    const [days, setDays] = useState(14);
    const { data, loading, error, updatedAt, refresh } = usePolling('/analytics/dashboard', { interval: 12000, params: { days } });

    useEffect(() => {
        document.title = "Security Dashboard | SCLF - Opol Community College";
    }, []);

    const summary = data; // buildDashboard() payload doubles as the summary source for legacy stat cards below
    const kpi = data?.kpis || {};
    const q = data?.queue || {};
    const incidentsBySeverity = data?.incidents_by_severity || {};
    const isPhone = useIsPhone();
    // On phones MobileStaffHome is the one greeting; the desktop greeting block is dropped.
    const shellProps = isPhone
        ? {}
        : {
            eyebrow: 'Security',
            greeting: { name: user?.name },
            subtitle: "Found item reports and counter activity, kept separate so it's clear which is which.",
        };

    return (
        <DashboardShell {...shellProps}>
            {isPhone && (
                <MobileStaffHome
                    name={user?.name}
                    role="Security"
                    actionSub="Counter check-in, scan a QR, log a found item."
                    stats={data ? [
                        { label: 'Waiting', value: q.waiting, icon: ListOrdered },
                        { label: 'To verify', value: summary?.summary?.found_reports?.pending_verification, icon: Hourglass },
                        { label: 'Ready to hand over', value: summary?.summary?.release_ready, icon: PackageCheck },
                        { label: 'Visitors on site', value: data.visitors_on_site, icon: Users },
                    ] : null}
                />
            )}
            <div className="ch-toolbar">
                <LiveBadge updatedAt={updatedAt} error={error} />
                <div className="ch-toolbar-actions">
                    <RefreshButton onRefresh={refresh} loading={loading} />
                    <Segmented value={days} options={RANGE_OPTIONS} onChange={setDays} label="Date range" />
                </div>
            </div>

            <NextActions data={data} loading={loading} />

            <ReleaseQueue queue={data?.release_queue} loading={loading} />

            <WorkflowGuide lane="counter" defaultOpen={false} />

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
                        <KpiCard icon={PackageCheck} label="Found Reports" value={kpi.found?.value} prev={kpi.found?.prev} series={kpi.found?.series} color="var(--ch-2)" hint={`online, last ${days} days`} />
                        <KpiCard icon={Boxes} label="Claims Filed" value={kpi.claims?.value} prev={kpi.claims?.prev} series={kpi.claims?.series} color="var(--ch-3)" hint={`last ${days} days`} />
                    </div>

                    {/* ---- Trend + incidents ---- */}
                    <div className="ch-row cols-2-1">
                        <ChartCard
                            title="Intake Trend"
                            subtitle="Lost reports, online found reports and counter check-ins, day by day."
                            icon={Activity}
                            legend={[
                                { key: 'lost', label: 'Lost', color: 'var(--ch-1)' },
                                { key: 'found', label: 'Found', color: 'var(--ch-2)' },
                                { key: 'counter', label: 'Counter', color: 'var(--ch-4)' },
                            ]}
                        >
                            <AreaChart
                                data={data.trend}
                                xKey="label"
                                series={[
                                    { key: 'lost', label: 'Lost', color: 'var(--ch-1)' },
                                    { key: 'found', label: 'Found', color: 'var(--ch-2)' },
                                    { key: 'counter', label: 'Counter', color: 'var(--ch-4)' },
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
        </DashboardShell>
    );
}
