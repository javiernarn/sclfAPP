import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { useNotifications } from '../../context/NotificationContext';
import NotificationDetail from '../../Components/shared/NotificationDetail';
import { destinationForNotification } from '../../utils/notificationRoutes';
import RoleText, { RoleBadge } from '../../Components/shared/RoleText';

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();
    const [detail, setDetail] = useState(null);
    // Set when the bell sent us here for a notification that has no page of
    // its own: scroll to it and flash it so it is obvious which one to tap.
    const [highlightId, setHighlightId] = useState(location.state?.highlight || null);
    const [view, setView] = useViewMode('notifications');
    // Routing mark-read/mark-all-read through the shared context (instead
    // of calling the API directly here) is what keeps the header bell's
    // badge and the sidebar's "Notifications" count in sync with this
    // page the instant something is read here, and vice versa — all
    // three surfaces share one source of truth. This page still fetches
    // its own full, paginated list below (the context only ever keeps a
    // short preview for the bell's dropdown).
    const { markAsRead, markAllAsRead } = useNotifications();

    useEffect(() => {
        document.title = "Notifications | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/notifications')
            .then(res => setNotifications(res.data.notifications.data))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    // Already on this page when another notification is tapped in the bell.
    useEffect(() => {
        if (location.state?.highlight) { setHighlightId(location.state.highlight); load(); }
    }, [location.state?.highlight, location.key]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!highlightId || loading) return undefined;
        const el = document.getElementById(`notif-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const t = setTimeout(() => setHighlightId(null), 4000);
        return () => clearTimeout(t);
    }, [highlightId, loading]);

    const markReadLocal = (n) => {
        if (n.read_at) return;
        markAsRead(n.id);
        setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    };

    // Has a destination -> go there. Otherwise show the full details.
    const openNotification = (n) => {
        markReadLocal(n);
        const dest = destinationForNotification(n);
        if (dest) navigate(dest);
        else setDetail({ ...n, read_at: n.read_at || new Date().toISOString() });
    };

    // The "Details" button always shows the full text, even when the
    // notification also has a page to open.
    const showDetails = (e, n) => {
        e.stopPropagation();
        markReadLocal(n);
        setDetail({ ...n, read_at: n.read_at || new Date().toISOString() });
    };

    const rowClass = (n) => `${!n.read_at ? 'is-unread' : ''} ${highlightId === n.id ? 'ds-notif-highlight' : ''}`.trim();

    const markAllRead = async () => {
        await markAllAsRead();
        load();
    };

    return (
        <DashboardShell onRefresh={() => load()} refreshing={loading}
            eyebrow="Lost & Found"
            title="Notifications"
            actions={<button className="ds-btn ds-btn-secondary" onClick={markAllRead}>Mark all as read</button>}
        >
            <div className="ds-card">
                <div className="ds-list-head-row" style={{ justifyContent: 'flex-end' }}>
                    <ViewToggle mode={view} onChange={setView} />
                </div>

                {loading && (<><div className="ds-skeleton" /><div className="ds-skeleton" /></>)}
                {!loading && notifications.length === 0 && <div className="ds-empty">You're all caught up.</div>}

                {!loading && notifications.length > 0 && view === 'table' && (
                    <div className="ds-table-wrap ds-notif-table-wrap">
                        <table className="ds-table ds-notif-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Message</th>
                                    <th>Received</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {notifications.map(n => (
                                    <tr
                                        key={n.id}
                                        id={`notif-${n.id}`}
                                        className={`is-clickable ${rowClass(n)}`}
                                        style={{ opacity: n.read_at ? 0.75 : 1 }}
                                        onClick={() => openNotification(n)}
                                    >
                                        <td className="ds-table-title ds-notif-c-title" style={{ maxWidth: 200 }}>{n.data.title}</td>
                                        <td className="ds-table-sub ds-notif-c-msg" style={{ maxWidth: 360, whiteSpace: 'normal' }}><RoleText keys text={n.data.message} /></td>
                                        <td className="ds-table-nowrap ds-notif-c-time">{new Date(n.created_at).toLocaleString()}</td>
                                        <td className="ds-notif-c-status">{!n.read_at ? <span className="ds-badge ds-badge-pending">New</span> : <span className="ds-badge ds-badge-default">Read</span>}</td>
                                        <td className="ds-notif-c-act"><button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={(e) => showDetails(e, n)}>Details</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && notifications.length > 0 && view === 'cards' && (
                    <ul className="ds-list">
                        {notifications.map(n => (
                            <li key={n.id} id={`notif-${n.id}`} className={`ds-list-item ds-notif-card ${rowClass(n)}`}
                                onClick={() => openNotification(n)}>
                                <div className="ds-notif-card-body">
                                    <p className="ds-list-item-title">{n.data.title}</p>
                                    <p className="ds-list-item-meta ds-notif-card-msg"><RoleText keys text={n.data.message} /></p>
                                    <p className="ds-list-item-meta ds-notif-card-time">{new Date(n.created_at).toLocaleString()}</p>
                                </div>
                                <div className="ds-notif-card-side">
                                    {!n.read_at && <span className="ds-badge ds-badge-pending">New</span>}
                                    <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={(e) => showDetails(e, n)}>Details</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <NotificationDetail
                notification={detail}
                onClose={() => setDetail(null)}
                onOpenRelated={(dest) => { setDetail(null); navigate(dest); }}
            />
        </DashboardShell>
    );
}
