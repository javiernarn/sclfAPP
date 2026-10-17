// Mirrors App\Notifications\SclfNotification::ROUTES on the backend (and,
// by extension, the email's "Login" deep link / the web push tap target)
// so that wherever a notification is opened from — the header bell, the
// full /app/notifications page, an emailed link, or a push notification —
// it lands the person on the exact same screen.
export const NOTIFICATION_ROUTE_FOR_TYPE = {
    'App\\Models\\Claim': (id) => `/app/claims/${id}`,
    'App\\Models\\LostItem': (id) => `/app/lost-items/${id}/matches`,
    'App\\Models\\FoundItem': (id) => `/app/found-items/${id}`,
    'App\\Models\\SecurityIncident': (id) => `/app/incidents/${id}`,
    'App\\Models\\ServiceRequest': (id) => `/app/service-requests/${id}`,
    'App\\Models\\ActionRequest': (id) => `/app/admin/requests?request=${id}`,
};

// A notification's `data` payload (see SclfNotification::toArray) always
// carries related_type/related_id when it points at something specific;
// falls back to the Notifications list itself for anything else (or a
// type not in the map above).
export function routeForNotification(n) {
    // A notification can carry its own role-aware deep link (e.g. handlers
    // are sent to the review queue) — it wins over the per-model route.
    const link = n?.data?.link;
    if (typeof link === 'string' && link.startsWith('/app/')) {
        return link;
    }
    const relatedType = n?.data?.related_type;
    const relatedId = n?.data?.related_id;
    if (relatedType && relatedId && NOTIFICATION_ROUTE_FOR_TYPE[relatedType]) {
        return NOTIFICATION_ROUTE_FOR_TYPE[relatedType](relatedId);
    }
    return '/app/notifications';
}

// Like routeForNotification, but returns null when the notification points
// at nothing specific (no deep link, or a related model we have no screen
// for). Callers use null to open the notification's own detail view
// instead of bouncing the person to a page that is not about it.
export function destinationForNotification(n) {
    const link = n?.data?.link;
    if (typeof link === 'string' && link.startsWith('/app/')) return link;
    const relatedType = n?.data?.related_type;
    const relatedId = n?.data?.related_id;
    if (relatedType && relatedId && NOTIFICATION_ROUTE_FOR_TYPE[relatedType]) {
        return NOTIFICATION_ROUTE_FOR_TYPE[relatedType](relatedId);
    }
    return null;
}

// Friendly name for where a notification leads, for the "Open …" button.
const DESTINATION_LABEL = {
    'App\\Models\\Claim': 'claim',
    'App\\Models\\LostItem': 'lost item',
    'App\\Models\\FoundItem': 'found item',
    'App\\Models\\SecurityIncident': 'incident',
    'App\\Models\\ServiceRequest': 'service request',
    'App\\Models\\ActionRequest': 'request',
};
export const destinationLabel = (n) => DESTINATION_LABEL[n?.data?.related_type] || 'page';
