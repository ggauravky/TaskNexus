import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Sparkles, ShieldCheck, Briefcase, Laptop } from 'lucide-react';
import { USER_ROLES } from '../utils/constants';

/**
 * Register Page with premium visual treatment
 */
const Register = () => {
    const navigate = useNavigate();
    const { register } = useAuth();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        role: USER_ROLES.CLIENT,
        profile: {
            firstName: '',
            lastName: '',
            phone: ''
        }
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name.startsWith('profile.')) {
            const field = name.split('.')[1];
            setFormData({
                ...formData,
                profile: {
                    ...formData.profile,
                    [field]: value
                }
            });
        } else {
            setFormData({
                ...formData,
                [name]: value
            });
        }
    };

    const validate = () => {
        const newErrors = {};

        if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-z])/.test(formData.password)) {
            newErrors.password = 'Include a lowercase letter';
        } else if (!/(?=.*[A-Z])/.test(formData.password)) {
            newErrors.password = 'Include an uppercase letter';
        } else if (!/(?=.*\d)/.test(formData.password)) {
            newErrors.password = 'Include a number';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        setLoading(true);

        const registrationData = { ...formData };
        delete registrationData.confirmPassword;
        const result = await register(registrationData);

        if (result.success) {
            const roleRoutes = {
                [USER_ROLES.CLIENT]: '/client/dashboard',
                [USER_ROLES.FREELANCER]: '/freelancer/dashboard',
                [USER_ROLES.ADMIN]: '/admin/dashboard'
            };
            navigate(roleRoutes[result.user.role] || '/');
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0b1021] via-[#0f172a] to-[#1b1f38] text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-30 hero-grid" />
            <div className="absolute -top-20 right-10 h-80 w-80 bg-primary-500 blur-3xl opacity-30" />
            <div className="absolute bottom-0 left-0 h-96 w-96 bg-accent-500 blur-3xl opacity-25" />

            <div className="relative max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-start">
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
                        Create your TaskNexus workspace
                    </h1>
                    <p className="text-gray-200 max-w-xl">
                        Pick your lane—submit tasks as a client or deliver work as a freelancer—and get a dashboard purpose-built for your flow.
                    </p>

                    <div className="flex items-center gap-3 text-sm text-gray-200">
                        <ShieldCheck className="w-5 h-5" />
                        SOC2-ready security • QA baked in • Live status
                    </div>
                </div>

                <div className="card glass border-white/15 shadow-glass w-full">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-sm text-gray-300">Create account</p>
                            <h2 className="text-2xl font-bold text-white">Join TaskNexus</h2>
                        </div>
                        <Link to="/login" className="btn btn-secondary text-xs">
                            Sign in
                        </Link>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {/* Role Selection */}
                        <div className="grid grid-cols-2 gap-3">
                            <RoleCard
                                title="Submit tasks"
                                subtitle="I need work delivered"
                                active={formData.role === USER_ROLES.CLIENT}
                                onClick={() => setFormData({ ...formData, role: USER_ROLES.CLIENT })}
                                icon={<Briefcase className="w-5 h-5" />}
                            />
                            <RoleCard
                                title="Deliver work"
                                subtitle="I complete tasks"
                                active={formData.role === USER_ROLES.FREELANCER}
                                onClick={() => setFormData({ ...formData, role: USER_ROLES.FREELANCER })}
                                icon={<Laptop className="w-5 h-5" />}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <InputField
                                name="profile.firstName"
                                placeholder="First Name"
                                value={formData.profile.firstName}
                                onChange={handleChange}
                                required
                            />
                            <InputField
                                name="profile.lastName"
                                placeholder="Last Name"
                                value={formData.profile.lastName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <InputField
                            name="email"
                            type="email"
                            placeholder="Work email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />

                        <InputField
                            name="profile.phone"
                            type="tel"
                            placeholder="Phone (optional)"
                            value={formData.profile.phone}
                            onChange={handleChange}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <InputField
                                    name="password"
                                    type="password"
                                    placeholder="Password (8+ characters)"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                                {errors.password && (
                                    <p className="mt-1 text-xs text-amber-200">{errors.password}</p>
                                )}
                            </div>
                            <div>
                                <InputField
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="Confirm password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                                {errors.confirmPassword && (
                                    <p className="mt-1 text-xs text-amber-200">{errors.confirmPassword}</p>
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full py-3 flex items-center justify-center"
                        >
                            <UserPlus className="h-5 w-5 mr-2" />
                            {loading ? 'Creating account...' : 'Create account'}
                        </button>

                        <p className="text-center text-sm text-gray-300">
                            Already have an account?{' '}
                            <Link to="/login" className="text-white font-medium hover:text-primary-100">
                                Sign in
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

const InputField = ({ name, value, onChange, placeholder, type = 'text', required = false }) => (
    <input
        name={name}
        type={type}
        required={required}
        className="input bg-white/10 border-white/20 text-white placeholder:text-white/50"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
    />
);

const RoleCard = ({ title, subtitle, active, onClick, icon }) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full text-left rounded-xl p-4 border transition-all duration-200 ${active
            ? 'border-primary-300 bg-white/10 text-white shadow-soft'
            : 'border-white/10 bg-white/5 text-gray-200 hover:border-primary-200/60'
            }`}
    >
        <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${active ? 'bg-primary-500/20 text-white' : 'bg-white/10 text-gray-200'}`}>
                {icon}
            </div>
            <p className="font-semibold">{title}</p>
        </div>
        <p className="text-xs text-gray-300">{subtitle}</p>
    </button>
);

export default Register;
