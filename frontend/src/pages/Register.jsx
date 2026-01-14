import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus } from 'lucide-react';
import { USER_ROLES } from '../utils/constants';

/**
 * Register Page
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

        // Password validation
        if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-z])/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one lowercase letter';
        } else if (!/(?=.*[A-Z])/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one uppercase letter';
        } else if (!/(?=.*\d)/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one number';
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

        const { confirmPassword, ...registrationData } = formData;
        const result = await register(registrationData);

        if (result.success) {
            // Navigate based on role
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <Link to="/" className="flex justify-center">
                        <h1 className="text-3xl font-bold text-primary-600">TaskNexus</h1>
                    </Link>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Create your account
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Or{' '}
                        <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                            sign in to existing account
                        </Link>
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {/* Role Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            I want to
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, role: USER_ROLES.CLIENT })}
                                className={`p-4 border-2 rounded-lg text-sm font-medium transition ${formData.role === USER_ROLES.CLIENT
                                    ? 'border-primary-600 bg-primary-50 text-primary-600'
                                    : 'border-gray-300 hover:border-gray-400'
                                    }`}
                            >
                                Submit Tasks (Client)
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, role: USER_ROLES.FREELANCER })}
                                className={`p-4 border-2 rounded-lg text-sm font-medium transition ${formData.role === USER_ROLES.FREELANCER
                                    ? 'border-primary-600 bg-primary-50 text-primary-600'
                                    : 'border-gray-300 hover:border-gray-400'
                                    }`}
                            >
                                Work on Tasks (Freelancer)
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                name="profile.firstName"
                                type="text"
                                required
                                className="input"
                                placeholder="First Name"
                                value={formData.profile.firstName}
                                onChange={handleChange}
                            />
                            <input
                                name="profile.lastName"
                                type="text"
                                required
                                className="input"
                                placeholder="Last Name"
                                value={formData.profile.lastName}
                                onChange={handleChange}
                            />
                        </div>

                        <input
                            name="email"
                            type="email"
                            required
                            className="input"
                            placeholder="Email address"
                            value={formData.email}
                            onChange={handleChange}
                        />

                        <input
                            name="profile.phone"
                            type="tel"
                            className="input"
                            placeholder="Phone (optional)"
                            value={formData.profile.phone}
                            onChange={handleChange}
                        />

                        <div>
                            <input
                                name="password"
                                type="password"
                                required
                                className="input"
                                placeholder="Password (min 8 characters)"
                                value={formData.password}
                                onChange={handleChange}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Must contain: 8+ characters, uppercase, lowercase, and number
                            </p>
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                            )}
                        </div>

                        <div>
                            <input
                                name="confirmPassword"
                                type="password"
                                required
                                className="input"
                                placeholder="Confirm Password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                            {errors.confirmPassword && (
                                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                                <UserPlus className="h-5 w-5 text-primary-500 group-hover:text-primary-400" />
                            </span>
                            {loading ? 'Creating account...' : 'Create account'}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link
                            to="/"
                            className="text-sm text-primary-600 hover:text-primary-500"
                        >
                            ← Back to home
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Register;
