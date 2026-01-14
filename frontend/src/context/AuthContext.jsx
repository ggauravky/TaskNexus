import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { LOCAL_STORAGE_KEYS } from '../utils/constants';
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

    // Initialize auth state from localStorage
    useEffect(() => {
        const initAuth = () => {
            try {
                const storedUser = localStorage.getItem(LOCAL_STORAGE_KEYS.USER);
                const storedToken = localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);

                if (storedUser && storedToken) {
                    setUser(JSON.parse(storedUser));
                    setIsAuthenticated(true);
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
                localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
                localStorage.removeItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    /**
     * Login user
     */
    const login = async (credentials) => {
        try {
            const response = await authService.login(credentials);
            const { user, accessToken } = response.data;

            // Store in state
            setUser(user);
            setIsAuthenticated(true);

            // Store in localStorage
            localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(user));
            localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, accessToken);

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

            // Store in state
            setUser(user);
            setIsAuthenticated(true);

            // Store in localStorage
            localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(user));
            localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, accessToken);

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
    const logout = async () => {
        try {
            await authService.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear state
            setUser(null);
            setIsAuthenticated(false);

            // Clear localStorage
            localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
            localStorage.removeItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);

            toast.success('Logged out successfully');
        }
    };

    /**
     * Update user in state and localStorage
     */
    const updateUser = (updatedUser) => {
        setUser(updatedUser);
        localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(updatedUser));
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
