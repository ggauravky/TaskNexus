import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, Phone, MapPin, Briefcase, FileText, Link2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const FreelancerProfile = () => {
    const { user, updateUser } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        location: '',
        title: '',
        bio: '',
        skills: '',
        hourlyRate: '',
        availability: 'available',
        experienceLevel: 'mid',
        website: '',
        linkedin: '',
        portfolio: '',
    });

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const res = await api.get('/freelancer/profile');
                if (res.data.success) {
                    const { profile = {}, freelancerProfile = {} } = res.data.data;
                    setForm({
                        firstName: profile.firstName || '',
                        lastName: profile.lastName || '',
                        phone: profile.phone || '',
                        location: profile.location || '',
                        title: freelancerProfile.title || '',
                        bio: freelancerProfile.bio || '',
                        skills: (freelancerProfile.skills || []).join(', '),
                        hourlyRate: freelancerProfile.hourlyRate ?? '',
                        availability: freelancerProfile.availability || 'available',
                        experienceLevel: freelancerProfile.experienceLevel || 'mid',
                        website: freelancerProfile.website || '',
                        linkedin: freelancerProfile.linkedin || '',
                        portfolio: freelancerProfile.portfolio || '',
                    });
                }
            } catch (error) {
                toast.error('Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                skills: form.skills
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                hourlyRate: form.hourlyRate === '' ? null : Number(form.hourlyRate),
            };

            const res = await api.put('/freelancer/profile', payload);
            if (res.data.success) {
                toast.success('Profile updated');
                // keep auth user in sync
                updateUser({
                    ...user,
                    profile: res.data.data.profile,
                    freelancer_profile: res.data.data.freelancerProfile,
                });
            }
        } catch (error) {
            const msg = error.response?.data?.message || 'Update failed';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => navigate('/freelancer/dashboard')}
                            className="text-primary-600 hover:text-primary-700 flex items-center text-sm font-medium"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back to Dashboard
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                            {user?.profile?.firstName} {user?.profile?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">Freelancer</p>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <form onSubmit={handleSubmit} className="bg-white shadow rounded-xl p-6 space-y-6 border border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField
                            label="First Name"
                            name="firstName"
                            value={form.firstName}
                            onChange={handleChange}
                            icon={User}
                        />
                        <InputField
                            label="Last Name"
                            name="lastName"
                            value={form.lastName}
                            onChange={handleChange}
                            icon={User}
                        />
                        <InputField
                            label="Phone"
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            icon={Phone}
                        />
                        <InputField
                            label="Location"
                            name="location"
                            value={form.location}
                            onChange={handleChange}
                            icon={MapPin}
                        />
                        <InputField
                            label="Professional Title"
                            name="title"
                            value={form.title}
                            onChange={handleChange}
                            icon={Briefcase}
                        />
                        <InputField
                            label="Hourly Rate (USD)"
                            name="hourlyRate"
                            type="number"
                            value={form.hourlyRate}
                            onChange={handleChange}
                            icon={DollarSignIcon}
                        />
                    </div>

                    <div>
                        <Label title="Bio" />
                        <textarea
                            name="bio"
                            value={form.bio}
                            onChange={handleChange}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Tell clients about your experience and strengths"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label title="Skills (comma separated)" />
                            <textarea
                                name="skills"
                                value={form.skills}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="e.g., React, Node.js, UI Design"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <Label title="Availability" />
                                <select
                                    name="availability"
                                    value={form.availability}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                >
                                    <option value="available">Available</option>
                                    <option value="part_time">Part-time</option>
                                    <option value="busy">Busy</option>
                                </select>
                            </div>
                            <div>
                                <Label title="Experience Level" />
                                <select
                                    name="experienceLevel"
                                    value={form.experienceLevel}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                >
                                    <option value="junior">Junior</option>
                                    <option value="mid">Mid</option>
                                    <option value="senior">Senior</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputField
                            label="Website"
                            name="website"
                            value={form.website}
                            onChange={handleChange}
                            icon={Link2}
                        />
                        <InputField
                            label="LinkedIn"
                            name="linkedin"
                            value={form.linkedin}
                            onChange={handleChange}
                            icon={Link2}
                        />
                        <InputField
                            label="Portfolio"
                            name="portfolio"
                            value={form.portfolio}
                            onChange={handleChange}
                            icon={Link2}
                        />
                    </div>

                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={() => navigate('/freelancer/dashboard')}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary flex items-center"
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Profile
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
};

const Label = ({ title }) => (
    <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
);

const DollarSignIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${props.className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-10v2m0 8v2" />
    </svg>
);

const InputField = ({ label, name, value, onChange, icon: Icon, type = 'text' }) => (
    <div>
        <Label title={label} />
        <div className="relative">
            {Icon && <Icon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />}
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${Icon ? 'pl-9' : ''}`}
                placeholder={label}
            />
        </div>
    </div>
);

export default FreelancerProfile;
