import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import useRoleLabel from '../../hooks/useRoleLabel';
import logo from '../../assets/images/site-logo.png';
import { ArrowLeft, Printer, Camera } from '../../Components/icons';
import { AreaChart, DonutChart, BarChart, RankedBars, PALETTE, humanize, fmt } from '../../Components/charts';
import { Section, Card, Tiles, PhotoBox } from '../../Components/shared/PrintParts';
import StudentQrScanModal from '../../Components/shared/StudentQrScanModal';
import './PrintReport.css';

// Print-only report for the Admin/Staff and Security dashboards.
//
// Opened from the SCLF · Opol Community College logo menu in the shell
// (see DashboardShell). It is a standalone page — no sidebar/top bar — that
// loads ONE snapshot of the same /analytics/dashboard payload the dashboards
// use, lays it out on an A4 sheet, and hands it to the browser's print
// dialog ("Save as PDF" works from there). Nothing is written to the
// database and no PDF library is involved.

const RANGES = [7, 14, 30];

const TYPE_LABEL = {
    lost: 'Lost report',
    found: 'Found report',
    counter: 'Counter check-in',
    claim: 'Claim filed',
};

const h12 = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'AM' : 'PM'}`;
const hourRange = (h) => `${h12(h)}–${h12((h + 1) % 24)}`;
const dateText = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function PrintReport() {
    const { pathname } = useLocation();
    const kind = pathname.includes('/admin/') ? 'admin' : 'security';
    const { user } = useAuth();
    const { isStaff } = useRoleLabel();

    const [days, setDays] = useState(14);
    const [orientation, setOrientation] = useState('landscape');
    const [showDaily, setShowDaily] = useState(true);
    const [showActivity, setShowActivity] = useState(true);
    const [showNotedBy, setShowNotedBy] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [scanOpen, setScanOpen] = useState(false);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [generatedAt, setGeneratedAt] = useState(() => new Date());
    const [attempt, setAttempt] = useState(0);

    const homePath = kind === 'admin' ? '/app/admin/dashboard' : '/app/security/dashboard';
    const roleTitle = kind === 'admin' ? (isStaff ? 'Staff' : 'Administrator') : 'Security Officer';
    const reportName = kind === 'admin' ? 'Admin Dashboard Report' : 'Security Dashboard Report';
    const printedBy = user?.name || user?.email || roleTitle;

    // One snapshot per range change (no polling): a printout must not change
    // under the officer's hands while the print dialog is open.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);
        axios.get('/analytics/dashboard', { params: { days }, silent: true })
            .then((res) => {
                if (cancelled) return;
                setData(res.data);
                setGeneratedAt(new Date());
            })
            .catch(() => { if (!cancelled) setError(true); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [days, attempt]);

    // Browsers use document.title as the default file name when saving as PDF.
    useEffect(() => {
        const prev = document.title;
        const stamp = new Date().toISOString().slice(0, 10);
        document.title = `SCLF-${kind === 'admin' ? 'Admin' : 'Security'}-Report-${stamp}`;
        return () => { document.title = prev; };
    }, [kind]);

    const kpi = data?.kpis || {};
    const trend = data?.trend || [];
    const claimsByStatus = data?.claims_by_status || {};
    const usersByRole = data?.users_by_role || {};
    const incidents = data?.incidents_by_severity || {};
    const q = data?.queue || {};
    const sum = data?.summary || {};
    const hours = data?.peak_hours || [];
    const activity = data?.recent_activity || [];

    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    const periodText = `${dateText(from)} – ${dateText(new Date())}`;

    const claimEntries = Object.entries(claimsByStatus);
    const claimsTotal = claimEntries.reduce((a, [, v]) => a + (Number(v) || 0), 0);
    const maxHour = Math.max(0, ...hours);
    const peakHour = maxHour > 0 ? hours.indexOf(maxHour) : null;
    const topHours = hours
        .map((total, h) => ({ h, total }))
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    const dailyTotals = trend.reduce((acc, r) => ({
        lost: acc.lost + (r.lost || 0),
        found: acc.found + (r.found || 0),
        counter: acc.counter + (r.counter || 0),
        claims: acc.claims + (r.claims || 0),
    }), { lost: 0, found: 0, counter: 0, claims: 0 });

    // ---- "Highlights": plain-language reading of the numbers (admin) ----
    const highlights = [];
    if (data && kind === 'admin') {
        highlights.push(`In the last ${days} days, ${fmt(kpi.lost?.value)} lost reports, ${fmt(kpi.found?.value)} online found reports and ${fmt(kpi.counter?.value)} counter check-ins were recorded.`);
        highlights.push(`${fmt(kpi.claims?.value)} claims were filed and ${fmt(kpi.recovered?.value)} items were recovered (lost reports closed) in the same period.`);
        if (data.categories?.[0]) highlights.push(`Most-reported category: ${humanize(data.categories[0].category)} (${fmt(data.categories[0].total)} reports).`);
        if (data.locations?.[0]) highlights.push(`Highest-risk location: ${data.locations[0].location_lost} (${fmt(data.locations[0].total)} reports).`);
        if (peakHour !== null) highlights.push(`Reports are filed most between ${hourRange(peakHour)} (${fmt(maxHour)} reports).`);
        if (q.avg_wait_minutes != null) highlights.push(`Average counter wait today: ${q.avg_wait_minutes} minutes, with ${fmt(q.completed_today)} people served.`);
        if (sum.total_lost) highlights.push(`Overall, ${fmt(sum.total_recovered)} of ${fmt(sum.total_lost)} lost items have been recovered (${sum.recovery_rate}%).`);
    }

    // ---- Tiles ----
    const periodTiles = kind === 'admin'
        ? [
            { label: 'Lost reports', raw: kpi.lost?.value, prev: kpi.lost?.prev },
            { label: 'Found reports (online)', raw: kpi.found?.value, prev: kpi.found?.prev },
            { label: 'Counter check-ins', raw: kpi.counter?.value, prev: kpi.counter?.prev },
            { label: 'Claims filed', raw: kpi.claims?.value, prev: kpi.claims?.prev },
            { label: 'Items recovered', raw: kpi.recovered?.value, prev: kpi.recovered?.prev },
        ]
        : [
            { label: 'Found reports (online)', raw: kpi.found?.value, prev: kpi.found?.prev },
            { label: 'Counter check-ins', raw: kpi.counter?.value, prev: kpi.counter?.prev },
            { label: 'Claims filed', raw: kpi.claims?.value, prev: kpi.claims?.prev },
            { label: 'Items recovered', raw: kpi.recovered?.value, prev: kpi.recovered?.prev },
        ];
    periodTiles.forEach((t) => { t.value = fmt(t.raw); });

    const overallTiles = [
        { label: 'Total lost reports', value: fmt(sum.total_lost) },
        { label: 'Total found reports', value: fmt(sum.total_found) },
        { label: 'Total recovered', value: fmt(sum.total_recovered) },
        { label: 'Recovery rate', value: `${sum.recovery_rate ?? 0}%` },
        { label: 'Avg. days to recover', value: sum.average_recovery_days != null ? fmt(sum.average_recovery_days, 1) : '—' },
    ];

    const attentionTiles = [
        { label: 'Waiting at counter', value: fmt(q.waiting) },
        { label: 'Found reports to verify', value: fmt(sum.found_reports?.pending_verification) },
        { label: 'Claims waiting review', value: fmt(sum.claims_waiting) },
        { label: 'Counter items to release', value: fmt(sum.counter?.awaiting_release) },
        { label: 'Suspicious claims', value: fmt(sum.suspicious_claims) },
        { label: 'Visitors on campus', value: fmt(data?.visitors_on_site) },
    ];

    const trendSeries = kind === 'admin'
        ? [
            { key: 'lost', label: 'Lost', color: 'var(--ch-1)' },
            { key: 'found', label: 'Found', color: 'var(--ch-2)' },
            { key: 'counter', label: 'Counter', color: 'var(--ch-4)' },
            { key: 'claims', label: 'Claims', color: 'var(--ch-3)' },
        ]
        : [
            { key: 'lost', label: 'Lost', color: 'var(--ch-1)' },
            { key: 'found', label: 'Found', color: 'var(--ch-2)' },
            { key: 'counter', label: 'Counter', color: 'var(--ch-4)' },
        ];

    const chartHeight = orientation === 'landscape' ? 220 : 210;
    const ready = !!data && !loading && !error;

    return (
        <div className="pr-root">
            {/* Page size for the print dialog. Two separate rules so a browser
                that doesn't understand the footer margin boxes still applies
                the size/margins. */}
            <style>{`
                @page { size: A4 ${orientation}; margin: 17mm 10mm 14mm; }
                @page { @bottom-left { content: "SCLF — Opol Community College · Confidential"; font-size: 8pt; color: #6b7280; }
                        @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #6b7280; } }
            `}</style>

            {/* ===== Toolbar — screen only ===== */}
            <div className="pr-toolbar">
                <div className="pr-toolbar-row">
                    <Link to={homePath} className="pr-back"><ArrowLeft size={16} /> Back to dashboard</Link>
                    <strong className="pr-toolbar-title">{reportName}</strong>
                    {/* Only Admin and Staff scan student QR codes; the Security page has no scan button. */}
                    {kind === 'admin' && (
                        <button type="button" className="pr-scan-btn" onClick={() => setScanOpen(true)}>
                            <Camera size={16} /> Scan student QR
                        </button>
                    )}
                    <button type="button" className="pr-print-btn" onClick={() => window.print()} disabled={!ready}>
                        <Printer size={16} /> Print / Save as PDF
                    </button>
                </div>
                <div className="pr-toolbar-row">
                    <div className="pr-field">
                        <span>Period</span>
                        <div className="pr-seg" role="group" aria-label="Report period">
                            {RANGES.map((r) => (
                                <button key={r} type="button" className={days === r ? 'is-active' : ''} onClick={() => setDays(r)}>{r} days</button>
                            ))}
                        </div>
                    </div>
                    <div className="pr-field">
                        <span>Paper</span>
                        <div className="pr-seg" role="group" aria-label="Orientation">
                            <button type="button" className={orientation === 'landscape' ? 'is-active' : ''} onClick={() => setOrientation('landscape')}>A4 Landscape (broad)</button>
                            <button type="button" className={orientation === 'portrait' ? 'is-active' : ''} onClick={() => setOrientation('portrait')}>A4 Portrait</button>
                        </div>
                    </div>
                    <label className="pr-check"><input type="checkbox" checked={showDaily} onChange={(e) => setShowDaily(e.target.checked)} /> Daily table</label>
                    <label className="pr-check"><input type="checkbox" checked={showActivity} onChange={(e) => setShowActivity(e.target.checked)} /> Recent activity</label>
                    <label className="pr-check"><input type="checkbox" checked={showNotedBy} onChange={(e) => setShowNotedBy(e.target.checked)} /> “Noted by” line</label>
                </div>
                <div className="pr-toolbar-row">
                    <label className="pr-remarks">
                        <span>Remarks (printed on the report — optional)</span>
                        <textarea rows={2} maxLength={600} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Reviewed for the monthly meeting. Follow up on the canteen cases." />
                    </label>
                    <p className="pr-tip">Tip: in the print window choose <b>Save as PDF</b>. If colors look pale, turn on <b>Background graphics</b>.</p>
                </div>
            </div>

            {kind === 'admin' && <StudentQrScanModal open={scanOpen} onClose={() => setScanOpen(false)} />}

            {/* ===== The sheet ===== */}
            <div className="pr-stage">
                <div className={`pr-paper pr-${orientation}`}>
                    {kind === 'admin' ? (
                    <header className="pr-head">
                        <div className="pr-head-brand">
                            <img src={logo} alt="Opol Community College logo" className="pr-logo" />
                            <div>
                                <div className="pr-college">Opol Community College</div>
                                <div className="pr-sys">Smart Campus Lost &amp; Found (SCLF)</div>
                                <h1 className="pr-title">{reportName}</h1>
                            </div>
                        </div>
                        <dl className="pr-meta">
                            <div><dt>Period</dt><dd>{periodText} ({days} days)</dd></div>
                            <div><dt>Generated</dt><dd>{generatedAt.toLocaleString()}</dd></div>
                            <div><dt>Prepared by</dt><dd>{printedBy} · {roleTitle}</dd></div>
                        </dl>
                    </header>
                    ) : (
                        /* Security: details fill the space beside the 2x2 photo (admin and staff have no photo). */
                        <header className="pr-head pr-head-student">
                            <div className="pr-head-main">
                                <div className="pr-head-brand">
                                    <img src={logo} alt="Opol Community College logo" className="pr-logo" />
                                    <div>
                                        <div className="pr-college">Opol Community College</div>
                                        <div className="pr-sys">Smart Campus Lost &amp; Found (SCLF)</div>
                                        <h1 className="pr-title">{reportName}</h1>
                                    </div>
                                </div>
                                <div className="pr-idcard">
                                    <div className="pr-idcard-name">{printedBy}</div>
                                    <dl className="pr-idcard-grid">
                                        <div><dt>Role</dt><dd>{roleTitle}</dd></div>
                                        <div><dt>Generated</dt><dd>{generatedAt.toLocaleString()}</dd></div>
                                        <div className="pr-idcard-span"><dt>Period</dt><dd>{periodText} ({days} days)</dd></div>
                                    </dl>
                                </div>
                            </div>
                            <PhotoBox src={user?.profile_picture_url} name={user?.name} />
                        </header>
                    )}

                    {loading && !data && <p className="pr-state">Preparing report…</p>}
                    {error && (
                        <p className="pr-state">
                            Could not load the report data.{' '}
                            <button type="button" className="pr-link" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
                        </p>
                    )}

                    {data && (
                        <>
                            {kind === 'admin' && highlights.length > 0 && (
                                <Section title="Summary of highlights">
                                    <ul className="pr-highlights">
                                        {highlights.map((h) => <li key={h}>{h}</li>)}
                                    </ul>
                                </Section>
                            )}

                            {kind === 'security' && (
                                <Section title="What needs attention (at time of printing)">
                                    <Tiles items={attentionTiles} days={days} />
                                </Section>
                            )}

                            <Section title={`Activity in the last ${days} days`}>
                                <Tiles items={periodTiles} days={days} />
                            </Section>

                            {kind === 'admin' && (
                                <Section title="Overall (all time)">
                                    <Tiles items={overallTiles} days={days} />
                                </Section>
                            )}

                            <div className="pr-row pr-row-2-1">
                                <Card title={kind === 'admin' ? 'Activity Trend' : 'Intake Trend'} subtitle="Day by day for the selected period.">
                                    <div className="pr-legend">
                                        {trendSeries.map((s) => (
                                            <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
                                        ))}
                                    </div>
                                    <AreaChart data={trend} xKey="label" series={trendSeries} height={chartHeight} live={false} />
                                </Card>

                                {kind === 'admin' ? (
                                    <Card title="Claims by Status" subtitle="Where every claim currently sits.">
                                        <DonutChart
                                            size={150}
                                            thickness={18}
                                            centerLabel="Claims"
                                            data={claimEntries.map(([k, v], i) => ({ label: humanize(k), value: v, color: PALETTE[i % PALETTE.length] }))}
                                        />
                                    </Card>
                                ) : (
                                    <Card title="Open Incidents by Severity" subtitle="Security incidents not yet closed.">
                                        {Object.keys(incidents).length ? (
                                            <DonutChart
                                                size={150}
                                                thickness={18}
                                                centerLabel="Open"
                                                data={Object.entries(incidents).map(([k, v], i) => ({ label: humanize(k), value: v, color: PALETTE[(i + 3) % PALETTE.length] }))}
                                            />
                                        ) : <p className="pr-empty">No open incidents.</p>}
                                    </Card>
                                )}
                            </div>

                            <div className="pr-row pr-row-3">
                                <Card title="Top Categories" subtitle="Most-reported lost item types.">
                                    <RankedBars items={(data.categories || []).map((c) => ({ label: c.category, value: c.total }))} />
                                </Card>
                                <Card title="High-Risk Locations" subtitle="Where items go missing most.">
                                    <RankedBars items={(data.locations || []).map((c) => ({ label: c.location_lost, value: c.total }))} color={2} />
                                </Card>
                                <Card title="Peak Reporting Hours" subtitle="When lost reports are filed (24h).">
                                    <BarChart
                                        height={200}
                                        data={hours.map((total, h) => ({ hour: h, total }))}
                                        xKey="hour"
                                        series={[{ key: 'total', label: 'Reports', color: 'var(--ch-4)' }]}
                                        highlightMax
                                        labelEvery={4}
                                        formatX={(h) => `${h}h`}
                                    />
                                </Card>
                            </div>

                            <div className="pr-row pr-row-tables">
                                <Card title="Counter Queue" subtitle="Today, across all counters.">
                                    <div className="pr-meters">
                                        <div><b>{fmt(q.waiting)}</b><span>Waiting</span></div>
                                        <div><b>{fmt(q.serving)}</b><span>Serving</span></div>
                                        <div><b>{fmt(q.completed_today)}</b><span>Done today</span></div>
                                        <div><b>{q.avg_wait_minutes != null ? `${q.avg_wait_minutes}m` : '—'}</b><span>Avg wait</span></div>
                                    </div>
                                </Card>

                                <Card title="Claims by Status (numbers)" subtitle={`${fmt(claimsTotal)} claims on record.`}>
                                    {claimEntries.length ? (
                                        <table className="pr-table">
                                            <thead><tr><th>Status</th><th className="num">Claims</th><th className="num">Share</th></tr></thead>
                                            <tbody>
                                                {claimEntries.map(([k, v]) => (
                                                    <tr key={k}><td>{humanize(k)}</td><td className="num">{fmt(v)}</td><td className="num">{claimsTotal ? Math.round((v / claimsTotal) * 100) : 0}%</td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : <p className="pr-empty">No claims yet.</p>}
                                </Card>

                                {kind === 'admin' ? (
                                    <Card title="Users by Role" subtitle="Accounts in the system.">
                                        <table className="pr-table">
                                            <thead><tr><th>Role</th><th className="num">Accounts</th></tr></thead>
                                            <tbody>
                                                {Object.entries(usersByRole).map(([k, v]) => (
                                                    <tr key={k}><td>{humanize(k)}</td><td className="num">{fmt(v)}</td></tr>
                                                ))}
                                                <tr className="pr-total"><td>Total</td><td className="num">{fmt(Object.values(usersByRole).reduce((a, b) => a + (Number(b) || 0), 0))}</td></tr>
                                            </tbody>
                                        </table>
                                    </Card>
                                ) : (
                                    <Card title="Counter & Found Reports" subtitle="Two separate channels.">
                                        <table className="pr-table">
                                            <tbody>
                                                <tr><td>Found reports today</td><td className="num">{fmt(sum.found_reports?.today)}</td></tr>
                                                <tr><td>Found reports released</td><td className="num">{fmt(sum.found_reports?.released)}</td></tr>
                                                <tr><td>Counter check-ins today</td><td className="num">{fmt(sum.counter?.checked_in_today)}</td></tr>
                                                <tr><td>Counter items released</td><td className="num">{fmt(sum.counter?.released)}</td></tr>
                                            </tbody>
                                        </table>
                                    </Card>
                                )}
                            </div>

                            {topHours.length > 0 && (
                                <Section title="Busiest reporting hours">
                                    <table className="pr-table pr-table-compact">
                                        <thead><tr><th>Rank</th><th>Time</th><th className="num">Lost reports</th></tr></thead>
                                        <tbody>
                                            {topHours.map((x, i) => (
                                                <tr key={x.h}><td>{i + 1}</td><td>{hourRange(x.h)}</td><td className="num">{fmt(x.total)}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Section>
                            )}

                            {showDaily && trend.length > 0 && (
                                <Section title="Daily breakdown">
                                    <table className="pr-table">
                                        <thead>
                                            <tr><th>Date</th><th className="num">Lost</th><th className="num">Found (online)</th><th className="num">Counter</th><th className="num">Claims</th></tr>
                                        </thead>
                                        <tbody>
                                            {trend.map((r) => (
                                                <tr key={r.date}><td>{r.label}</td><td className="num">{fmt(r.lost)}</td><td className="num">{fmt(r.found)}</td><td className="num">{fmt(r.counter)}</td><td className="num">{fmt(r.claims)}</td></tr>
                                            ))}
                                            <tr className="pr-total"><td>Total</td><td className="num">{fmt(dailyTotals.lost)}</td><td className="num">{fmt(dailyTotals.found)}</td><td className="num">{fmt(dailyTotals.counter)}</td><td className="num">{fmt(dailyTotals.claims)}</td></tr>
                                        </tbody>
                                    </table>
                                </Section>
                            )}

                            {showActivity && (
                                <Section title="Recent activity">
                                    {activity.length ? (
                                        <table className="pr-table">
                                            <thead><tr><th>When</th><th>Type</th><th>Item</th><th>Status</th></tr></thead>
                                            <tbody>
                                                {activity.map((e) => (
                                                    <tr key={`${e.type}-${e.title}-${e.at}`}>
                                                        <td>{new Date(e.at).toLocaleString()}</td>
                                                        <td>{TYPE_LABEL[e.type] || humanize(e.type)}</td>
                                                        <td>{e.title}</td>
                                                        <td>{e.status ? humanize(e.status) : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : <p className="pr-empty">No activity yet.</p>}
                                </Section>
                            )}

                            {remarks.trim() && (
                                <Section title="Remarks">
                                    <p className="pr-remarks-print">{remarks}</p>
                                </Section>
                            )}

                            <div className="pr-sign">
                                <div className="pr-sign-box">
                                    <div className="pr-sign-label">Prepared by:</div>
                                    <div className="pr-sign-line" />
                                    <div className="pr-sign-name">{printedBy}</div>
                                    <div className="pr-sign-role">{roleTitle}, SCLF — Opol Community College</div>
                                    <div className="pr-sign-note">Signature over printed name</div>
                                </div>
                                {showNotedBy && (
                                    <div className="pr-sign-box">
                                        <div className="pr-sign-label">Noted by:</div>
                                        <div className="pr-sign-line" />
                                        <div className="pr-sign-name">&nbsp;</div>
                                        <div className="pr-sign-role">Name and position</div>
                                        <div className="pr-sign-note">Signature over printed name</div>
                                    </div>
                                )}
                                <div className="pr-sign-date">Date signed: ____________________</div>
                            </div>

                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
