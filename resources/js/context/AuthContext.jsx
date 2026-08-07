import React, { createContext, useContext, useState, useEffect } from 'react';
import axios, { refreshAuthToken, getStoredToken, clearStoredToken } from '../config/axiosConfig';
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

    const login = async (email, password, remember = false) => {
        const res = await axios.post('/login', { email, password }, { silent: true });
        refreshAuthToken(res.data.token, remember);
        setUser(res.data.user);
        setRoles(res.data.roles);
        await reconcilePushSubscription();
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
        refreshAuthToken(res.data.token, true);
        setUser(res.data.user);
        setRoles(res.data.roles);
        await reconcilePushSubscription();
        return res.data;
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
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        setRoles([]);
    };

    return (
        <AuthContext.Provider value={{ user, roles, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);