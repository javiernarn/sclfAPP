import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import axios from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/images/site-logo.png';
import { ArrowLeft, Printer } from '../../Components/icons';
import { AreaChart, DonutChart, PALETTE, humanize, fmt } from '../../Components/charts';
import { Section, Card, Tiles } from '../../Components/shared/PrintParts';
import StyledQrCode from '../../Components/shared/StyledQrCode';
import './PrintReport.css';

// Printable copy of a student's / instructor's dashboard — /app/print/{user token}.
//
//  * The owner opens it from "Print my dashboard" on their dashboard.
//  * An admin / staff / security officer opens it by scanning the QR code
//    printed at the bottom of the paper (the QR encodes THIS page's address),
//    or from the Scan button on their own Print report page.
//
// The token in the address only identifies the account; the server decides
// whether the signed-in person may see it (see PrintReportController).

const dateText = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function StudentPrintReport() {
    const { token } = useParams();
    const { roles } = useAuth();
    const list = Array.isArray(roles) ? roles : [];
    const isHandler = list.includes('admin') || list.includes('staff') || list.includes('security_officer');
    const backPath = isHandler
        ? (list.includes('admin') || list.includes('staff') ? '/app/admin/print-report' : '/app/security/print-report')
        : '/app/dashboard';

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState('');
    const [qrReady, setQrReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setProblem('');
        setData(null);
        setQrReady(false);
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
        const t = setTimeout(() => setQrReady(true), 1400);
        return () => clearTimeout(t);
    }, [data]);

    // Browsers use document.title as the default PDF file name.
    useEffect(() => {
        const prev = document.title;
        if (data?.subject) {
            const who = (data.subject.display_id || data.subject.name || 'user').toString().replace(/[^\w-]+/g, '-');
            document.title = `SCLF-Dashboard-${who}-${new Date().toISOString().slice(0, 10)}`;
        }
        return () => { document.title = prev; };
    }, [data]);

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

    const tiles = [
        { label: 'Total reports', value: fmt(kpis.reports) },
        { label: 'Pending', value: fmt(kpis.pending) },
        { label: 'Matched', value: fmt(kpis.matched) },
        { label: 'Recovered', value: fmt(kpis.recovered) },
        { label: 'Active claims', value: fmt(kpis.active_claims) },
    ];

    return (
        <div className="pr-root">
            <style>{`
                @page { size: A4 portrait; margin: 10mm 10mm 14mm; }
                @page { @bottom-left { content: "SCLF — Opol Community College · Confidential"; font-size: 8pt; color: #6b7280; }
                        @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #6b7280; } }
            `}</style>

            <div className="pr-toolbar">
                <div className="pr-toolbar-row">
                    <Link to={backPath} className="pr-back"><ArrowLeft size={16} /> {isHandler ? 'Back to print report' : 'Back to dashboard'}</Link>
                    <strong className="pr-toolbar-title">
                        {subject ? `${roleLabel} Dashboard Report — ${subject.name}` : 'Dashboard Report'}
                    </strong>
                    <button type="button" className="pr-print-btn" onClick={() => window.print()} disabled={!data || !qrReady}>
                        <Printer size={16} /> {data && !qrReady ? 'Preparing…' : 'Print / Save as PDF'}
                    </button>
                </div>
                {data && !data.viewer_is_self && (
                    <p className="pr-tip" style={{ flex: '1 1 100%' }}>
                        You are viewing <b>{subject.name}</b>’s dashboard (read-only). This view is recorded in the audit log.
                    </p>
                )}
                {data && data.viewer_is_self && (
                    <p className="pr-tip" style={{ flex: '1 1 100%' }}>
                        Tip: choose <b>Save as PDF</b> in the print window. The QR code at the bottom lets an admin or security officer open this dashboard by scanning your printed copy.
                    </p>
                )}
            </div>

            <div className="pr-stage">
                <div className="pr-paper pr-portrait pr-student">
                    <header className="pr-head">
                        <div className="pr-head-brand">
                            <img src={logo} alt="Opol Community College logo" className="pr-logo" />
                            <div>
                                <div className="pr-college">Opol Community College</div>
                                <div className="pr-sys">Smart Campus Lost &amp; Found (SCLF)</div>
                                <h1 className="pr-title">{roleLabel} Dashboard Report</h1>
                            </div>
                        </div>
                        {subject && (
                            <dl className="pr-meta">
                                <div><dt>Name</dt><dd>{subject.name}</dd></div>
                                <div><dt>{isInstructor ? 'Instructor ID' : 'Student ID'}</dt><dd>{subject.display_id || '—'}</dd></div>
                                {(subject.course || subject.department) && (
                                    <div><dt>{subject.course ? 'Course' : 'Department'}</dt><dd>{subject.course || subject.department}</dd></div>
                                )}
                                <div><dt>Generated</dt><dd>{generatedAt.toLocaleString()}</dd></div>
                            </dl>
                        )}
                    </header>

                    {loading && <p className="pr-state">Preparing report…</p>}
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
                                        height={185}
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
                                            size={140}
                                            thickness={16}
                                            centerLabel="Reports"
                                            data={lostEntries.map(([k, v], i) => ({ label: humanize(k), value: v, color: PALETTE[i % PALETTE.length] }))}
                                        />
                                    ) : <p className="pr-empty">Nothing reported yet.</p>}
                                </Card>
                            </div>

                            <div className="pr-row pr-row-tables">
                                <Card title="Recent reports" subtitle="Most recently updated.">
                                    {recent.length ? (
                                        <table className="pr-table">
                                            <thead><tr><th>Item</th><th>Status</th><th>Updated</th></tr></thead>
                                            <tbody>
                                                {recent.map((r) => (
                                                    <tr key={r.id}><td>{r.title}</td><td>{humanize(r.status)}</td><td>{r.at ? dateText(r.at) : '—'}</td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : <p className="pr-empty">No reports yet.</p>}
                                </Card>

                                <Card title="Claims by status" subtitle="Claims this account has filed.">
                                    {claimEntries.length ? (
                                        <table className="pr-table">
                                            <thead><tr><th>Status</th><th className="num">Claims</th></tr></thead>
                                            <tbody>
                                                {claimEntries.map(([k, v]) => (
                                                    <tr key={k}><td>{humanize(k)}</td><td className="num">{fmt(v)}</td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : <p className="pr-empty">No claims yet.</p>}
                                </Card>
                            </div>

                            {isInstructor && (svcEntries.length > 0 || incEntries.length > 0) && (
                                <div className="pr-row pr-row-tables">
                                    <Card title="Service requests" subtitle="Facilities / IT requests submitted.">
                                        {svcEntries.length ? (
                                            <table className="pr-table"><tbody>
                                                {svcEntries.map(([k, v]) => <tr key={k}><td>{humanize(k)}</td><td className="num">{fmt(v)}</td></tr>)}
                                            </tbody></table>
                                        ) : <p className="pr-empty">None.</p>}
                                    </Card>
                                    <Card title="Incident reports" subtitle="Security incidents reported.">
                                        {incEntries.length ? (
                                            <table className="pr-table"><tbody>
                                                {incEntries.map(([k, v]) => <tr key={k}><td>{humanize(k)}</td><td className="num">{fmt(v)}</td></tr>)}
                                            </tbody></table>
                                        ) : <p className="pr-empty">None.</p>}
                                    </Card>
                                </div>
                            )}

                            <p className="pr-campus-line">
                                Campus-wide, <b>{report.campus?.recovery_rate ?? 0}%</b> of reported lost items have been recovered,
                                with <b>{report.campus?.items_on_shelf ?? 0}</b> unclaimed items on the shelf.
                            </p>

                            {/* ---- QR (left) + info and Authorized Personnel signature (right) ---- */}
                            <div className="pr-qr-block">
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
                                        <p>Admin, Staff and Security accounts can scan this code to view <b>{subject.name}</b>’s dashboard.</p>
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

                            <footer className="pr-foot">
                                <span>SCLF — Opol Community College · Confidential</span>
                                <span>Generated {generatedAt.toLocaleString()}</span>
                            </footer>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}