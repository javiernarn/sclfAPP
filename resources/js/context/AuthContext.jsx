import React, { createContext, useContext, useState, useEffect } from 'react';
import axios, { refreshAuthToken } from '../config/axiosConfig';
import secureLocalStorage from 'react-secure-storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = secureLocalStorage.getItem('access_token');
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
                secureLocalStorage.removeItem('access_token');
            })
            .finally(() => setLoading(false));
    }, []);

    const login = async (email, password) => {
        const res = await axios.post('/login', { email, password });
        refreshAuthToken(res.data.token);
        setUser(res.data.user);
        setRoles(res.data.roles);
        return res.data;
    };

    const register = async (name, email, password, password_confirmation) => {
        const res = await axios.post('/register', { name, email, password, password_confirmation });
        refreshAuthToken(res.data.token);
        setUser(res.data.user);
        setRoles(res.data.roles);
        return res.data;
    };

    const logout = async () => {
        await axios.post('/logout');
        secureLocalStorage.removeItem('access_token');
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