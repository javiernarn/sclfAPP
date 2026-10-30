import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import useRoleTranslation from '../../hooks/useRoleTranslation';
import { rich, tOr } from '../../i18n';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
    ClipboardList, Hourglass, CircleCheck, Handshake,
    Wrench, ShieldAlert, Activity, Printer,
} from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import usePrintAccess from '../../hooks/usePrintAccess';
import useIsPhone from '../../hooks/useIsPhone';
import MobileHome from '../../Components/shared/MobileHome';
import RefreshButton from '../../Components/shared/RefreshButton';
import DashboardSkeleton from '../../Components/shared/DashboardSkeleton';
import {
    KpiCard, ChartCard, AreaChart, DonutChart, LiveBadge, usePolling, humanize, PALETTE,
} from '../../Components/charts';

export default function StudentDashboard() {
    const { user, roles } = useAuth();
    const { token } = useParams();
    const isPhone = useIsPhone();
    const { t } = useRoleTranslation();
    const printAccess = usePrintAccess(); // admin switch for Print / Save as PDF
    const isInstructor = Array.isArray(roles) && roles.includes('instructor');
    const { data, loading, error, updatedAt, refresh } = usePolling('/analytics/me', { interval: 20000 });
    // The account's own user token — the dashboard address and the printed
    // copy's QR code are built from it (/app/dashboard/{token}, /app/print/{token}).
    const ownToken = user?.public_token;
    // On phones MobileHome is the one greeting; the desktop greeting/clock block is dropped.
    const shellProps = isPhone
        ? {}
        : {
            eyebrow: isInstructor ? t('dash.portalInstructor') : t('dash.portalStudent'),
            greeting: { name: user?.name },
            subtitle: t('dash.subtitle'),
        };

    useEffect(() => {
        document.title = t('dash.pageTitle');
    }, [t]);

    // Status names come from the server ("under_review"); show them translated.
    const statusLabel = (key) => tOr(t, `common.status_${key}`, humanize(key));

    // /app/dashboard (or someone else's token) -> your own tokened address.
    // This page only ever shows the signed-in person's own numbers; an
    // admin/staff account opens a student's dashboard from the QR on
    // their printed copy instead (/app/print/{token}).
    if (ownToken && token !== ownToken) {
        return <Navigate to={`/app/dashboard/${ownToken}`} replace />;
    }

    if (loading && !data) {
        return (
            <DashboardShell {...shellProps}>
                {isPhone && <MobileHome name={user?.name} role={isInstructor ? t('shell.roleInstructor') : t('shell.roleStudent')} />}
                <DashboardSkeleton statCount={3} cardCount={2} />
            </DashboardShell>
        );
    }

    const kpis = data?.kpis || {};
    const dailySeries = (data?.daily || []).map((d) => d.count);
    const svcByStatus = data?.service_requests_by_status || {};
    const incByStatus = data?.incidents_by_status || {};

    return (
        <DashboardShell {...shellProps}>
            {isPhone && (
                <MobileHome
                    name={user?.name}
                    role={isInstructor ? t('shell.roleInstructor') : t('shell.roleStudent')}
                    kpis={kpis}
                    campus={data?.campus}
                />
            )}
            <div className="ch-toolbar">
                <LiveBadge updatedAt={updatedAt} error={error} />
                <div className="ch-toolbar-actions">
                    <RefreshButton onRefresh={refresh} loading={loading} />
                    {ownToken && (printAccess.enabled || isInstructor ? (
                        <Link to={`/app/print/${ownToken}`} className="ds-btn ds-btn-secondary">
                            <Printer size={16} /> {t('dash.printMine')}
                        </Link>
                    ) : (
                        <button
                            type="button"
                            className="ds-btn ds-btn-secondary"
                            disabled
                            title={printAccess.message}
                            style={{ opacity: 0.55, cursor: 'not-allowed' }}
                        >
                            <Printer size={16} /> {printAccess.loaded ? 'Printing not open yet' : t('dash.printMine')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Admin switch is OFF: tell the student why Print is locked (visible on phones too). */}
            {ownToken && !isInstructor && printAccess.loaded && !printAccess.enabled && printAccess.message && (
                <div
                    role="status"
                    style={{
                        margin: '0 0 14px', padding: '10px 14px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5,
                        border: '1px solid rgba(245,158,11,.45)', background: 'rgba(245,158,11,.12)',
                    }}
                >
                    <strong>Printing not open yet.</strong> {printAccess.message}
                </div>
            )}

            {/* ---- Personal KPIs ---- */}
            {!isPhone && (
            <div className="ch-kpi-grid">
                <KpiCard icon={ClipboardList} label={t('dash.kpiTotal')} value={kpis.reports} color="var(--ch-1)" series={dailySeries} />
                <KpiCard icon={Hourglass} label={t('dash.kpiPending')} value={kpis.pending} color="var(--ch-4)" goodWhen="down" />
                <KpiCard icon={CircleCheck} label={t('dash.kpiRecovered')} value={kpis.recovered} color="var(--ch-good)" />
                <KpiCard icon={Handshake} label={t('dash.kpiActive')} value={kpis.active_claims} color="var(--ch-3)" />
            </div>
            )}

            {/* ---- Trend + status ---- */}
            <div className="ch-row cols-2-1">
                <ChartCard title={t('dash.activityTitle')} subtitle={t('dash.activitySub')} icon={Activity}>
                    <AreaChart
                        data={data.monthly}
                        xKey="label"
                        series={[
                            { key: 'reports', label: t('dash.serReports'), color: 'var(--ch-1)' },
                            { key: 'claims', label: t('dash.serClaims'), color: 'var(--ch-3)' },
                        ]}
                    />
                </ChartCard>

                <ChartCard title={t('dash.statusTitle')} subtitle={t('dash.statusSub')} icon={ClipboardList}>
                    {Object.keys(data.lost_by_status || {}).length ? (
                        <DonutChart
                            centerLabel={t('dash.centerReports')}
                            data={Object.entries(data.lost_by_status).map(([k, v], i) => ({ label: statusLabel(k), value: v, color: PALETTE[i % PALETTE.length] }))}
                        />
                    ) : (
                        <p className="ch-empty">{t('dash.nothingReported')}</p>
                    )}
                </ChartCard>
            </div>

            {/* ---- Instructor extras: service requests + incidents they've filed ---- */}
            {isInstructor && (svcByStatus && Object.keys(svcByStatus).length > 0 || incByStatus && Object.keys(incByStatus).length > 0) && (
                <div className="ch-row cols-1-1">
                    <ChartCard title={t('dash.svcTitle')} subtitle={t('dash.svcSub')} icon={Wrench}>
                        {Object.keys(svcByStatus).length ? (
                            <DonutChart centerLabel={t('dash.centerRequests')} size={140} thickness={16}
                                data={Object.entries(svcByStatus).map(([k, v], i) => ({ label: statusLabel(k), value: v, color: PALETTE[i % PALETTE.length] }))} />
                        ) : <p className="ch-empty">{t('dash.noSvc')}</p>}
                    </ChartCard>
                    <ChartCard title={t('dash.incTitle')} subtitle={t('dash.incSub')} icon={ShieldAlert}>
                        {Object.keys(incByStatus).length ? (
                            <DonutChart centerLabel={t('dash.centerIncidents')} size={140} thickness={16}
                                data={Object.entries(incByStatus).map(([k, v], i) => ({ label: statusLabel(k), value: v, color: PALETTE[(i + 2) % PALETTE.length] }))} />
                        ) : <p className="ch-empty">{t('dash.noInc')}</p>}
                    </ChartCard>
                </div>
            )}

            {/* ---- Campus-wide headline (no personal data of others exposed) ---- */}
            {!isPhone && (
            <div className="ds-card" style={{ marginBottom: 16 }}>
                <div className="ds-card-title ds-card-title-icon"><CircleCheck size={18} strokeWidth={2} /> {t('dash.recoveryTitle')}</div>
                <p className="ds-card-desc" style={{ marginBottom: 0 }}>
                    {rich(t('dash.recoveryText', { rate: data.campus?.recovery_rate ?? 0, shelf: data.campus?.items_on_shelf ?? 0 }))}
                </p>
            </div>
            )}
        </DashboardShell>
    );
}
