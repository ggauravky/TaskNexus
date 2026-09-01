import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { clearAccessToken, setAccessToken } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Reconcile authentication with the server before rendering protected routes.
    useEffect(() => {
        let active = true;

        const clearAuthState = () => {
            clearAccessToken();
            if (active) {
                setUser(null);
                setIsAuthenticated(false);
            }
        };

        const initAuth = async () => {
            try {
                const response = await authService.getCurrentUser();
                if (active && response?.data?.user) {
                    setUser(response.data.user);
                    setIsAuthenticated(true);
                }
            } catch (error) {
                clearAuthState();
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        const handleExpiredSession = () => clearAuthState();
        window.addEventListener('tasknexus:auth-expired', handleExpiredSession);
        initAuth();

        return () => {
            active = false;
            window.removeEventListener('tasknexus:auth-expired', handleExpiredSession);
        };
    }, []);

    /**
     * Login user
     */
    const login = async (credentials) => {
        try {
            const response = await authService.login(credentials);
            const { user, accessToken } = response.data;

            setAccessToken(accessToken);
            setUser(user);
            setIsAuthenticated(true);

            toast.success(response.message || 'Login successful');

            return { success: true, user };
        } catch (error) {
            const message = error.response?.data?.error?.message || 'Login failed';
            toast.error(message);
            return { success: false, error: message };
        }
    };

    /**
     * Register new user
     */
    const register = async (userData) => {
        try {
            const response = await authService.register(userData);
            const { user, accessToken } = response.data;

            setAccessToken(accessToken);
            setUser(user);
            setIsAuthenticated(true);

            toast.success(response.message || 'Registration successful');

            return { success: true, user };
        } catch (error) {
            console.error('Registration error:', error.response?.data);
            const errorData = error.response?.data?.error;

            // Show detailed validation errors if available
            if (errorData?.details && Array.isArray(errorData.details)) {
                errorData.details.forEach(err => {
                    toast.error(`${err.field}: ${err.message}`);
                });
            } else {
                const message = errorData?.message || 'Registration failed';
                toast.error(message);
            }

            return { success: false, error: errorData?.message || 'Registration failed', details: errorData?.details };
        }
    };

    /**
     * Logout user
     */
    const logout = async ({ silent = false } = {}) => {
        try {
            await authService.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear state
            setUser(null);
            setIsAuthenticated(false);

            clearAccessToken();

            if (!silent) toast.success('Logged out successfully');
        }
    };

    /**
     * Update the current in-memory user state.
     */
    const updateUser = (updatedUser) => {
        setUser(updatedUser);
    };

    const value = {
        user,
        isAuthenticated,
        loading,
        login,
        register,
        logout,
        updateUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
