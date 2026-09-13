import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../utils/constants';
import AuthenticatedLayout from '../layout/AuthenticatedLayout';

/**
 * Protected Route Component
 * Restricts access based on authentication and role
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { isAuthenticated, user, loading } = useAuth();
    const location = useLocation();

    // Show loading state
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#010102] text-[#f7f8f8]">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent"></div>
                    <p className="mt-4 text-sm text-[#8a8f98]">Loading...</p>
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

    return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
};

export default ProtectedRoute;
