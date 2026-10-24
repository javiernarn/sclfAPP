import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/images/site-logo.png';
import { ArrowLeft, Printer } from '../../Components/icons';
import { AreaChart, DonutChart, PALETTE, humanize, fmt } from '../../Components/charts';
import { Section, Card, Tiles, PhotoBox } from '../../Components/shared/PrintParts';
import StyledQrCode from '../../Components/shared/StyledQrCode';
import './PrintReport.css';

// Printable copy of a student's / instructor's dashboard — /app/print/{user token}.
//
//  * The owner opens it from "Print my dashboard" on their dashboard.
//  * An admin / staff account opens it by scanning the QR code
//    printed at the bottom of the paper (the QR encodes THIS page's address),
//    or from the Scan button on their own Print report page.
//
// The token in the address only identifies the account; the server decides
// whether the signed-in person may see it (see PrintReportController).

// Keep the one-page layout: show the first 3 statuses and fold the rest into "Other".
const capEntries = (entries, n = 3) => {
    if (entries.length <= n) return entries;
    const rest = entries.slice(n).reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
    return [...entries.slice(0, n), ['other', rest]];
};

const dateText = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function StudentPrintReport() {
    const { token } = useParams();
    const { roles } = useAuth();
    const list = Array.isArray(roles) ? roles : [];
    const isHandler = list.includes('admin') || list.includes('staff');
    // Opened from a report form's notice ("Check my violations")? Back returns to that
    // form and shows the notice again. Otherwise it goes to the usual dashboard.
    const { state: navState } = useLocation();
    const cameFrom = typeof navState?.backTo === 'string' && navState.backTo.startsWith('/app/') ? navState.backTo : null;
    const backPath = cameFrom
        || (isHandler ? '/app/admin/print-report' : '/app/dashboard');
    const backLabel = cameFrom ? 'Back to the form' : (isHandler ? 'Back to print report' : 'Back to dashboard');

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState('');
    const [qrReady, setQrReady] = useState(false);
    // The sheet re-fits itself to the A4 page after it loads. That work is kept
    // hidden behind a short "Preparing…" loader, so it only appears at its final size.
    const [fitted, setFitted] = useState(false);
    const paperRef = useRef(null);
    const qrBlockRef = useRef(null);
    const [chartH, setChartH] = useState(92);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setProblem('');
        setData(null);
        setQrReady(false);
        setFitted(false);
        axios.get(`/print-report/${encodeURIComponent(token)}`, { silent: true })
            .then((res) => { if (!cancelled) setData(res.data); })
            .catch((err) => {
                if (cancelled) return;
                const status = err?.response?.status;
                setProblem(
                    err?.response?.data?.message
                    || (status === 403 ? 'You can only open your own dashboard report.' : 'Could not load this dashboard report.'),
                );
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [token]);

    // Let the QR finish drawing before Print is offered (it paints in a short animation).
    useEffect(() => {
        if (!data) return undefined;
        const t = setTimeout(() => setQrReady(true), 700);
        return () => clearTimeout(t);
    }, [data]);

    // Fit-to-page: the sheet is exactly one A4 page, so whatever space the data
    // doesn't use is handed back to the chart, QR code and spacing instead of
    // being left blank. Measured on screen (same 190mm width as the printout).
    const PAGE_PX = (274 / 25.4) * 96 - 8;
    const measure = () => {
        const paper = paperRef.current;
        const qr = qrBlockRef.current;
        if (!paper || !qr) return null;
        // Height from the top of the content box (on paper the 10mm padding becomes the @page margin).
        const padTop = parseFloat(getComputedStyle(paper).paddingTop) || 0;
        return qr.getBoundingClientRect().bottom - (paper.getBoundingClientRect().top + padTop);
    };
    const setFit = (sVal) => {
        const paper = paperRef.current;
        if (!paper) return;
        paper.style.setProperty('--qr-w', `${106 + 150 * sVal}px`);
        paper.style.setProperty('--fit-gap', `${26 * sVal}px`);
    };
    useLayoutEffect(() => {
        if (!data) return;
        setFit(0);
        const h0 = measure();
        if (h0 == null) { setFitted(true); return; }
        const extra = PAGE_PX - h0;
        const wantChart = 92 + Math.max(0, Math.min(extra * 0.45, 150));
        if (Math.abs(wantChart - chartH) > 1) { setChartH(Math.round(wantChart)); return; }
        // Chart height is settled: grow the QR code and spacing as far as the page allows.
        let lo = 0; let hi = 1;
        setFit(1);
        if (measure() <= PAGE_PX) { setFitted(true); return; }
        for (let i = 0; i < 12; i += 1) {
            const mid = (lo + hi) / 2;
            setFit(mid);
            if (measure() <= PAGE_PX) lo = mid; else hi = mid;
        }
        setFit(lo);
        setFitted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, chartH]);


    // Browsers use document.title as the default PDF file name.
    useEffect(() => {
        const prev = document.title;
        if (data?.subject) {
            const who = (data.subject.display_id || data.subject.name || 'user').toString().replace(/[^\w-]+/g, '-');
            document.title = `SCLF-Dashboard-${who}-${new Date().toISOString().slice(0, 10)}`;
        }
        return () => { document.title = prev; };
    }, [data]);

    const prepStep = !data ? 'Loading your report…' : 'Fitting to one page…';
    const prepPercent = !data ? 35 : 90;
    const sheetReady = fitted || !!problem;
    const canPrint = !!data && qrReady && fitted;

    const subject = data?.subject;
    const report = data?.report;
    const kpis = report?.kpis || {};
    const isInstructor = subject?.role === 'instructor';
    const roleLabel = isInstructor ? 'Instructor' : 'Student';
    const generatedAt = data?.generated_at ? new Date(data.generated_at) : new Date();
    const qrUrl = subject ? `${window.location.origin}/app/print/${subject.public_token}` : '';

    const claimEntries = Object.entries(report?.claims_by_status || {});
    const lostEntries = Object.entries(report?.lost_by_status || {});
    const svcEntries = Object.entries(report?.service_requests_by_status || {});
    const incEntries = Object.entries(report?.incidents_by_status || {});
    const recent = report?.recent || [];
    const violations = data?.violations || { count: 0, pending: null, items: [] };

    const tiles = [
        { label: 'Total reports', value: fmt(kpis.reports) },
        { label: 'Pending', value: fmt(kpis.pending) },
        { label: 'Matched', value: fmt(kpis.matched) },
        { label: 'Recovered', value: fmt(kpis.recovered) },
        { label: 'Active claims', value: fmt(kpis.active_claims) },
    ];

    return (
        <div className={`pr-root ${sheetReady ? '' : 'is-prep'}`}>
            <style>{`
                @page { size: A4 portrait; margin: 8mm 10mm 12mm; }
                @page { @bottom-left { content: "SCLF — Opol Community College · Confidential"; font-size: 8pt; color: #6b7280; }
                        @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #6b7280; } }
            `}</style>

            <div className="pr-toolbar">
                <div className="pr-toolbar-row">
                    <Link to={backPath} state={cameFrom ? { reopenNotice: true } : undefined} className="pr-back"><ArrowLeft size={16} /> {backLabel}</Link>
                    <strong className="pr-toolbar-title">
                        {subject ? `${roleLabel} Dashboard Report — ${subject.name}` : 'Dashboard Report'}
                    </strong>
                    <button type="button" className="pr-print-btn" onClick={() => window.print()} disabled={!canPrint}>
                        <Printer size={16} /> {data && !canPrint ? 'Preparing…' : 'Print / Save as PDF'}
                    </button>
                </div>
                {data && !data.viewer_is_self && (
                    <p className="pr-tip" style={{ flex: '1 1 100%' }}>
                        You are viewing <b>{subject.name}</b>’s dashboard (read-only). This view is recorded in the audit log.
                    </p>
                )}
                {data && data.viewer_is_self && (
                    <p className="pr-tip" style={{ flex: '1 1 100%' }}>
                        Tip: choose <b>Save as PDF</b> in the print window. The QR code at the bottom lets an admin or staff account open this dashboard by scanning your printed copy.
                    </p>
                )}
            </div>

            <div className="pr-stage">
                {!sheetReady && (
                    <div className="pr-loading" role="status" aria-live="polite">
                        <span className="pr-loading-spin" aria-hidden="true" />
                        <p className="pr-loading-title">Preparing your report…</p>
                        <p className="pr-loading-sub">{prepStep}</p>
                        <div className="pr-loading-bar" aria-hidden="true"><i style={{ width: `${prepPercent}%` }} /></div>
                    </div>
                )}
                <div className="pr-paper pr-portrait pr-student" ref={paperRef} style={sheetReady ? undefined : { visibility: 'hidden' }}>
                    <header className="pr-head pr-head-student">
                        <div className="pr-head-main">
                            <div className="pr-head-brand">
                                <img src={logo} alt="Opol Community College logo" className="pr-logo" />
                                <div>
                                    <div className="pr-college">Opol Community College</div>
                                    <div className="pr-sys">Smart Campus Lost &amp; Found (SCLF)</div>
                                    <h1 className="pr-title">{roleLabel} Dashboard Report</h1>
                                </div>
                            </div>
                            {subject && (
                                <div className="pr-idcard">
                                    <div className="pr-idcard-name">{subject.name}</div>
                                    <dl className="pr-idcard-grid">
                                        <div><dt>{isInstructor ? 'Instructor ID' : 'Student ID'}</dt><dd>{subject.display_id || '—'}</dd></div>
                                        <div><dt>Generated</dt><dd>{generatedAt.toLocaleString()}</dd></div>
                                        {(subject.course || subject.department) && (
                                            <div><dt>{subject.course ? 'Course' : 'Department'}</dt><dd>{subject.course || subject.department}</dd></div>
                                        )}
                                        {subject.email && <div className="pr-idcard-wide"><dt>Email</dt><dd>{subject.email}</dd></div>}
                                    </dl>
                                </div>
                            )}
                        </div>
                        {subject && <PhotoBox src={subject.profile_picture_url} name={subject.name} />}
                    </header>

                    {!loading && problem && <p className="pr-state">{problem}</p>}

                    {data && (
                        <>
                            <Section title="Your reports at a glance">
                                <Tiles items={tiles} days={0} />
                            </Section>

                            <div className="pr-row pr-row-2-1">
                                <Card title="Activity" subtitle="Reports and claims filed, last 6 months.">
                                    <div className="pr-legend">
                                        <span><i style={{ background: 'var(--ch-1)' }} />Reports</span>
                                        <span><i style={{ background: 'var(--ch-3)' }} />Claims</span>
                                    </div>
                                    <AreaChart
                                        data={report.monthly || []}
                                        xKey="label"
                                        height={chartH}
                                        live={false}
                                        series={[
                                            { key: 'reports', label: 'Reports', color: 'var(--ch-1)' },
                                            { key: 'claims', label: 'Claims', color: 'var(--ch-3)' },
                                        ]}
                                    />
                                </Card>
                                <Card title="Report status" subtitle="What happened to each report.">
                                    {lostEntries.length ? (
                                        <DonutChart
                                            size={92}
                                            thickness={13}
                                            centerLabel="Reports"
                                            data={lostEntries.map(([k, v], i) => ({ label: humanize(k), value: v, color: PALETTE[i % PALETTE.length] }))}
                                        />
                                    ) : <p className="pr-empty">Nothing reported yet.</p>}
                                </Card>
                            </div>

                            {(() => {
                                const statusTable = (entries, empty) => (entries.length ? (
                                    <table className="pr-table"><tbody>
                                        {capEntries(entries).map(([k, v]) => <tr key={k}><td>{humanize(k)}</td><td className="num">{fmt(v)}</td></tr>)}
                                    </tbody></table>
                                ) : <p className="pr-empty">{empty}</p>);
                                const recentCard = (
                                    <Card title="Recent reports">
                                        {recent.length ? (
                                            <table className="pr-table pr-table-fixed">
                                                <thead><tr><th>Item</th><th className="pr-col-status">Status</th><th className="pr-col-date">Updated</th></tr></thead>
                                                <tbody>
                                                    {recent.slice(0, 3).map((r) => (
                                                        <tr key={r.id}><td className="pr-cell-clip">{r.title}</td><td>{humanize(r.status)}</td><td>{r.at ? dateText(r.at) : '—'}</td></tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : <p className="pr-empty">No reports yet.</p>}
                                    </Card>
                                );
                                const claimsCard = <Card title="Claims by status">{statusTable(claimEntries, 'No claims yet.')}</Card>;
                                // Student: recent reports + claims share one row. Instructor: recent on its own, then three small tables.
                                return isInstructor ? (
                                    <>
                                        {recentCard}
                                        <div className="pr-row pr-row-compact" style={{ marginTop: 8 }}>
                                            {claimsCard}
                                            <Card title="Service requests">{statusTable(svcEntries, 'None.')}</Card>
                                            <Card title="Incident reports">{statusTable(incEntries, 'None.')}</Card>
                                        </div>
                                    </>
                                ) : (
                                    <div className="pr-row pr-row-compact pr-row-recent-claims">
                                        {recentCard}
                                        {claimsCard}
                                    </div>
                                );
                            })()}

                            <Section title="Violations">
                                {violations.count > 0 ? (
                                    <>
                                        <p className="pr-violation-flag">
                                            {violations.count} confirmed violation{violations.count === 1 ? '' : 's'} of the system rules
                                            (sensitive photo/video uploaded with a report).
                                        </p>
                                        <table className="pr-table">
                                            <thead><tr><th>Date</th><th>Violation</th><th>Reason</th><th>Confirmed by</th></tr></thead>
                                            <tbody>
                                                {violations.items.slice(0, 3).map((v) => (
                                                    <tr key={v.id}>
                                                        <td>{v.at ? dateText(v.at) : '—'}</td>
                                                        <td>Sensitive content upload</td>
                                                        <td>{v.reason || '—'}</td>
                                                        <td>{v.confirmed_by || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {violations.items.length > 3 && <p className="pr-violation-pending">+ {violations.items.length - 3} more on record.</p>}
                                    </>
                                ) : (
                                    <p className="pr-no-violations">No violations. This account has no confirmed violations of the system rules.</p>
                                )}
                                {violations.pending > 0 && (
                                    <p className="pr-violation-pending">{violations.pending} file{violations.pending === 1 ? '' : 's'} still waiting for review (not counted yet).</p>
                                )}
                            </Section>

                            <p className="pr-campus-line">
                                Campus-wide, <b>{report.campus?.recovery_rate ?? 0}%</b> of reported lost items have been recovered,
                                with <b>{report.campus?.items_on_shelf ?? 0}</b> unclaimed items on the shelf.
                            </p>

                            {/* ---- QR (left) + info and Authorized Personnel signature (right) ---- */}
                            <div className="pr-qr-block" ref={qrBlockRef}>
                                <div className="pr-qr-code">
                                    <StyledQrCode
                                        value={qrUrl}
                                        title="SCLF - Opol Community College"
                                        subtitle={subject.display_id || subject.name}
                                        size={420}
                                        showDownloadButton={false}
                                        generateDurationMs={500}
                                    />
                                </div>
                                <div className="pr-qr-side">
                                    <div className="pr-qr-text">
                                        <div className="pr-qr-title">Scan to open this dashboard</div>
                                        <p>Only Admin and Staff accounts can scan this code to view <b>{subject.name}</b>’s dashboard.</p>
                                        <p className="pr-qr-url">{qrUrl}</p>
                                    </div>
                                    <div className="pr-qr-sign">
                                        <div className="pr-sign-label">Authorized Personnel:</div>
                                        <div className="pr-sign-line" />
                                        <div className="pr-qr-sign-row">
                                            <span>Signature over printed name / position</span>
                                            <span>Date signed: ______________</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </>
                    )}
                </div>
            </div>
        </div>
    );
}