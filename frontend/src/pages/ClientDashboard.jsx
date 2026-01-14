import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Plus, FileText, Clock, CheckCircle, DollarSign,
  AlertCircle, TrendingUp, Calendar, Eye, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';

/**
 * Enhanced Client Dashboard with API Integration
 */
const ClientDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalTasks: 0,
    activeTasks: 0,
    completedTasks: 0,
    pendingReview: 0,
    totalSpent: 0,
    avgCompletionTime: 0
  });
  const [recentTasks, setRecentTasks] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, tasksRes] = await Promise.all([
        api.get('/client/dashboard'),
        api.get('/client/tasks?limit=5&sort=-createdAt')
      ]);

      if (dashboardRes.data.success) {
        setStats(dashboardRes.data.data);
      }

      if (tasksRes.data.success) {
        setRecentTasks(tasksRes.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
    toast.success('Dashboard refreshed!');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">TaskNexus</h1>
              <p className="text-sm text-gray-600">Client Dashboard</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-sm btn-secondary flex items-center"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user?.profile.firstName} {user?.profile.lastName}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-secondary flex items-center"
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.profile.firstName}! 👋
          </h2>
          <p className="text-gray-600">
            Manage your tasks and track progress all in one place
          </p>
        </div>

        {/* Quick Action */}
        <div className="mb-8">
          <button
            className="btn btn-primary flex items-center text-lg shadow-lg hover:shadow-xl transition-shadow"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Task
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <StatCard
            title="Total Tasks"
            value={stats.totalTasks}
            icon={<FileText className="w-8 h-8 text-primary-600" />}
            color="bg-primary-50"
            trend="+12%"
            trendUp={true}
          />
          <StatCard
            title="Active Tasks"
            value={stats.activeTasks}
            icon={<Clock className="w-8 h-8 text-yellow-600" />}
            color="bg-yellow-50"
          />
          <StatCard
            title="Completed"
            value={stats.completedTasks}
            icon={<CheckCircle className="w-8 h-8 text-green-600" />}
            color="bg-green-50"
            trend="+8%"
            trendUp={true}
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingReview}
            icon={<AlertCircle className="w-8 h-8 text-orange-600" />}
            color="bg-orange-50"
          />
          <StatCard
            title="Total Spent"
            value={`$${stats.totalSpent || 0}`}
            icon={<DollarSign className="w-8 h-8 text-purple-600" />}
            color="bg-purple-50"
          />
          <StatCard
            title="Avg. Completion"
            value={`${stats.avgCompletionTime || 0}d`}
            icon={<TrendingUp className="w-8 h-8 text-blue-600" />}
            color="bg-blue-50"
          />
        </div>

        {/* Recent Tasks */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Tasks</h3>
          </div>
          <div className="p-6">
            {recentTasks.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No tasks yet"
                description="Create your first task to get started"
                action={
                  <button className="btn btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </button>
                }
              />
            ) : (
              <div className="space-y-4">
                {recentTasks.map((task) => (
                  <TaskCard key={task._id} task={task} onRefresh={fetchDashboardData} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// Task Card Component
const TaskCard = ({ task, onRefresh }) => {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-1">{task.taskDetails?.title || 'Untitled Task'}</h4>
          <p className="text-sm text-gray-600 line-clamp-2">
            {task.taskDetails?.description || 'No description'}
          </p>
        </div>
        <div className="ml-4">
          <StatusBadge status={task.status} />
        </div>
      </div>

      <div className="flex items-center text-sm text-gray-500 space-x-4 mb-3">
        <span className="flex items-center">
          <DollarSign className="w-4 h-4 mr-1" />
          ${task.taskDetails?.budget || 0}
        </span>
        <span className="flex items-center">
          <Calendar className="w-4 h-4 mr-1" />
          {task.taskDetails?.deadline ? new Date(task.taskDetails.deadline).toLocaleDateString() : 'No deadline'}
        </span>
      </div>

      <div className="flex space-x-2">
        <button className="btn-sm btn-primary flex items-center">
          <Eye className="w-4 h-4 mr-1" />
          View Details
        </button>
      </div>
    </div>
  );
};

export default ClientDashboard;
