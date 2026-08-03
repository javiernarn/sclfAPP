import { useEffect, useState, useCallback } from 'react';

// Same pattern as alumniAPP's useAppTheme: cookie-backed, synced across
// tabs with BroadcastChannel, drives both the PWA manifest color and
// every "loading" / auth screen so nothing ever drifts out of sync.
//
// Themes: 'white' (Default/light) and 'black' (Dark) are the two plain
// modes — these are the only two the public auth pages (login/register)
// ever toggle between. Once inside the dashboard, the account menu's
// "Theme" picker additionally offers three light, color-tinted themes:
// 'maroon', 'blue', and 'yellow'. All five share the same cookie/storage
// so the choice persists and stays in sync across tabs either way.
const COOKIE_NAME = 'sclf-theme';
const CHANNEL_NAME = 'sclf-theme-channel';
export const THEMES = ['white', 'black', 'maroon', 'blue', 'yellow'];

const readCookie = () => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    const value = match ? decodeURIComponent(match[1]) : 'white';
    return THEMES.includes(value) ? value : 'white';
};

const writeCookie = (theme) => {
    document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
};

export function useAppTheme() {
    const [theme, setThemeState] = useState(() =>
        typeof document !== 'undefined' ? readCookie() : 'white'
    );

    useEffect(() => {
        let channel;
        try {
            channel = new BroadcastChannel(CHANNEL_NAME);
            channel.onmessage = (e) => {
                if (THEMES.includes(e.data)) setThemeState(e.data);
            };
        } catch (e) {
            // BroadcastChannel unsupported — theme just won't live-sync across tabs.
        }
        return () => channel && channel.close();
    }, []);

    const setTheme = useCallback((next) => {
        if (!THEMES.includes(next)) return;
        writeCookie(next);
        setThemeState(next);
        try {
            new BroadcastChannel(CHANNEL_NAME).postMessage(next);
        } catch (e) {
            // no-op
        }
    }, []);

    // Binary light/dark toggle — used by the public auth pages, which only
    // ever offer a plain sun/moon switch (no color-theme picker there,
    // since we don't know the student's program until they're logged in).
    // Toggling from any color theme falls back to plain 'black', not back
    // to whichever color it was.
    const toggleTheme = useCallback(() => {
        setTheme(theme === 'white' ? 'black' : 'white');
    }, [theme, setTheme]);

    return { theme, setTheme, toggleTheme };
}

export default useAppTheme;
