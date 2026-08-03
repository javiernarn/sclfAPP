import React, { createContext, useContext, useState, useEffect } from 'react';
import axios, { refreshAuthToken, getStoredToken, clearStoredToken } from '../config/axiosConfig';

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

    const login = async (email, password, remember = false) => {
        const res = await axios.post('/login', { email, password }, { silent: true });
        refreshAuthToken(res.data.token, remember);
        setUser(res.data.user);
        setRoles(res.data.roles);
        return res.data;
    };

    // Accepts either a plain object or a FormData instance (FormData is
    // required when a profile picture file is attached).
    const register = async (payload) => {
        const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
        const res = await axios.post('/register', payload, isFormData
            ? { headers: { 'Content-Type': 'multipart/form-data' } }
            : undefined);
        refreshAuthToken(res.data.token, true);
        setUser(res.data.user);
        setRoles(res.data.roles);
        return res.data;
    };

    const logout = async () => {
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