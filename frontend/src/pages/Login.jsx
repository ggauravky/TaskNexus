import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, ShieldCheck, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

/**
 * Login Page with elevated visual design
 */
const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);

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
            // Navigate based on role
            const roleRoutes = {
                client: '/client/dashboard',
                freelancer: '/freelancer/dashboard',
                admin: '/admin/dashboard'
            };
            navigate(roleRoutes[result.user.role] || '/');
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0b1021] via-[#0f172a] to-[#1b1f38] text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-30 hero-grid" />
            <div className="absolute -top-32 -left-24 h-96 w-96 bg-primary-500 blur-3xl opacity-30" />
            <div className="absolute bottom-0 right-0 h-96 w-96 bg-accent-500 blur-3xl opacity-25" />

            <div className="relative max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
                {/* Left content */}
                <div className="space-y-6">
                    <Link to="/" className="inline-flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shadow-glass">
                            <Sparkles className="w-6 h-6 text-primary-100" />
                        </div>
                        <div>
                            <p className="text-xl font-semibold">TaskNexus</p>
                            <p className="text-sm text-gray-300">Managed task delivery</p>
                        </div>
                    </Link>

                    <h1 className="text-4xl font-bold leading-tight font-display">
                        Welcome back. Jump into your control center.
                    </h1>
                    <p className="text-gray-200 max-w-xl">
                        Sign in to track tasks, collaborate, and ship work faster with automated QA and visibility baked into every step.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-3">
                        <SellingPoint icon={<ShieldCheck className="w-5 h-5" />} text="Secure SSO-ready auth" />
                        <SellingPoint icon={<CheckCircle2 className="w-5 h-5" />} text="Role-based dashboards" />
                        <SellingPoint icon={<Sparkles className="w-5 h-5" />} text="QA & delivery insights" />
                        <SellingPoint icon={<ArrowRight className="w-5 h-5" />} text="Jump back into work" />
                    </div>
                </div>

                {/* Form card */}
                <div className="card glass border-white/15 shadow-glass">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-sm text-gray-300">Sign in</p>
                            <h2 className="text-2xl font-bold text-white">Access your workspace</h2>
                        </div>
                        <Link to="/register" className="btn btn-secondary text-xs">
                            Create account
                        </Link>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="space-y-3">
                            <label className="label text-white/80">Email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="input bg-white/10 border-white/20 text-white placeholder:text-white/50"
                                placeholder="you@company.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="label text-white/80">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="input bg-white/10 border-white/20 text-white placeholder:text-white/50"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full py-3 flex items-center justify-center"
                        >
                            <LogIn className="h-5 w-5 mr-2" />
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>

                        <div className="text-center text-sm text-gray-300">
                            <Link to="/" className="hover:text-white transition-colors">
                                ← Back to home
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const SellingPoint = ({ icon, text }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200">
        {icon}
        {text}
    </div>
);

export default Login;
