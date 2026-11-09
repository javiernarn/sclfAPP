// systemMode.js — the whole-site screen switch.
//
//   off         -> normal app (SCLF_SYSTEM_MODE=false)
//   default     -> ONLY the "System not available" screen   (SCLF_SYSTEM_MODE=true)
//   maintenance -> ONLY the Maintenance screen               (SCLF_SYSTEM_MODE=maintenance)
//   error       -> ONLY the "Oops! Something went wrong"     (SCLF_SYSTEM_MODE=error)
//
// The value is read on the server (.env SCLF_SYSTEM_MODE) and written on
// <html data-system-mode="..."> before the app starts (resources/views/app.blade.php),
// so changing it needs `php artisan config:clear`, not a rebuild. Anything
// unrecognised means "off": a typo can never lock everybody out.
//
// Handy while developing (npm run dev only): add ?system=maintenance (or
// error / true / false) to any page URL.

export const SYSTEM_MODES = ['off', 'default', 'maintenance', 'error'];

const ALIASES = {
    true: 'default',
    '1': 'default',
    on: 'default',
    yes: 'default',
    default: 'default',
    maintenance: 'maintenance',
    maint: 'maintenance',
    error: 'error',
};

export const normalizeSystemMode = (value) => {
    const v = String(value ?? '').trim().toLowerCase();
    return ALIASES[v] ?? 'off';
};

export const getSystemMode = () => {
    if (typeof document === 'undefined') return 'off';
    if (import.meta.env?.DEV) {
        const q = new URLSearchParams(window.location.search).get('system');
        if (q !== null) return normalizeSystemMode(q);
    }
    return normalizeSystemMode(document.documentElement.getAttribute('data-system-mode'));
};
