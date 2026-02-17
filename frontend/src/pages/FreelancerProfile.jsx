import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Save, User, Phone, MapPin, Briefcase, FileText, Link2, Loader2,
    Clock, Sparkles, Star, Globe2, CheckCircle, Target
} from 'lucide-react';
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
    const [initialForm, setInitialForm] = useState(null);

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
                    setInitialForm({
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
                setInitialForm({
                    firstName: res.data.data.profile.firstName || '',
                    lastName: res.data.data.profile.lastName || '',
                    phone: res.data.data.profile.phone || '',
                    location: res.data.data.profile.location || '',
                    title: res.data.data.freelancerProfile.title || '',
                    bio: res.data.data.freelancerProfile.bio || '',
                    skills: (res.data.data.freelancerProfile.skills || []).join(', '),
                    hourlyRate: res.data.data.freelancerProfile.hourlyRate ?? '',
                    availability: res.data.data.freelancerProfile.availability || 'available',
                    experienceLevel: res.data.data.freelancerProfile.experienceLevel || 'mid',
                    website: res.data.data.freelancerProfile.website || '',
                    linkedin: res.data.data.freelancerProfile.linkedin || '',
                    portfolio: res.data.data.freelancerProfile.portfolio || '',
                });
            }
        } catch (error) {
            const msg = error.response?.data?.message || 'Update failed';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const skillList = useMemo(
        () =>
            form.skills
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
        [form.skills],
    );

    const completeness = useMemo(() => {
        const fields = ['firstName', 'lastName', 'title', 'bio', 'skills', 'hourlyRate', 'location'];
        const filled = fields.filter((f) => form[f]?.toString().trim()).length;
        return Math.round((filled / fields.length) * 100);
    }, [form]);

    const dirty = useMemo(() => {
        if (!initialForm) return false;
        return [
            'firstName', 'lastName', 'phone', 'location',
            'title', 'bio', 'skills', 'hourlyRate',
            'availability', 'experienceLevel', 'website', 'linkedin', 'portfolio'
        ].some((k) => (form[k] || '') !== (initialForm[k] || ''));
    }, [form, initialForm]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <header className="bg-white/90 backdrop-blur border-b border-slate-100 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => navigate('/freelancer/dashboard')}
                            className="text-primary-600 hover:text-primary-700 flex items-center text-sm font-semibold"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back to Dashboard
                        </button>
                        <h1 className="text-2xl font-bold text-slate-900">Freelancer Profile</h1>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">
                                {user?.profile?.firstName} {user?.profile?.lastName}
                            </p>
                            <p className="text-xs text-slate-500">Freelancer</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                            {(user?.profile?.firstName?.[0] || 'F').toUpperCase()}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="flex items-center space-x-4">
                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500 text-white flex items-center justify-center text-2xl font-bold">
                                {(form.firstName?.[0] || 'F').toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Profile completeness</p>
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl font-bold text-slate-900">{completeness}%</span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-primary-50 text-primary-700 font-semibold">
                                        Pro ready
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Fill headline, skills, rate, and bio for better matches.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                            <Metric icon={Briefcase} label="Title" value={form.title || 'Add title'} />
                            <Metric icon={Clock} label="Availability" value={humanAvailability(form.availability)} />
                            <Metric icon={Sparkles} label="Skills" value={`${skillList.length} listed`} />
                            <Metric icon={Star} label="Experience" value={humanExperience(form.experienceLevel)} />
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <form
                        onSubmit={handleSubmit}
                        className="xl:col-span-2 bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-8"
                    >
                        <div className="space-y-4">
                            <SectionTitle icon={User} title="Identity & Contact" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField label="First Name" name="firstName" value={form.firstName} onChange={handleChange} icon={User} />
                                <InputField label="Last Name" name="lastName" value={form.lastName} onChange={handleChange} icon={User} />
                                <InputField label="Phone" name="phone" value={form.phone} onChange={handleChange} icon={Phone} />
                                <InputField label="Location" name="location" value={form.location} onChange={handleChange} icon={MapPin} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <SectionTitle icon={Briefcase} title="Professional" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField label="Professional Title" name="title" value={form.title} onChange={handleChange} icon={Briefcase} />
                                <InputField label="Hourly Rate (USD)" name="hourlyRate" type="number" value={form.hourlyRate} onChange={handleChange} icon={DollarSignIcon} />
                                <SelectField
                                    label="Availability"
                                    name="availability"
                                    value={form.availability}
                                    onChange={handleChange}
                                    options={[
                                        { value: 'available', label: 'Available' },
                                        { value: 'part_time', label: 'Part-time' },
                                        { value: 'busy', label: 'Busy' },
                                    ]}
                                    icon={Clock}
                                />
                                <SelectField
                                    label="Experience Level"
                                    name="experienceLevel"
                                    value={form.experienceLevel}
                                    onChange={handleChange}
                                    options={[
                                        { value: 'junior', label: 'Junior' },
                                        { value: 'mid', label: 'Mid' },
                                        { value: 'senior', label: 'Senior' },
                                    ]}
                                    icon={Star}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <SectionTitle icon={FileText} title="Story & Skills" />
                            <div className="grid grid-cols-1 gap-4">
                                <Label title="Bio" />
                                <textarea
                                    name="bio"
                                    value={form.bio}
                                    onChange={handleChange}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="Tell clients about your experience, industries, and standout results."
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <Label title="Skills (comma separated)" />
                                <textarea
                                    name="skills"
                                    value={form.skills}
                                    onChange={handleChange}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="e.g., React, Node.js, UX Writing, Motion Graphics"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {skillList.slice(0, 12).map((skill) => (
                                        <span key={skill} className="px-3 py-1 text-xs rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <SectionTitle icon={Globe2} title="Links" />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <InputField label="Website" name="website" value={form.website} onChange={handleChange} icon={Link2} />
                                <InputField label="LinkedIn" name="linkedin" value={form.linkedin} onChange={handleChange} icon={Link2} />
                                <InputField label="Portfolio" name="portfolio" value={form.portfolio} onChange={handleChange} icon={Link2} />
                            </div>
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
                                className={`btn btn-primary flex items-center ${!dirty ? 'opacity-60 cursor-not-allowed' : ''}`}
                                disabled={saving || !dirty}
                            >
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                {dirty ? 'Save Changes' : 'Up to date'}
                            </button>
                        </div>
                    </form>

                    <aside className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
                        <SectionTitle icon={Target} title="Live Profile Card" />
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-primary-600 to-cyan-500 text-white shadow-lg space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center text-xl font-bold">
                                    {(form.firstName?.[0] || 'F').toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-lg font-semibold">{form.firstName || 'First'} {form.lastName || 'Last'}</p>
                                    <p className="text-sm text-white/80">{form.title || 'Role / Specialty'}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge tone="soft">Rate: {form.hourlyRate ? `$${form.hourlyRate}/hr` : 'Add rate'}</Badge>
                                <Badge tone="soft">Experience: {humanExperience(form.experienceLevel)}</Badge>
                                <Badge tone={form.availability === 'available' ? 'success' : form.availability === 'part_time' ? 'warning' : 'muted'}>
                                    {humanAvailability(form.availability)}
                                </Badge>
                            </div>
                            <p className="text-sm leading-relaxed text-white/90 line-clamp-4">
                                {form.bio || 'Your short bio appears here. Describe your niche, outcomes, and key wins.'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {skillList.slice(0, 8).map((skill) => (
                                    <span key={skill} className="px-3 py-1 text-xs rounded-full bg-white/15 border border-white/20">
                                        {skill}
                                    </span>
                                ))}
                                {skillList.length > 8 && (
                                    <span className="px-3 py-1 text-xs rounded-full bg-white/15 border border-white/20">
                                        +{skillList.length - 8} more
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <SectionTitle icon={CheckCircle} title="Tips to boost visibility" />
                            <ul className="space-y-2 text-sm text-slate-600">
                                <li>• Keep a clear title (e.g., “Senior React Engineer — dashboards & data viz”).</li>
                                <li>• List 6–12 focused skills and your strongest industries.</li>
                                <li>• Add a concise 3–4 sentence bio with measurable outcomes.</li>
                            </ul>
                        </div>
                    </aside>
                </section>
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

const SelectField = ({ label, name, value, onChange, options, icon: Icon }) => (
    <div>
        <Label title={label} />
        <div className="relative">
            {Icon && <Icon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />}
            <select
                name={name}
                value={value}
                onChange={onChange}
                className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white ${Icon ? 'pl-9' : ''}`}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    </div>
);

const SectionTitle = ({ icon: Icon, title }) => (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {Icon && <Icon className="w-4 h-4 text-primary-600" />}
        {title}
    </h3>
);

const Badge = ({ tone = 'soft', children }) => {
    const styles = {
        soft: 'bg-white/15 text-white',
        success: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-700',
        muted: 'bg-slate-200 text-slate-700',
    };
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[tone] || styles.soft}`}>{children}</span>;
};

const Metric = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
        <Icon className="w-4 h-4 text-primary-600 mt-0.5" />
        <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
            <p className="text-sm font-bold text-slate-900">{value}</p>
        </div>
    </div>
);

const humanAvailability = (value) => {
    const map = {
        available: 'Available',
        part_time: 'Part-time',
        busy: 'Busy',
    };
    return map[value] || 'Available';
};

const humanExperience = (value) => {
    const map = {
        junior: 'Junior',
        mid: 'Mid-level',
        senior: 'Senior',
    };
    return map[value] || 'Mid-level';
};

export default FreelancerProfile;
