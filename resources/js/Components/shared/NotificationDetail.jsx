import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Bell } from '../icons';
import { destinationForNotification, destinationLabel } from '../../utils/notificationRoutes';
import './NotificationDetail.css';

const humanize = (t) => String(t || 'notification').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * Full read-out of one notification, for when the bell/list preview is too
 * short or the notification has nowhere to send the person. Rendered into
 * the .ds-shell element (not <body>) so it inherits the active theme tokens.
 */
export default function NotificationDetail({ notification, onClose, onOpenRelated }) {
    useEffect(() => {
        if (!notification) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [notification, onClose]);

    if (!notification) return null;
    const n = notification;
    const dest = destinationForNotification(n);
    const when = n.created_at ? new Date(n.created_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }) : '—';
    const readAt = n.read_at ? new Date(n.read_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null;
    const host = document.querySelector('.ds-shell') || document.body;

    return createPortal(
        <div className="ds-nd-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="ds-nd-card" role="dialog" aria-modal="true" aria-label="Notification details">
                <div className="ds-nd-head">
                    <span className="ds-nd-icon"><Bell size={17} /></span>
                    <div className="ds-nd-head-text">
                        <span className="ds-nd-kind">{humanize(n.data?.type)}</span>
                        <h3 className="ds-nd-title">{n.data?.title || 'Notification'}</h3>
                    </div>
                    <button type="button" className="ds-nd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </div>

                <div className="ds-nd-body">
                    <p className="ds-nd-message">{n.data?.message || 'No further details were included with this notification.'}</p>

                    <dl className="ds-nd-meta">
                        <div><dt>Received</dt><dd>{when}</dd></div>
                        <div><dt>Status</dt><dd>{readAt ? `Read · ${readAt}` : 'Unread'}</dd></div>
                        {n.data?.related_id && <div><dt>Reference</dt><dd>#{n.data.related_id}</dd></div>}
                    </dl>
                </div>

                <div className="ds-nd-actions">
                    {dest && (
                        <button type="button" className="ds-btn ds-btn-primary" onClick={() => onOpenRelated(dest)}>
                            <ExternalLink size={15} /> Open {destinationLabel(n)}
                        </button>
                    )}
                    <button type="button" className="ds-btn ds-btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>,
        host
    );
}
