import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { USER_ROLES } from './utils/constants';
import { API_URL } from './utils/constants';

// Page imports
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import BlogPage from './pages/BlogPage';
import ServicesPage from './pages/ServicesPage';
import SupportJarPage from './pages/SupportJarPage';
import AdminLogin from './pages/AdminLogin';
import ClientDashboard from './pages/ClientDashboard';
import FreelancerDashboard from './pages/FreelancerDashboard';
import FreelancerProfile from './pages/FreelancerProfile';
import ClientProfile from './pages/ClientProfile';
import AdminDashboard from './pages/AdminDashboard';
import AdminTasks from './pages/AdminTasks';
import AdminUsers from './pages/AdminUsers';
import AdminAnalytics from './pages/AdminAnalytics';
import NotFound from './pages/NotFound';
import Loading from './components/common/Loading';

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://tasknexus.vercel.app').replace(/\/$/, '');

const PUBLIC_METADATA = {
    '/': { title: 'TaskNexus', description: 'A focused workspace for organizing tasks, tracking progress, and collaborating around delivery.' },
    '/login': { title: 'Login | TaskNexus', description: 'Sign in to your TaskNexus workspace.' },
    '/register': { title: 'Create Account | TaskNexus', description: 'Create a TaskNexus client or freelancer account.' },
    '/services': { title: 'Services | TaskNexus', description: 'Explore the services currently available through TaskNexus.' },
    '/blog': { title: 'Blog | TaskNexus', description: 'Practical notes on better work, delivery, and collaboration.' },
    '/support-jar': { title: 'Support Jar | TaskNexus', description: 'Support the ongoing development of TaskNexus.' },
    '/admin/login': { title: 'Admin Login | TaskNexus', description: 'Restricted TaskNexus administrator access.', noindex: true },
};

const RouteMetadata = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        const isPrivate = /^(\/client|\/freelancer|\/admin)(\/|$)/.test(pathname);
        const metadata = PUBLIC_METADATA[pathname] || {
            title: isPrivate ? 'Workspace | TaskNexus' : 'Page Not Found | TaskNexus',
            description: 'TaskNexus workspace.',
            noindex: true,
        };

        document.title = metadata.title;
        const description = document.querySelector('meta[name="description"]');
        const robots = document.querySelector('meta[name="robots"]');
        const canonical = document.querySelector('link[rel="canonical"]');
        if (description) description.setAttribute('content', metadata.description);
        if (robots) robots.setAttribute('content', metadata.noindex || isPrivate ? 'noindex, nofollow' : 'index, follow');
        if (canonical) canonical.setAttribute('href', `${SITE_URL}${pathname === '/' ? '/' : pathname}`);
    }, [pathname]);

    return null;
};

/**
 * Main App Component
 */
function App() {
    // Warm the backend (Render spins down) as soon as the app loads.
    useEffect(() => {
        const controller = new AbortController();
        const warm = async () => {
            try {
                const base = API_URL.replace(/\/api\/?$/, '');
                const healthUrl = `${base}/health`;
                const apiHealthUrl = `${base}/api/health`;

                const doPing = async (url) => {
                    const res = await fetch(url, {
                        signal: controller.signal,
                        credentials: 'include',
                        cache: 'no-cache',
                    });
                    return res.ok;
                };

                const ok = await doPing(healthUrl);
                if (!ok) await doPing(apiHealthUrl);
            } catch (err) {
                const isAbort = err?.name === 'AbortError' || controller.signal.aborted;
                if (isAbort) return;
            }
        };
        warm();
        return () => controller.abort();
    }, []);

    return (
        <AuthProvider>
            <Router
                future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                }}
            >
                <div className="shell">
                    <RouteMetadata />
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
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return <Loading fullScreen={true} text="Checking your session..." />;
    }

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
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/support-jar" element={<SupportJarPage />} />
            <Route path="/admin/login" element={
                isAuthenticated && user?.role === 'admin' ? <Navigate to="/admin/dashboard" /> : <AdminLogin />
            } />

            {/* Client Routes */}
            <Route path="/client/dashboard" element={
                <ProtectedRoute allowedRoles={[USER_ROLES.CLIENT]}>
                    <ClientDashboard />
                </ProtectedRoute>
            } />
            <Route path="/client/profile" element={
                <ProtectedRoute allowedRoles={[USER_ROLES.CLIENT]}>
                    <ClientProfile />
                </ProtectedRoute>
            } />

            {/* Freelancer Routes */}
            <Route path="/freelancer/dashboard" element={
                <ProtectedRoute allowedRoles={[USER_ROLES.FREELANCER]}>
                    <FreelancerDashboard />
                </ProtectedRoute>
            } />
            <Route path="/freelancer/profile" element={
                <ProtectedRoute allowedRoles={[USER_ROLES.FREELANCER]}>
                    <FreelancerProfile />
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
