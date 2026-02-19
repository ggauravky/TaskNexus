import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Search,
    AlertCircle, RefreshCw, Phone
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Loading from '../components/common/Loading';

const AdminUsers = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        let filtered = [...users];

        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(user => user.status === statusFilter);
        }

        if (searchTerm) {
            filtered = filtered.filter(user =>
                user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.profile?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.profile?.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredUsers(filtered);
    }, [users, searchTerm, roleFilter, statusFilter]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/users');
            if (response.data.success) {
                setUsers(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (userId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        try {
            const response = await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
            if (response.data.success) {
                toast.success(`User ${newStatus === 'active' ? 'activated' : 'suspended'} successfully!`);
                fetchUsers();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update user status');
        }
    };

    if (loading) {
        return <Loading fullScreen={true} text="Loading users..." />;
    }

    const clients = users.filter(u => u.role === 'client').length;
    const freelancers = users.filter(u => u.role === 'freelancer').length;
    const activeUsers = users.filter(u => u.status === 'active').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50">
            {/* Header */}
            <header className="bg-white/85 backdrop-blur border-b border-slate-100 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                                <p className="text-sm text-gray-600">View and manage all platform users</p>
                            </div>
                        </div>
                        <button
                            onClick={fetchUsers}
                            className="btn-sm btn-secondary flex items-center"
                        >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6 rounded-2xl border border-slate-100 bg-gradient-to-r from-primary-600 to-cyan-600 p-6 text-white shadow-xl">
                    <h2 className="text-2xl font-bold">User Operations</h2>
                    <p className="text-primary-100 text-sm mt-1">Search, filter, and manage account access across the platform.</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <StatCard title="Total Users" value={users.length} color="bg-blue-50 text-blue-600" />
                    <StatCard title="Clients" value={clients} color="bg-green-50 text-green-600" />
                    <StatCard title="Freelancers" value={freelancers} color="bg-purple-50 text-purple-600" />
                    <StatCard title="Active Users" value={activeUsers} color="bg-emerald-50 text-emerald-600" />
                </div>

                {/* Filters */}
                <div className="bg-white/90 rounded-2xl border border-slate-100 shadow-sm p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input pl-10 py-2"
                                />
                            </div>
                        </div>
                        <div className="w-full md:w-40">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="input py-2"
                            >
                                <option value="all">All Roles</option>
                                <option value="client">Clients</option>
                                <option value="freelancer">Freelancers</option>
                                <option value="admin">Admins</option>
                            </select>
                        </div>
                        <div className="w-full md:w-40">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="input py-2"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white/90 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Contact
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Joined
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white/90 divide-y divide-slate-100">
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                            <p>No users found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr key={user._id} className="hover:bg-slate-50/80">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                                                        <span className="text-primary-600 font-medium">
                                                            {user.profile?.firstName?.[0]}{user.profile?.lastName?.[0]}
                                                        </span>
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {user.profile?.firstName} {user.profile?.lastName}
                                                        </div>
                                                        <div className="text-sm text-gray-500">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 flex items-center">
                                                    <Phone className="w-4 h-4 mr-2 text-gray-400" />
                                                    {user.profile?.phone || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'client' ? 'bg-green-100 text-green-800' :
                                                        user.role === 'freelancer' ? 'bg-purple-100 text-purple-800' :
                                                            'bg-red-100 text-red-800'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {user.status || 'active'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleToggleStatus(user._id, user.status || 'active')}
                                                    className={`${user.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                                                        }`}
                                                >
                                                    {user.status === 'active' ? 'Suspend' : 'Activate'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

const StatCard = ({ title, value, color }) => (
    <div className="bg-white/90 rounded-2xl border border-slate-100 shadow-sm p-4">
        <p className="text-sm text-gray-600 mb-1">{title}</p>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
);

export default AdminUsers;
