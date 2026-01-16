import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, TrendingUp, Users, Briefcase, DollarSign,
    Activity, Calendar, RefreshCw, BarChart3
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Loading from '../components/common/Loading';

const AdminAnalytics = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/statistics');
            if (response.data.success) {
                setAnalytics(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
            toast.error('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <Loading fullScreen={true} text="Loading analytics..." />;
    }

    const stats = analytics || {};

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
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
                                <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
                                <p className="text-sm text-gray-600">Monitor platform performance and insights</p>
                            </div>
                        </div>
                        <button
                            onClick={fetchAnalytics}
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
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <MetricCard
                        title="Total Revenue"
                        value={`$${(stats.totalRevenue || 0).toLocaleString()}`}
                        icon={<DollarSign className="w-8 h-8 text-green-600" />}
                        color="bg-green-50"
                        trend="+12.5%"
                    />
                    <MetricCard
                        title="Active Users"
                        value={stats.activeUsers || 0}
                        icon={<Users className="w-8 h-8 text-blue-600" />}
                        color="bg-blue-50"
                        trend="+8.2%"
                    />
                    <MetricCard
                        title="Total Tasks"
                        value={stats.totalTasks || 0}
                        icon={<Briefcase className="w-8 h-8 text-purple-600" />}
                        color="bg-purple-50"
                        trend="+15.3%"
                    />
                    <MetricCard
                        title="Completion Rate"
                        value={`${(stats.completionRate || 0).toFixed(1)}%`}
                        icon={<Activity className="w-8 h-8 text-orange-600" />}
                        color="bg-orange-50"
                        trend="+3.1%"
                    />
                </div>

                {/* Task Statistics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <BarChart3 className="w-5 h-5 mr-2" />
                            Task Distribution by Status
                        </h3>
                        <div className="space-y-4">
                            <StatusBar label="Submitted" count={stats.tasksByStatus?.submitted || 0} total={stats.totalTasks || 1} color="bg-gray-400" />
                            <StatusBar label="Under Review" count={stats.tasksByStatus?.under_review || 0} total={stats.totalTasks || 1} color="bg-orange-400" />
                            <StatusBar label="Assigned" count={stats.tasksByStatus?.assigned || 0} total={stats.totalTasks || 1} color="bg-blue-400" />
                            <StatusBar label="In Progress" count={stats.tasksByStatus?.in_progress || 0} total={stats.totalTasks || 1} color="bg-yellow-400" />
                            <StatusBar label="Completed" count={stats.tasksByStatus?.completed || 0} total={stats.totalTasks || 1} color="bg-green-400" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <Users className="w-5 h-5 mr-2" />
                            User Distribution
                        </h3>
                        <div className="space-y-4">
                            <UserBar label="Clients" count={stats.usersByRole?.clients || 0} total={stats.totalUsers || 1} color="bg-green-400" />
                            <UserBar label="Freelancers" count={stats.usersByRole?.freelancers || 0} total={stats.totalUsers || 1} color="bg-purple-400" />
                            <UserBar label="Admins" count={stats.usersByRole?.admins || 0} total={stats.totalUsers || 1} color="bg-red-400" />
                        </div>
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Total Users</span>
                                <span className="text-2xl font-bold text-gray-900">{stats.totalUsers || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Statistics */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <DollarSign className="w-5 h-5 mr-2" />
                        Payment Overview
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Completed Payments</p>
                            <p className="text-3xl font-bold text-green-600">
                                ${(stats.paymentStats?.completed || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                {stats.paymentStats?.completedCount || 0} transactions
                            </p>
                        </div>
                        <div className="text-center p-4 bg-yellow-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Pending Payments</p>
                            <p className="text-3xl font-bold text-yellow-600">
                                ${(stats.paymentStats?.pending || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                {stats.paymentStats?.pendingCount || 0} transactions
                            </p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Platform Revenue</p>
                            <p className="text-3xl font-bold text-purple-600">
                                ${(stats.platformRevenue || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">10% commission</p>
                        </div>
                    </div>
                </div>

                {/* Recent Growth */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2" />
                        Growth Metrics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <GrowthMetric
                            label="New Users (This Month)"
                            value={stats.growth?.newUsers || 0}
                            change="+23%"
                            positive={true}
                        />
                        <GrowthMetric
                            label="New Tasks (This Month)"
                            value={stats.growth?.newTasks || 0}
                            change="+18%"
                            positive={true}
                        />
                        <GrowthMetric
                            label="Task Completion Time (Avg)"
                            value={`${stats.averageCompletionTime || 0} days`}
                            change="-5%"
                            positive={true}
                        />
                        <GrowthMetric
                            label="User Satisfaction Rate"
                            value={`${(stats.satisfactionRate || 0).toFixed(1)}%`}
                            change="+2%"
                            positive={true}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

const MetricCard = ({ title, value, icon, color, trend }) => (
    <div className="bg-white rounded-lg shadow-sm p-6">
        <div className={`p-3 rounded-lg ${color} w-fit mb-3`}>
            {icon}
        </div>
        <p className="text-sm text-gray-600 mb-1">{title}</p>
        <div className="flex items-end justify-between">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <span className="text-sm font-medium text-green-600">{trend}</span>
        </div>
    </div>
);

const StatusBar = ({ label, count, total, color }) => {
    const percentage = (count / total) * 100;
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium text-gray-900">{count}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div className={`${color} h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const UserBar = ({ label, count, total, color }) => {
    const percentage = (count / total) * 100;
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium text-gray-900">{count}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div className={`${color} h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const GrowthMetric = ({ label, value, change, positive }) => (
    <div className="p-4 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-600 mb-2">{label}</p>
        <div className="flex items-end justify-between">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <span className={`text-sm font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
                {change}
            </span>
        </div>
    </div>
);

export default AdminAnalytics;
