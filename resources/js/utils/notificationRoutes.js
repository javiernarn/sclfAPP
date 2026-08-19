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
    'App\\Models\\Asset': (id) => `/app/security/assets/${id}`,
};

// A notification's `data` payload (see SclfNotification::toArray) always
// carries related_type/related_id when it points at something specific;
// falls back to the Notifications list itself for anything else (or a
// type not in the map above).
export function routeForNotification(n) {
    const relatedType = n?.data?.related_type;
    const relatedId = n?.data?.related_id;
    if (relatedType && relatedId && NOTIFICATION_ROUTE_FOR_TYPE[relatedType]) {
        return NOTIFICATION_ROUTE_FOR_TYPE[relatedType](relatedId);
    }
    return '/app/notifications';
}
