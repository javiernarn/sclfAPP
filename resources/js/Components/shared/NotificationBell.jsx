import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from '../icons';
import AccountMenu from './AccountMenu';
import Tooltip from './Tooltip';
import { useNotifications } from '../../context/NotificationContext';
import { routeForNotification } from '../../utils/notificationRoutes';

// Same badge-label map as NotificationsPage/SclfNotification — kept local
// (rather than imported) since it's presentational-only here: just picks
// which of the shared .ds-badge-* color classes a preview row's little
// type dot uses, purely cosmetic and safe to fall back on for any type
// this map hasn't been kept in sync with.
const TONE_FOR_TYPE = {
    potential_match: 'ds-badge-review',
    claim_submitted: 'ds-badge-review',
    claim_approved: 'ds-badge-found',
    claim_rejected: 'ds-badge-rejected',
    more_evidence_required: 'ds-badge-pending',
    item_ready_for_release: 'ds-badge-found',
    item_released: 'ds-badge-found',
    found_report_approved: 'ds-badge-found',
    found_report_rejected: 'ds-badge-rejected',
    security_verification_completed: 'ds-badge-review',
    queue_called: 'ds-badge-found',
    incident_assigned: 'ds-badge-pending',
    service_request_assigned: 'ds-badge-pending',
    service_request_completed: 'ds-badge-found',
    asset_assigned: 'ds-badge-review',
};

// Short "3m ago" / "2h ago" / "5d ago" style relative timestamp — falls
// back to a plain date once it's further back than a week so the preview
// list never prints something absurd like "412h ago".
function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}

/**
 * Sits beside the account dropdown in DashboardShell's header. Shares its
 * unread count / recent list / mark-read actions with the sidebar's
 * "Notifications" badge and the full /app/notifications page via
 * NotificationContext, so all three always agree — reading a notification
 * from the bell also clears it from the sidebar badge and the full list,
 * and vice versa.
 *
 * Works identically for every role (student, instructor, security
 * officer, admin) since the underlying API is scoped to whichever account
 * is currently signed in — there's nothing role-specific in this
 * component itself.
 */
export default function NotificationBell({ isDark }) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const navigate = useNavigate();
    const { unreadCount, recent, loadingRecent, refreshRecent, markAsRead, markAllAsRead } = useNotifications();

    // Fetch the preview list the moment the dropdown opens rather than
    // polling it constantly in the background — the unread *count* alone
    // is what needs to stay live at all times (see NotificationContext),
    // the list itself only matters once someone actually looks at it.
    useEffect(() => {
        if (open) refreshRecent();
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            if (triggerRef.current?.contains(e.target)) return;
            if (menuRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const openNotification = async (n) => {
        if (!n.read_at) await markAsRead(n.id);
        setOpen(false);
        navigate(routeForNotification(n));
    };

    const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

    return (
        <div className="ds-menu-wrap">
            <Tooltip label={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}>
                <button
                    type="button"
                    ref={triggerRef}
                    className="ds-icon-btn ds-bell-btn"
                    onClick={() => setOpen((v) => !v)}
                    aria-label="Notifications"
                    aria-expanded={open}
                    aria-haspopup="true"
                >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                        <span className="ds-bell-badge" aria-hidden="true">{badgeLabel}</span>
                    )}
                </button>
            </Tooltip>

            <AccountMenu
                open={open}
                onClose={() => setOpen(false)}
                triggerRef={triggerRef}
                menuRef={menuRef}
                placement="bottom-end"
                width={360}
                theme={isDark ? 'dark' : 'light'}
                className="ds-menu ds-notif-menu"
            >
                <div className="ds-notif-head">
                    <span className="ds-notif-title">Notifications</span>
                    {unreadCount > 0 && (
                        <button type="button" className="ds-notif-mark-all" onClick={markAllAsRead}>
                            <CheckCheck size={14} /> Mark all as read
                        </button>
                    )}
                </div>

                <div className="ds-notif-list">
                    {loadingRecent && (
                        <>
                            <div className="ds-skeleton" />
                            <div className="ds-skeleton" />
                        </>
                    )}

                    {!loadingRecent && recent.length === 0 && (
                        <div className="ds-notif-empty">
                            <Inbox size={22} />
                            <span>You're all caught up.</span>
                        </div>
                    )}

                    {!loadingRecent && recent.map((n) => (
                        <button
                            type="button"
                            key={n.id}
                            className={`ds-notif-item ${!n.read_at ? 'is-unread' : ''}`}
                            onClick={() => openNotification(n)}
                        >
                            <span className={`ds-notif-dot ${TONE_FOR_TYPE[n.data?.type] || 'ds-badge-default'}`} aria-hidden="true" />
                            <span className="ds-notif-item-body">
                                <span className="ds-notif-item-title">{n.data?.title}</span>
                                <span className="ds-notif-item-message">{n.data?.message}</span>
                                <span className="ds-notif-item-time">{timeAgo(n.created_at)}</span>
                            </span>
                            {!n.read_at && <span className="ds-notif-unread-mark" aria-hidden="true" />}
                        </button>
                    ))}
                </div>

                <div className="ds-menu-divider" />
                <button
                    type="button"
                    className="ds-menu-item"
                    onClick={() => {
                        setOpen(false);
                        navigate('/app/notifications');
                    }}
                    role="menuitem"
                >
                    <Bell size={16} /> View all notifications
                </button>
            </AccountMenu>
        </div>
    );
}
