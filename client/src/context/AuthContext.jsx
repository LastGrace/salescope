import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    const logout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        setToken(null);
        if (window.electronAPI) {
            window.electronAPI.notifyLogout();
        }
    };

    useEffect(() => {
        const storedToken = sessionStorage.getItem('token');
        const storedUser = sessionStorage.getItem('user');
        if (storedToken && storedUser) {
            try {
                setUser(JSON.parse(storedUser));
                setToken(storedToken);
                axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            } catch (e) {
                console.error("Failed to parse user", e);
                logout();
            }
            // Resume WhatsApp if session is still valid
            if (window.electronAPI) {
                window.electronAPI.notifyLogin();
            }
        }
        setLoading(false);

        // Add interceptor to handle 401/403 responses
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    const login = async (username, password) => {
        try {
            const res = await axios.post('/api/auth/login', { username, password });
            const { token: newToken, user: newUser } = res.data;
            sessionStorage.setItem('token', newToken);
            sessionStorage.setItem('user', JSON.stringify(newUser));
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            setUser(newUser);
            setToken(newToken);
            if (window.electronAPI) {
                window.electronAPI.notifyLogin();
            }
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    // Refresh user permissions from server
    const refreshPermissions = async () => {
        try {
            const res = await axios.get('/api/auth/me');
            const updatedUser = res.data;
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);
            return updatedUser;
        } catch (err) {
            console.error('Failed to refresh permissions:', err);
            return null;
        }
    };

    const hasPermission = React.useCallback((permission) => {
        if (!user) return false;
        if (user.is_admin) return true; // Admin has all permissions
        if (!user.permissions) return false;
        return user.permissions.includes(permission);
    }, [user]);

    // Check if user has any of the specified permissions
    const hasAnyPermission = React.useCallback((permissions) => {
        if (!user) return false;
        if (user.is_admin) return true;
        if (!user.permissions) return false;
        return permissions.some(p => user.permissions.includes(p));
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            loading,
            hasPermission,
            hasAnyPermission,
            refreshPermissions
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
