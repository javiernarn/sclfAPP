import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';

const ROUTE_FOR_TYPE = {
    'App\\Models\\Claim': (id) => `/claims/${id}`,
    'App\\Models\\LostItem': (id) => `/lost-items/${id}/matches`,
    'App\\Models\\FoundItem': (id) => `/found-items/${id}`,
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const [view, setView] = useViewMode('notifications');

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

    const openNotification = async (n) => {
        await axios.post(`/notifications/${n.id}/read`);
        const related = n.data?.related_type && n.data?.related_id
            ? ROUTE_FOR_TYPE[n.data.related_type]?.(n.data.related_id)
            : null;
        if (related) navigate(related); else load();
    };

    const markAllRead = async () => {
        await axios.post('/notifications/read-all');
        load();
    };

    return (
        <DashboardShell
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
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Message</th>
                                    <th>Received</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {notifications.map(n => (
                                    <tr
                                        key={n.id}
                                        className={`is-clickable ${!n.read_at ? 'is-unread' : ''}`}
                                        style={{ opacity: n.read_at ? 0.6 : 1 }}
                                        onClick={() => openNotification(n)}
                                    >
                                        <td className="ds-table-title" style={{ maxWidth: 200 }}>{n.data.title}</td>
                                        <td className="ds-table-sub" style={{ maxWidth: 360, whiteSpace: 'normal' }}>{n.data.message}</td>
                                        <td className="ds-table-nowrap">{new Date(n.created_at).toLocaleString()}</td>
                                        <td>{!n.read_at ? <span className="ds-badge ds-badge-pending">New</span> : <span className="ds-badge ds-badge-default">Read</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && notifications.length > 0 && view === 'cards' && (
                    <ul className="ds-list">
                        {notifications.map(n => (
                            <li key={n.id} className="ds-list-item" style={{ cursor: 'pointer', opacity: n.read_at ? 0.6 : 1 }}
                                onClick={() => openNotification(n)}>
                                <div>
                                    <p className="ds-list-item-title">{n.data.title}</p>
                                    <p className="ds-list-item-meta">{n.data.message}</p>
                                </div>
                                {!n.read_at && <span className="ds-badge ds-badge-pending">New</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
