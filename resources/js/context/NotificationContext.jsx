import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from '../config/axiosConfig';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

// How often the header bell's badge is refreshed while the app sits idle.
// Short enough that a new notification shows up without a reload, long
// enough not to hammer the API — the same tradeoff the existing web push
// system exists to cover for anything more time-critical than this.
const POLL_MS = 30000;

// Small preview list shown in the bell's dropdown — the full history
// still lives at /app/notifications (NotificationsPage), which paginates
// separately and isn't affected by this.
const PREVIEW_LIMIT = 8;

/**
 * Wraps the authenticated part of the app (see main.jsx). Centralizes the
 * "how many notifications does this account have, and are they read or
 * unread" state so the header bell, the sidebar's "Notifications" nav
 * badge, and the full Notifications page all agree with each other —
 * marking something read from any one of them updates the others without
 * a manual refresh.
 *
 * Role-agnostic by construction: it only ever calls the current session's
 * own /notifications endpoints (see NotificationController), which are
 * themselves scoped to $request->user() on the backend. A student,
 * instructor, security officer, or admin all get their own counts for
 * free — there's nothing role-specific in this file.
 */
export function NotificationProvider({ children }) {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [recent, setRecent] = useState([]);
    const [loadingRecent, setLoadingRecent] = useState(false);
    const pollRef = useRef(null);

    const refreshUnreadCount = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await axios.get('/notifications/unread-count', { silent: true });
            setUnreadCount(data.unread_count || 0);
        } catch {
            // Best-effort — a failed poll just tries again next interval,
            // no need to surface it to the person.
        }
    }, [user]);

    const refreshRecent = useCallback(async () => {
        if (!user) return;
        setLoadingRecent(true);
        try {
            const { data } = await axios.get('/notifications', {
                params: { limit: PREVIEW_LIMIT },
                silent: true,
            });
            setRecent(data.notifications || []);
            setUnreadCount(data.unread_count || 0);
        } catch {
            // ignore — dropdown just stays on whatever it last had
        } finally {
            setLoadingRecent(false);
        }
    }, [user]);

    const markAsRead = useCallback(async (id) => {
        // Optimistic — the bell/list should feel instant, not wait on a
        // round trip before the "New" pill disappears.
        setRecent((list) => list.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
        try {
            await axios.post(`/notifications/${id}/read`);
        } catch {
            // Reconcile with the server if the optimistic update was wrong
            // (e.g. it was already read elsewhere, or the request failed).
            refreshUnreadCount();
        }
    }, [refreshUnreadCount]);

    const markAllAsRead = useCallback(async () => {
        setRecent((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
        setUnreadCount(0);
        try {
            await axios.post('/notifications/read-all');
        } catch {
            refreshUnreadCount();
        }
    }, [refreshUnreadCount]);

    // Initial load + poll while a session exists; torn down entirely on
    // logout so a signed-out tab doesn't keep hitting the API.
    useEffect(() => {
        if (!user) {
            setUnreadCount(0);
            setRecent([]);
            return;
        }

        refreshUnreadCount();

        pollRef.current = setInterval(refreshUnreadCount, POLL_MS);

        // Also catch up immediately when the tab regains focus — covers
        // the common case of a notification arriving while the browser
        // was in the background/another tab.
        const onFocus = () => refreshUnreadCount();
        window.addEventListener('focus', onFocus);

        return () => {
            clearInterval(pollRef.current);
            window.removeEventListener('focus', onFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    return (
        <NotificationContext.Provider
            value={{
                unreadCount,
                recent,
                loadingRecent,
                refreshUnreadCount,
                refreshRecent,
                markAsRead,
                markAllAsRead,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return ctx;
}
