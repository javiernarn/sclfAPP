// Small, dependency-free reader for a raw User-Agent string — mirrors the
// backend's App\Support\UserAgentParser so labels match wherever they're
// shown (Audit Log, Admin > User Activity, Admin > User Detail). Not a full
// UA database; just enough for a friendly display label.

export function parseUserAgent(userAgent) {
    const ua = (userAgent || '').trim();

    if (!ua) {
        return { deviceType: 'unknown', platform: null, browser: null, label: 'Unknown device' };
    }

    if (/bot|crawler|spider|curl|wget|postman|python-requests|axios\/|guzzlehttp/i.test(ua)) {
        return { deviceType: 'bot', platform: null, browser: null, label: 'Bot / script' };
    }

    const platform = (() => {
        if (/iPhone/i.test(ua)) return 'iPhone';
        if (/iPad/i.test(ua)) return 'iPad';
        if (/Android/i.test(ua)) return 'Android';
        if (/Windows NT/i.test(ua)) return 'Windows';
        if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
        if (/CrOS/i.test(ua)) return 'ChromeOS';
        if (/Linux/i.test(ua)) return 'Linux';
        return null;
    })();

    const browser = (() => {
        if (/EdgA|EdgiOS|Edge|Edg\//i.test(ua)) return 'Edge';
        if (/OPR\/|Opera/i.test(ua)) return 'Opera';
        if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
        if (/FBAN|FBAV/i.test(ua)) return 'Facebook In-App Browser';
        if (/Instagram/i.test(ua)) return 'Instagram In-App Browser';
        if (/CriOS/i.test(ua)) return 'Chrome';
        if (/Firefox|FxiOS/i.test(ua)) return 'Firefox';
        if (/Chrome\//i.test(ua)) return 'Chrome';
        if (/Safari/i.test(ua)) return 'Safari';
        return null;
    })();

    const deviceType = (() => {
        if (platform === 'iPad' || /Tablet|Nexus 7|Nexus 10/i.test(ua)) return 'tablet';
        if (platform === 'iPhone' || (/Android/i.test(ua) && /Mobile/i.test(ua)) || /Mobile Safari|IEMobile|BlackBerry/i.test(ua)) return 'mobile';
        if (['Windows', 'macOS', 'Linux', 'ChromeOS'].includes(platform)) return 'desktop';
        return 'unknown';
    })();

    const label = [platform, browser].filter(Boolean).join(' · ') || 'Unknown device';

    return { deviceType, platform, browser, label };
}

export function deviceIconName(deviceType) {
    switch (deviceType) {
        case 'mobile': return 'Smartphone';
        case 'tablet': return 'Tablet';
        case 'bot': return 'Bot';
        case 'desktop': return 'Monitor';
        default: return 'Monitor';
    }
}
