import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * public/sw.js's notificationclick handler focuses an already-open SCLF
 * tab (if one exists) and postMessages it the target route, rather than
 * doing a hard navigation itself — a service worker can't reach into
 * React Router directly. This hook is what's listening on the other end,
 * so tapping a push notification while SCLF is already open in the
 * background takes you straight to the relevant claim/match/item instead
 * of just refocusing whatever page happened to be showing.
 */
export default function useServiceWorkerNavigation() {
    const navigate = useNavigate();

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const onMessage = (event) => {
            if (event.data?.type === 'sclf-notification-click' && event.data?.url) {
                navigate(event.data.url);
            }
        };

        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [navigate]);
}
