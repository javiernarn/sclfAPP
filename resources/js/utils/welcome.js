// "Welcome" vs "Welcome back" — one place so the sign-in toast and every
// dashboard heading agree.
//
// The server decides (users.last_login_at is NULL until the first
// completed sign-in and returns `first_login` on login / 2FA-verify /
// register). The client keeps that answer in sessionStorage for the
// lifetime of the tab so a refresh mid-session still greets the same
// way; it is cleared on logout so the next person on a shared PC isn't
// greeted as a first-timer.
const FIRST_LOGIN_KEY = 'sclf-first-login';
const LOGIN_TOAST_KEY = 'sclf-login-toast';

const safe = (fn) => {
    try { return fn(); } catch { return undefined; }
};

export function rememberLogin(firstLogin) {
    safe(() => {
        if (firstLogin) window.sessionStorage.setItem(FIRST_LOGIN_KEY, '1');
        else window.sessionStorage.removeItem(FIRST_LOGIN_KEY);
    });
}

export function clearLoginMemory() {
    safe(() => {
        window.sessionStorage.removeItem(FIRST_LOGIN_KEY);
        window.sessionStorage.removeItem(LOGIN_TOAST_KEY);
    });
}

export const isFirstLogin = () => safe(() => window.sessionStorage.getItem(FIRST_LOGIN_KEY) === '1') === true;

// "Welcome, John" for a first session, "Welcome back, John" afterwards.
export function welcomeHeading(name) {
    const who = name ? `, ${name}` : '';
    return isFirstLogin() ? `Welcome${who}` : `Welcome back${who}`;
}

// Content for the toast shown once the person lands on their dashboard.
export function loginToast() {
    return isFirstLogin()
        ? { title: 'Welcome', message: 'You have signed in for the first time. Glad to have you at SCLF!' }
        : { title: 'Welcome back', message: 'You have successfully signed in.' };
}
