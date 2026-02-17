import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, Phone, User, Loader2, ShieldCheck, Wallet,
  CheckCircle, Globe2, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ClientProfile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ totalTasksPosted: 0, completedTasks: 0, totalSpent: 0 });
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    avatar: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/client/profile');
        if (res.data.success) {
          const profile = res.data.data.profile || {};
          const statistics = res.data.data.statistics || {};
          setForm({
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            phone: profile.phone || '',
            avatar: profile.avatar || '',
          });
          setStats({
            totalTasksPosted: statistics.totalTasksPosted || 0,
            completedTasks: statistics.completedTasks || 0,
            totalSpent: statistics.totalSpent || 0,
          });
        }
      } catch (err) {
        toast.error('Could not load profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const completeness = useMemo(() => {
    const fields = ['firstName', 'lastName', 'phone'];
    const filled = fields.filter((f) => form[f]?.trim()).length;
    return Math.round((filled / fields.length) * 100);
  }, [form]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { firstName: form.firstName, lastName: form.lastName, phone: form.phone, avatar: form.avatar };
      const res = await api.put('/client/profile', payload);
      if (res.data.success) {
        toast.success('Profile updated');
        updateUser({ ...user, profile: res.data.data.profile });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Update failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="bg-white/90 backdrop-blur border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/client/dashboard')}
              className="text-primary-600 hover:text-primary-700 flex items-center text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Client Profile</h1>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-semibold text-slate-900">
              {user?.profile?.firstName} {user?.profile?.lastName}
            </span>
            <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
              {(user?.profile?.firstName?.[0] || 'C').toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center text-xl font-bold">
                {(form.firstName?.[0] || 'C').toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-slate-500">Account completeness</p>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-slate-900">{completeness}%</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary-50 text-primary-700 font-semibold">
                    Basics
                  </span>
                </div>
                <p className="text-xs text-slate-500">Fill remaining fields to improve trust & approvals</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
              <StatPill icon={CheckCircle} label="Tasks posted" value={stats.totalTasksPosted} />
              <StatPill icon={ShieldCheck} label="Completed" value={stats.completedTasks} />
              <StatPill icon={Wallet} label="Total spent" value={`$${stats.totalSpent || 0}`} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-6"
          >
            <h2 className="text-lg font-semibold text-slate-900">Contact & Identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="First name" name="firstName" value={form.firstName} onChange={handleChange} icon={User} />
              <InputField label="Last name" name="lastName" value={form.lastName} onChange={handleChange} icon={User} />
              <InputField label="Phone" name="phone" value={form.phone} onChange={handleChange} icon={Phone} />
              <InputField label="Avatar URL (optional)" name="avatar" value={form.avatar} onChange={handleChange} icon={Globe2} />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary flex items-center px-4"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Profile
              </button>
            </div>
          </form>

          <aside className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-600" /> Account Snapshot
            </h3>
            <div className="space-y-3">
              <SnapshotRow label="Primary email" value={user?.email} />
              <SnapshotRow label="Role" value="Client" />
              <SnapshotRow label="Tasks posted" value={stats.totalTasksPosted} />
              <SnapshotRow label="Completed" value={stats.completedTasks} />
              <SnapshotRow label="Total spent" value={`$${stats.totalSpent || 0}`} />
            </div>
            <p className="text-xs text-slate-500">
              Keep contact info current so freelancers and admins can reach you quickly.
            </p>
          </aside>
        </section>
      </main>
    </div>
  );
};

const SnapshotRow = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold text-slate-900">{value || '—'}</span>
  </div>
);

const StatPill = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
    <Icon className="w-4 h-4 text-primary-600" />
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
      <p className="text-sm font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const InputField = ({ label, name, value, onChange, icon: Icon, type = 'text' }) => (
  <div>
    <p className="text-sm font-medium text-slate-700 mb-1">{label}</p>
    <div className="relative">
      {Icon && <Icon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white ${Icon ? 'pl-9' : ''}`}
        placeholder={label}
      />
    </div>
  </div>
);

export default ClientProfile;
