import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, Briefcase, DollarSign, Star, TrendingUp, Clock,
    CheckCircle, RefreshCw, Eye, Target, Search, Filter,
    Calendar, Award, Activity, Plus, FileText, Send, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import TaskDetailsModal from '../components/freelancer/TaskDetailsModal';
import DashboardSettings from '../components/common/DashboardSettings';
import { usePreferences } from '../hooks/usePreferences';

const FreelancerDashboard = () => {
    console.log('[FreelancerDashboard] Component rendering');
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    console.log('[FreelancerDashboard] User:', user);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('myTasks');
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [stats, setStats] = useState({
        activeTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
        performanceScore: 0,
        rating: 0,
        totalReviews: 0,
        onTimeDeliveryRate: 0,
        totalTasks: 0
    });
    const [myTasks, setMyTasks] = useState([]);
    const [availableTasks, setAvailableTasks] = useState([]);
    const [earnings, setEarnings] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const { preferences, togglePreference } = usePreferences();

    const LOCAL_PROGRESS_KEY = 'tasknexus_freelancer_progress';

    const loadProgressCache = () => {
        try {
            return JSON.parse(localStorage.getItem(LOCAL_PROGRESS_KEY)) || {};
        } catch {
            return {};
        }
    };

    const saveProgressCache = (taskId, metrics) => {
        const cache = loadProgressCache();
        cache[taskId] = metrics;
        localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(cache));
    };

    const mergeProgressFromCache = (tasks) => {
        const cache = loadProgressCache();
        return (tasks || []).map((task) => {
            const cachedMetrics = cache[task.id];
            // If API returns metrics, keep it; otherwise use cached.
            if (task.metrics || !cachedMetrics) return task;
            return { ...task, metrics: cachedMetrics };
        });
    };

    useEffect(() => {
        console.log('[FreelancerDashboard] useEffect triggered');
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [dashboardRes, myTasksRes, availableRes] = await Promise.all([
                api.get('/freelancer/dashboard'),
                api.get('/freelancer/my-tasks?limit=20'),
                api.get('/freelancer/available-tasks?limit=20')
            ]);

            if (dashboardRes.data.success) {
                setStats(dashboardRes.data.data);
            }

            if (myTasksRes.data.success) {
                setMyTasks(mergeProgressFromCache(myTasksRes.data.data.tasks || []));
            }

            if (availableRes.data.success) {
                setAvailableTasks(mergeProgressFromCache(availableRes.data.data.tasks || []));
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            setError(error.message || 'Failed to load dashboard data');
            toast.error('Failed to load dashboard data. Please try refreshing.');
        } finally {
            setLoading(false);
        }
    };

    const fetchEarnings = async () => {
        try {
            const response = await api.get('/freelancer/earnings?limit=50');
            if (response.data.success) {
                setEarnings(response.data.data.payments || []);
            }
        } catch (error) {
            console.error('Error fetching earnings:', error);
            toast.error('Failed to load earnings');
        }
    };

    const fetchReviews = async () => {
        try {
            const response = await api.get('/freelancer/reviews?limit=50');
            if (response.data.success) {
                setReviews(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
            toast.error('Failed to load reviews');
        }
    };

    useEffect(() => {
        if (activeTab === 'earnings' && earnings.length === 0) {
            fetchEarnings();
        } else if (activeTab === 'reviews' && reviews.length === 0) {
            fetchReviews();
        }
    }, [activeTab]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchDashboardData();
        if (activeTab === 'earnings') await fetchEarnings();
        if (activeTab === 'reviews') await fetchReviews();
        setRefreshing(false);
        toast.success('Dashboard refreshed!');
    };

    const handleAcceptTask = async (taskId) => {
        try {
            const response = await api.post(`/freelancer/tasks/${taskId}/accept`);
            if (response.data.success) {
                toast.success('Task accepted successfully!');
                await fetchDashboardData();
                setActiveTab('myTasks');
            }
        } catch (error) {
            console.error('Error accepting task:', error);
            const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || 'Failed to accept task';
            toast.error(errorMsg);
        }
    };

    const handleViewTask = (task) => {
        setSelectedTask(task);
        setShowDetailsModal(true);
    };

    const handleStartWorking = async (task) => {
        try {
            await api.put(`/freelancer/tasks/${task.id}/start`);
            toast.success('Marked as In Progress');
            setShowDetailsModal(false);
            await fetchDashboardData();
        } catch (error) {
            const msg = error.response?.data?.message || 'Could not start task';
            toast.error(msg);
        }
    };

    const handleCancelTask = async (task) => {
        try {
            await api.put(`/freelancer/tasks/${task.id}/cancel`);
            toast.success('Task returned to available pool');
            setShowDetailsModal(false);
            await fetchDashboardData();
        } catch (error) {
            const msg = error.response?.data?.message || 'Could not cancel task';
            toast.error(msg);
        }
    };

    const handleUpdateProgress = async (taskId, progressPayload) => {
        try {
            await api.put(`/freelancer/tasks/${taskId}/progress`, progressPayload);
            toast.success('Progress updated');
            saveProgressCache(taskId, {
                ...(selectedTask?.metrics || {}),
                ...progressPayload,
                progressUpdatedAt: new Date().toISOString(),
            });
            await fetchDashboardData();
        } catch (error) {
            const msg = error.response?.data?.message || 'Could not update progress';
            toast.error(msg);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const formatDate = (date) => {
        if (!date) return 'No deadline';
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };

    const getFilteredTasks = (tasks) => {
        let filtered = tasks;

        if (filterStatus !== 'all') {
            filtered = filtered.filter(task => task.status === filterStatus);
        }

        if (searchTerm) {
            filtered = filtered.filter(task =>
                task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return filtered;
    };

    if (loading) {
        console.log('[FreelancerDashboard] Rendering loading state');
        return <Loading fullScreen={true} text="Loading dashboard..." />;
    }

    if (error && !stats.totalTasks) {
        console.log('[FreelancerDashboard] Rendering error state:', error);
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Dashboard</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button onClick={handleRefresh} className="btn-primary">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const TaskCard = ({ task, isAvailable = false }) => {
        const compact = preferences?.compactCards;
        const paddingClass = compact ? 'p-4' : 'p-5';
        const progress = task.metrics?.progress ?? null;

        return (
        <div className={`border border-slate-200 rounded-xl ${paddingClass} hover:shadow-xl transition-all duration-200 hover:border-primary-200 bg-white/80 backdrop-blur-sm`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2 text-lg">
                        {task.task_details?.title || 'Untitled Task'}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {task.task_details?.description || 'No description'}
                    </p>
                </div>
                {!isAvailable && (
                    <div className="ml-4">
                        <StatusBadge status={task.status} />
                    </div>
                )}
            </div>

            <div className="flex items-center flex-wrap gap-4 text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
                <span className="flex items-center font-medium text-green-600">
                    <DollarSign className="w-4 h-4 mr-1" />
                    {formatCurrency(task.task_details?.budget)}
                </span>
                <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1 text-blue-600" />
                    {formatDate(task.task_details?.deadline)}
                </span>
                {task.task_details?.type && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        {task.task_details.type.replace(/-/g, ' ').toUpperCase()}
                    </span>
                )}
                {progress !== null && (
                    <span className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-full font-semibold">
                        {progress}% complete
                    </span>
                )}
            </div>

            {progress !== null && preferences?.showProgressBars && (
                <div className="mb-4">
                    <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                            className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-indigo-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    {task.client && (
                        <span className="text-xs text-gray-500">
                            Client: {task.client.profile?.firstName} {task.client.profile?.lastName}
                        </span>
                    )}
                </div>
                {isAvailable ? (
                    <button
                        onClick={() => handleAcceptTask(task.id)}
                        className="btn-sm btn-primary flex items-center"
                    >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Accept Task
                    </button>
                ) : (
                    <button
                        onClick={() => handleViewTask(task)}
                        className="btn-sm btn-secondary flex items-center"
                    >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                    </button>
                )}
            </div>
        </div>
    );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            {/* Header */}
            <header className="backdrop-blur bg-white/80 shadow-sm sticky top-0 z-10 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold">TN</div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">TaskNexus</h1>
                                <p className="text-xs sm:text-sm text-slate-500">Freelancer Workspace</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="btn-sm btn-secondary flex items-center rounded-full px-4"
                            >
                                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                            <button
                                onClick={() => navigate('/freelancer/profile')}
                                className="btn-sm btn-secondary rounded-full px-4"
                            >
                                Profile
                            </button>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-900">
                                    {user?.profile.firstName} {user?.profile.lastName}
                                </p>
                                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="btn btn-secondary flex items-center rounded-full"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Section */}
                <div className="mb-8 relative overflow-hidden rounded-2xl border border-slate-100 shadow-lg bg-gradient-to-r from-primary-500 via-indigo-500 to-purple-500 text-white">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.18),transparent_30%)]" />
                    <div className="relative p-8">
                        <h2 className="text-3xl font-bold mb-2">
                            Welcome back, {user?.profile.firstName}! 👋
                        </h2>
                        <p className="text-white/90 text-lg mb-4">
                            Stay on track, showcase progress, and keep clients updated.
                        </p>
                        {stats.rating > 0 && (
                            <div className="flex items-center flex-wrap gap-4 text-sm">
                                <HeroBadge><Star className="w-5 h-5 mr-1 fill-yellow-400 text-yellow-400" />{stats.rating}/5.0 Rating ({stats.totalReviews} reviews)</HeroBadge>
                                <HeroBadge><Target className="w-5 h-5 mr-1" />{stats.onTimeDeliveryRate}% On-Time Delivery</HeroBadge>
                                <HeroBadge><Award className="w-5 h-5 mr-1" />Performance Score: {stats.performanceScore}/100</HeroBadge>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Grid + Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
                    <StatCard
                        title="Active Tasks"
                        value={stats.activeTasks}
                        icon={<Activity className="w-8 h-8 text-primary-600" />}
                        color="bg-primary-50"
                    />
                    <StatCard
                        title="Pending Review"
                        value={stats.pendingTasks}
                        icon={<Clock className="w-8 h-8 text-yellow-600" />}
                        color="bg-yellow-50"
                    />
                    <StatCard
                        title="Completed"
                        value={stats.completedTasks}
                        icon={<CheckCircle className="w-8 h-8 text-green-600" />}
                        color="bg-green-50"
                    />
                    <StatCard
                        title="Total Earned"
                        value={formatCurrency(stats.totalEarnings)}
                        icon={<DollarSign className="w-8 h-8 text-green-600" />}
                        color="bg-green-50"
                    />
                    <StatCard
                        title="Pending Payment"
                        value={formatCurrency(stats.pendingEarnings)}
                        icon={<DollarSign className="w-8 h-8 text-orange-600" />}
                        color="bg-orange-50"
                    />
                    <StatCard
                        title="Total Tasks"
                        value={stats.totalTasks}
                        icon={<Briefcase className="w-8 h-8 text-purple-600" />}
                        color="bg-purple-50"
                    />
                    <div className="col-span-1 md:col-span-3 lg:col-span-2">
                        <DashboardSettings
                            preferences={preferences}
                            togglePreference={togglePreference}
                            title="Workspace Preferences"
                            className="max-w-3xl"
                        />
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveTab('myTasks')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'myTasks'
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <Briefcase className="w-5 h-5 inline-block mr-2" />
                                My Tasks ({myTasks.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('available')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'available'
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <Search className="w-5 h-5 inline-block mr-2" />
                                Available Tasks ({availableTasks.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('earnings')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'earnings'
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <DollarSign className="w-5 h-5 inline-block mr-2" />
                                Earnings
                            </button>
                            <button
                                onClick={() => setActiveTab('reviews')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'reviews'
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <Star className="w-5 h-5 inline-block mr-2" />
                                Reviews ({stats.totalReviews})
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Search and Filter */}
                {(activeTab === 'myTasks' || activeTab === 'available') && (
                    <div className="mb-6 flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search tasks..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        {activeTab === 'myTasks' && (
                            <div className="sm:w-48">
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                >
                                    <option value="all">All Status</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="submitted_work">Submitted</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Content */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    {/* My Tasks Tab */}
                    {activeTab === 'myTasks' && (
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-4">
                                My Tasks ({getFilteredTasks(myTasks).length})
                            </h3>
                            {getFilteredTasks(myTasks).length === 0 ? (
                                <EmptyState
                                    icon={Briefcase}
                                    title="No tasks found"
                                    description={filterStatus !== 'all' || searchTerm
                                        ? "Try adjusting your filters"
                                        : "Accept tasks from the Available Tasks tab to get started"}
                                />
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {getFilteredTasks(myTasks).map((task) => (
                                        <TaskCard key={task.id} task={task} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Available Tasks Tab */}
                    {activeTab === 'available' && (
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-4">
                                Available Tasks ({getFilteredTasks(availableTasks).length})
                            </h3>
                            {getFilteredTasks(availableTasks).length === 0 ? (
                                <EmptyState
                                    icon={Search}
                                    title="No available tasks"
                                    description="Check back later for new opportunities"
                                />
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {getFilteredTasks(availableTasks).map((task) => (
                                        <TaskCard key={task.id} task={task} isAvailable={true} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Earnings Tab */}
                    {activeTab === 'earnings' && (
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-4">
                                Earnings History
                            </h3>
                            {earnings.length === 0 ? (
                                <EmptyState
                                    icon={DollarSign}
                                    title="No earnings yet"
                                    description="Complete tasks to start earning"
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {earnings.map((payment) => (
                                                <tr key={payment.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 text-sm text-gray-900">{payment.task?.task_details?.title}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {payment.client?.profile?.firstName} {payment.client?.profile?.lastName}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                                                        {formatCurrency(payment.amounts?.freelancerPayout)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 text-xs rounded-full ${payment.status === 'released' ? 'bg-green-100 text-green-800' :
                                                            payment.status === 'escrowed' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {payment.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {formatDate(payment.created_at)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reviews Tab */}
                    {activeTab === 'reviews' && (
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-4">
                                Client Reviews
                            </h3>
                            {reviews.length === 0 ? (
                                <EmptyState
                                    icon={Star}
                                    title="No reviews yet"
                                    description="Complete tasks to receive client reviews"
                                />
                            ) : (
                                <div className="space-y-4">
                                    {reviews.map((review) => (
                                        <div key={review.id} className="border border-gray-200 rounded-lg p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900 mb-1">
                                                        {review.task?.task_details?.title}
                                                    </h4>
                                                    <p className="text-sm text-gray-600">
                                                        {review.reviewer?.profile?.firstName} {review.reviewer?.profile?.lastName}
                                                    </p>
                                                </div>
                                                <div className="flex items-center">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star
                                                            key={i}
                                                            className={`w-5 h-5 ${i < review.rating
                                                                ? 'text-yellow-400 fill-yellow-400'
                                                                : 'text-gray-300'
                                                                }`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            {review.feedback && (
                                                <p className="text-gray-700 text-sm mb-2">{review.feedback}</p>
                                            )}
                                            <p className="text-xs text-gray-500">
                                                {formatDate(review.created_at)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Task Details Modal */}
            <TaskDetailsModal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                task={selectedTask}
                onStartWorking={handleStartWorking}
                onCancelTask={handleCancelTask}
                onUpdateProgress={handleUpdateProgress}
            />
        </div>
    );
};

const HeroBadge = ({ children }) => (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/25">
        {children}
    </span>
);

export default FreelancerDashboard;

