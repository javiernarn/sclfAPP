import React, { createContext, useContext, useState, useEffect } from 'react';
import axios, { storeTokenPair, getStoredToken, clearStoredToken } from '../config/axiosConfig';
import { getCurrentSubscription, disablePush } from '../utils/push';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = getStoredToken();
        if (!token) {
            setLoading(false);
            return;
        }

        axios.get('/me')
            .then(res => {
                setUser(res.data.user);
                setRoles(res.data.roles);
            })
            .catch(() => {
                clearStoredToken();
            })
            .finally(() => setLoading(false));
    }, []);

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
        storeTokenPair(
            { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in },
            remember
        );
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
        const res = await axios.post('/login', { email, password }, { silent: true });

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
            { code },
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

    const logout = async () => {
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

        await axios.post('/logout');
        clearStoredToken();
        setUser(null);
        setRoles([]);
    };

    return (
        <AuthContext.Provider value={{ user, roles, loading, login, verifyTwoFactor, register, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
