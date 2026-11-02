import React, { createContext, useContext, useState, useEffect } from 'react';
import axios, { storeTokenPair, getStoredToken, clearStoredToken, restoreSession, restoreWasOffline, readMeCache, writeMeCache, clearOfflineData } from '../config/axiosConfig';
import { clearLoginMemory } from '../utils/welcome';
import { getCurrentSubscription, disablePush } from '../utils/push';
import { clearAllDrafts } from '../utils/autosave';
import { clearImageCaches } from '../utils/imageCache';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    // True after an explicit logout until the next login. ProtectedRoute uses it to
    // send the person to a CLEAN /login (no ?redirect= of the page they just left).
    const [signedOut, setSignedOut] = useState(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            // A tab with no access token may still own a refresh cookie
            // ("Keep me signed in", or another tab of this browser): trade it
            // for a fresh access token before deciding nobody is signed in.
            let token = getStoredToken();
            if (!token && (await restoreSession())) {
                token = getStoredToken();
            }

            if (!token) {
                // Opened with no connection and the session could not be renewed:
                // still draw the app from the last known profile (data stays empty
                // until the connection is back and the session renews itself).
                if (restoreWasOffline()) {
                    const cached = readMeCache();
                    if (cached?.user && !cancelled) {
                        setUser(cached.user);
                        setRoles(cached.roles || []);
                    }
                }
                if (!cancelled) setLoading(false);
                return;
            }

            try {
                const res = await axios.get('/me');
                if (cancelled) return;
                setUser(res.data.user);
                setRoles(res.data.roles);
            } catch (err) {
                if (!err.response || err.response.status >= 500) {
                    // No connection / server unreachable: keep the session and
                    // show the app from the last known profile instead of
                    // signing the person out.
                    const cached = readMeCache();
                    if (cached?.user && !cancelled) {
                        setUser(cached.user);
                        setRoles(cached.roles || []);
                    }
                } else {
                    clearStoredToken();
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    // Keep the offline copy of the profile fresh.
    useEffect(() => {
        if (user) writeMeCache(user, roles);
    }, [user, roles]);

    // Connection came back: re-check who is signed in (renews the session too).
    useEffect(() => {
        if (!user) return undefined;
        const onBack = async () => {
            try {
                const res = await axios.get('/me', { silent: true });
                setUser(res.data.user);
                setRoles(res.data.roles);
            } catch { /* the normal 401 handling decides if the session is really over */ }
        };
        window.addEventListener('online', onBack);
        return () => window.removeEventListener('online', onBack);
    }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

    // If this browser/device is still carrying a push subscription from
    // whoever used it before (a shared campus PC where the previous
    // student didn't explicitly log out), drop it once we know who's
    // actually signed in now, so this session doesn't silently inherit
    // someone else's notifications. A subscription that *does* already
    // belong to the newly signed-in account is left alone, so re-logging
    // in on your own device doesn't force you to re-enable notifications
    // every time.
    const reconcilePushSubscription = async () => {
        try {
            const subscription = await getCurrentSubscription();
            if (!subscription) return;

            const { data } = await axios.get('/push/status', {
                params: { endpoint: subscription.endpoint },
                silent: true,
            });

            if (!data.owned_by_current_user) {
                await subscription.unsubscribe();
            }
        } catch {
            // Best-effort — a leftover subscription that couldn't be
            // checked here still self-heals server-side the next time a
            // push is attempted against it (see WebPushChannel).
        }
    };

    const applySession = async (data, remember) => {
        clearOfflineData(); // never show the previous person's saved screens to the new one
        storeTokenPair(
            { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in },
            remember
        );
        setSignedOut(false);
        setUser(data.user);
        setRoles(data.roles);
        await reconcilePushSubscription();
    };

    // Returns either a completed session ({ user, roles, ... }) or, for an
    // account with 2FA enabled, { two_factor_required: true, temp_token }
    // — the caller (LoginPage) is responsible for switching to the OTP
    // step and holding onto temp_token for verifyTwoFactor() below rather
    // than this resolving into a signed-in state right away.
    const login = async (email, password, remember = false) => {
        const res = await axios.post('/login', { email, password, remember }, { silent: true });

        if (res.data.two_factor_required) {
            return res.data;
        }

        await applySession(res.data, remember);
        return res.data;
    };

    // Second step of a 2FA login: exchange the temp_token (sent as the
    // bearer for this one request only — not stored) + the code from the
    // authenticator app/a recovery code for a real session.
    const verifyTwoFactor = async (tempToken, code, remember = false) => {
        const res = await axios.post(
            '/2fa/login-verify',
            { code, remember },
            { silent: true, headers: { Authorization: `Bearer ${tempToken}` } }
        );
        await applySession(res.data, remember);
        return res.data;
    };

    // Accepts either a plain object or a FormData instance (FormData is
    // required when a profile picture file is attached).
    //
    // silent: true — same reason as login() above. RegisterPage owns its
    // own error handling (per-field highlighting, which wizard step to
    // send them back to, a tailored message for a throttled 429) and
    // shows exactly one toast itself; without `silent` here, the global
    // axios interceptor would *also* fire its own generic toast for the
    // same error, and the person would see two toasts stacked for one
    // failed submit.
    const register = async (payload) => {
        const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
        const res = await axios.post('/register', payload, {
            silent: true,
            ...(isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
        });
        await applySession(res.data, true);
        return res.data;
    };

    // Patches the in-memory user (e.g. after 2FA setup/disable flips
    // two_factor_enabled) without a full /me round-trip — the caller
    // already knows the new value from the response it just got back.
    const updateUser = (patch) => {
        setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    // The mandatory first-login setup an admin-created staff account goes
    // through (SetupAccountPage) — new password + their own name/photo.
    // Patches the in-memory user with the server's response (in
    // particular must_setup_profile: false) so ProtectedRoute stops
    // redirecting back to the setup page the instant this resolves.
    const completeSetup = async (formData) => {
        const res = await axios.post('/profile/complete-setup', formData, {
            silent: true,
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        updateUser(res.data.user);
        return res.data;
    };

    const logout = async () => {
        // Auto Save drafts live in this browser — don't leave one behind for
        // the next person on a shared campus PC.
        clearAllDrafts(user?.id);

        // Fully revoke this device's push subscription on an explicit
        // logout (both the browser side and the server-side row) rather
        // than just reconciling it — someone deliberately signing out on
        // a shared device is the clearest signal that the next person to
        // use it shouldn't inherit anything, and there's no reason to
        // leave a subscription live for an account no longer signed in.
        // Runs before /logout invalidates the token, since removing the
        // server-side row needs an authenticated request.
        try {
            await disablePush((endpoint) => axios.post('/push/unsubscribe', { endpoint }, { silent: true }));
        } catch {
            // Best-effort — same self-healing fallback as elsewhere.
        }

        try {
            await axios.post('/logout');
        } finally {
            // Even if the server call fails (offline, expired token), this browser
            // must stop acting as that person: wipe the session + every leftover.
            setSignedOut(true);
            clearStoredToken();
            clearLoginMemory();
            clearImageCaches(); // private photos must not linger for the next person
            setUser(null);
            setRoles([]);
        }
    };

    return (
        <AuthContext.Provider value={{ user, roles, loading, signedOut, login, verifyTwoFactor, register, logout, updateUser, completeSetup }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
