import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../utils/constants';

/**
 * Protected Route Component
 * Restricts access based on authentication and role
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    console.log('[ProtectedRoute] Rendering', { allowedRoles });
    const { isAuthenticated, user, loading } = useAuth();
    const location = useLocation();
    console.log('[ProtectedRoute] Auth state:', { isAuthenticated, user, loading });

    // Show loading state
    if (loading) {
        console.log('[ProtectedRoute] Showing loading state');
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check role access
    if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
        // Redirect to appropriate dashboard based on role
        const dashboardRoutes = {
            [USER_ROLES.CLIENT]: '/client/dashboard',
            [USER_ROLES.FREELANCER]: '/freelancer/dashboard',
            [USER_ROLES.ADMIN]: '/admin/dashboard'
        };

        return <Navigate to={dashboardRoutes[user.role] || '/'} replace />;
    }

    return children;
};

export default ProtectedRoute;
