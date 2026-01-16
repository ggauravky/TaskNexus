import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Admin Login Page
 * Dedicated login interface for system administrators with enhanced security messaging
 */
const AdminLogin = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const result = await login(formData);

        if (result.success) {
            // Verify admin role
            if (result.user.role === 'admin') {
                toast.success('Admin access granted');
                navigate('/admin/dashboard');
            } else {
                // Not an admin - logout and show error
                toast.error('Access denied. Admin credentials required.');
                // Redirect non-admin users to their appropriate dashboard
                const roleRoutes = {
                    client: '/client/dashboard',
                    freelancer: '/freelancer/dashboard'
                };
                navigate(roleRoutes[result.user.role] || '/login');
            }
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

            <div className="max-w-md w-full space-y-8 relative z-10">
                {/* Header Section */}
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-500/50">
                            <Shield className="w-12 h-12 text-white" />
                        </div>
                    </div>
                    <h2 className="text-4xl font-bold text-white mb-2">
                        Admin Portal
                    </h2>
                    <p className="text-blue-200 text-sm">
                        TaskNexus Administration System
                    </p>
                </div>

                {/* Security Notice */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex items-start">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                            <p className="text-sm text-yellow-200 font-medium mb-1">
                                Authorized Access Only
                            </p>
                            <p className="text-xs text-yellow-300/80">
                                This is a restricted area. All login attempts are monitored and logged.
                                Unauthorized access is strictly prohibited.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Login Form */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-blue-100 mb-2">
                                Administrator Email
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-blue-300" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="appearance-none relative block w-full pl-10 pr-3 py-3 bg-white/5 border border-white/20 placeholder-blue-300/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="admin@tasknexus.com"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-blue-100 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-blue-300" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="appearance-none relative block w-full pl-10 pr-12 py-3 bg-white/5 border border-white/20 placeholder-blue-300/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5 text-blue-300 hover:text-blue-200" />
                                    ) : (
                                        <Eye className="h-5 w-5 text-blue-300 hover:text-blue-200" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-white/20 rounded bg-white/5"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-blue-200">
                                    Remember this device
                                </label>
                            </div>

                            <div className="text-sm">
                                <a href="#" className="font-medium text-blue-300 hover:text-blue-200 transition-colors">
                                    Contact IT Support
                                </a>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                        >
                            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                                <Shield className="h-5 w-5 text-blue-300 group-hover:text-blue-200" />
                            </span>
                            {loading ? 'Authenticating...' : 'Access Admin Portal'}
                        </button>
                    </form>

                    {/* Additional Info */}
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <div className="text-center space-y-2">
                            <p className="text-xs text-blue-200/60">
                                Not an administrator?
                            </p>
                            <Link
                                to="/login"
                                className="inline-flex items-center text-sm text-blue-300 hover:text-blue-200 font-medium transition-colors"
                            >
                                Go to User Login
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center">
                    <p className="text-xs text-blue-300/60">
                        © 2026 TaskNexus. All rights reserved.
                    </p>
                    <p className="text-xs text-blue-300/40 mt-1">
                        Version 1.0.0 | Secure Session Enabled
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
