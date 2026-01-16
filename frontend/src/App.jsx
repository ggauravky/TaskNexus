import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { USER_ROLES } from './utils/constants';

// Page imports (placeholders - to be created)
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminLogin from './pages/AdminLogin';
import ClientDashboard from './pages/ClientDashboard';
import FreelancerDashboard from './pages/FreelancerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminTasks from './pages/AdminTasks';
import AdminUsers from './pages/AdminUsers';
import AdminAnalytics from './pages/AdminAnalytics';
import NotFound from './pages/NotFound';
import TestPage from './pages/TestPage';

/**
 * Main App Component
 */
function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="min-h-screen bg-gray-50">
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            duration: 4000,
                            style: {
                                background: '#fff',
                                color: '#363636',
                            },
                            success: {
                                iconTheme: {
                                    primary: '#10b981',
                                    secondary: '#fff',
                                },
                            },
                            error: {
                                iconTheme: {
                                    primary: '#ef4444',
                                    secondary: '#fff',
                                },
                            },
                        }}
                    />

                    <AppRoutes />
                </div>
            </Router>
        </AuthProvider>
    );
}

/**
 * Application Routes
 */
function AppRoutes() {
    const { isAuthenticated, user } = useAuth();

    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/" element={
                isAuthenticated ? <Navigate to={getDashboardRoute(user?.role)} /> : <LandingPage />
            } />
            <Route path="/login" element={
                isAuthenticated ? <Navigate to={getDashboardRoute(user?.role)} /> : <Login />
            } />
            <Route path="/register" element={
                isAuthenticated ? <Navigate to={getDashboardRoute(user?.role)} /> : <Register />
            } />
            <Route path="/admin/login" element={
                isAuthenticated && user?.role === 'admin' ? <Navigate to="/admin/dashboard" /> : <AdminLogin />
            } />

            {/* Test Route - for debugging */}
            <Route path="/test" element={<TestPage />} />
            <Route path="/client/test" element={<ClientDashboard />} />
            <Route path="/freelancer/test" element={<FreelancerDashboard />} />

            {/* Client Routes */}
            <Route path="/client/dashboard" element={
                <ProtectedRoute allowedRoles={[USER_ROLES.CLIENT]}>
                    <ClientDashboard />
                </ProtectedRoute>
            } />

            {/* Freelancer Routes */}
            <Route path="/freelancer/dashboard" element={
                <ProtectedRoute allowedRoles={[USER_ROLES.FREELANCER]}>
                    <FreelancerDashboard />
                </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={
                <ProtectedRoute allowedRoles={[USER_ROLES.ADMIN]}>
                    <AdminDashboard />
                </ProtectedRoute>
            } />
            <Route path="/admin/tasks" element={
                <ProtectedRoute allowedRoles={[USER_ROLES.ADMIN]}>
                    <AdminTasks />
                </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
                <ProtectedRoute allowedRoles={[USER_ROLES.ADMIN]}>
                    <AdminUsers />
                </ProtectedRoute>
            } />
            <Route path="/admin/analytics" element={
                <ProtectedRoute allowedRoles={[USER_ROLES.ADMIN]}>
                    <AdminAnalytics />
                </ProtectedRoute>
            } />

            {/* 404 Not Found */}
            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}

/**
 * Get dashboard route based on user role
 */
function getDashboardRoute(role) {
    const routes = {
        [USER_ROLES.CLIENT]: '/client/dashboard',
        [USER_ROLES.FREELANCER]: '/freelancer/dashboard',
        [USER_ROLES.ADMIN]: '/admin/dashboard'
    };
    return routes[role] || '/';
}

export default App;
