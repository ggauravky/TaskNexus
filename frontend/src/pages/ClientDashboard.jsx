import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Plus, FileText, Clock, CheckCircle, DollarSign,
  AlertCircle, TrendingUp, Calendar, Eye, RefreshCw, List
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import CreateTaskModal from '../components/client/CreateTaskModal';
import TaskDetailsModal from '../components/client/TaskDetailsModal';
import DashboardSettings from '../components/common/DashboardSettings';
import { usePreferences } from '../hooks/usePreferences';

/**
 * Enhanced Client Dashboard with API Integration
 */
const ClientDashboard = () => {
  console.log('[ClientDashboard] Component rendering');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  console.log('[ClientDashboard] User:', user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewAllTasks, setViewAllTasks] = useState(false);
  const [stats, setStats] = useState({
    totalTasks: 0,
    activeTasks: 0,
    completedTasks: 0,
    pendingReview: 0,
    totalSpent: 0,
    avgCompletionTime: 0
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const { preferences, togglePreference } = usePreferences();

  useEffect(() => {
    console.log('[ClientDashboard] useEffect triggered');
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    console.log('[ClientDashboard] fetchDashboardData started');
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
        setTotalTasksCount(tasksRes.data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
      toast.error('Failed to load dashboard data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/client/tasks?limit=100&sort=-createdAt');

      if (response.data.success) {
        setAllTasks(response.data.data || []);
        setViewAllTasks(true);
      }
    } catch (error) {
      console.error('Error fetching all tasks:', error);
      toast.error('Failed to load all tasks');
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

  const handleCreateTask = () => {
    setShowCreateModal(true);
  };

  const handleTaskCreated = () => {
    fetchDashboardData();
    toast.success('Task created successfully!');
  };

  const handleViewTask = (task) => {
    setSelectedTask(task);
    setShowDetailsModal(true);
  };

  const handleViewAllTasks = async () => {
    if (viewAllTasks) {
      // Toggle back to recent tasks
      setViewAllTasks(false);
    } else {
      // Fetch and show all tasks
      await fetchAllTasks();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    console.log('[ClientDashboard] Rendering loading state');
    return <Loading fullScreen={true} text="Loading dashboard..." />;
  }

  if (error && !stats.totalTasks) {
    console.log('[ClientDashboard] Rendering error state:', error);
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

  console.log('[ClientDashboard] Rendering main dashboard');
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="backdrop-blur bg-white/80 shadow-sm sticky top-0 z-10 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold">TN</div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">TaskNexus</h1>
                <p className="text-xs sm:text-sm text-slate-500">Client Workspace</p>
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
        {/* Welcome Section with Gradient */}
        <div className="mb-8 relative overflow-hidden rounded-2xl border border-slate-100 shadow-lg bg-gradient-to-r from-primary-500 via-blue-500 to-indigo-500 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.18),transparent_30%)]" />
          <div className="relative p-8">
            <h2 className="text-3xl font-bold mb-2">
              Welcome back, {user?.profile.firstName}! 👋
            </h2>
            <p className="text-lg text-white/90">
              Manage your projects, track spend, and stay on top of reviews.
            </p>
            {stats.totalTasks > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                <Badge tone="success"><CheckCircle className="w-4 h-4 mr-1" />{stats.completedTasks} completed</Badge>
                <Badge tone="warning"><Clock className="w-4 h-4 mr-1" />{stats.activeTasks} in progress</Badge>
                {stats.pendingReview > 0 && (
                  <Badge tone="amber"><AlertCircle className="w-4 h-4 mr-1" />{stats.pendingReview} pending review</Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 flex flex-wrap gap-3 items-start">
          <button
            onClick={handleCreateTask}
            className="btn btn-primary flex items-center text-sm sm:text-base shadow-lg hover:shadow-xl transition-all rounded-full px-4"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Task
          </button>
          <button
            onClick={handleViewAllTasks}
            className="btn btn-secondary flex items-center text-sm sm:text-base shadow-md hover:shadow-lg transition-all rounded-full px-4"
          >
            <List className="w-5 h-5 mr-2" />
            {viewAllTasks ? 'Show Recent Tasks' : 'View All Tasks'}
          </button>
          <div className="w-full md:max-w-2xl lg:max-w-3xl">
            <DashboardSettings
              preferences={preferences}
              togglePreference={togglePreference}
            />
          </div>
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
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              {viewAllTasks ? `All Tasks (${allTasks.length})` : `Recent Tasks (${recentTasks.length})`}
            </h3>
            {(recentTasks.length > 0 || viewAllTasks) && (
              <button
                onClick={handleViewAllTasks}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
              >
                {viewAllTasks ? '← Show Recent' : 'View All →'}
              </button>
            )}
          </div>
          <div className="p-6">
            {(viewAllTasks ? allTasks : recentTasks).length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No tasks yet"
                description="Create your first task to get started"
                action={
                  <button onClick={handleCreateTask} className="btn btn-primary flex items-center">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </button>
                }
              />
            ) : (
              <div className="space-y-4">
                {(viewAllTasks ? allTasks : recentTasks).map((task) => (
                  <TaskCard
                    key={task.id || task._id}
                    task={task}
                    onRefresh={fetchDashboardData}
                    onViewDetails={handleViewTask}
                    preferences={preferences}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTaskCreated={handleTaskCreated}
      />
      <TaskDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        task={selectedTask}
      />
    </div>
  );
};

// Task Card Component
const TaskCard = ({ task, onRefresh, onViewDetails, preferences }) => {
  const formatDate = (date) => {
    if (!date) return 'No deadline';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const progress = task.metrics?.progress ?? null;
  const compact = preferences?.compactCards;
  const paddingClass = compact ? 'p-4' : 'p-5';

  return (
    <div className={`border border-slate-200 rounded-xl ${paddingClass} hover:shadow-xl transition-all duration-200 hover:border-primary-200 bg-white/80 backdrop-blur-sm`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-2 text-lg hover:text-primary-600 transition-colors">
            {task.task_details?.title || task.title || 'Untitled Task'}
          </h4>
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {task.task_details?.description || task.description || 'No description'}
          </p>
        </div>
        <div className="ml-4">
          <StatusBadge status={task.status} />
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-4 text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
        <span className="flex items-center font-medium">
          <DollarSign className="w-4 h-4 mr-1 text-green-600" />
          ${task.task_details?.budget || task.budget || 0}
        </span>
        <span className="flex items-center">
          <Calendar className="w-4 h-4 mr-1 text-blue-600" />
          {formatDate(task.task_details?.deadline || task.deadline)}
        </span>
        {(task.task_details?.type || task.category) && (
          <span className="flex items-center capitalize">
            <FileText className="w-4 h-4 mr-1 text-purple-600" />
            {(task.task_details?.type || task.category).replace(/[_-]/g, ' ')}
          </span>
        )}
        {progress !== null && (
          <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
            {progress}% complete
          </span>
        )}
      </div>

      {progress !== null && preferences?.showProgressBars && (
        <div className="mb-4">
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-blue-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex space-x-2">
        <button
          onClick={() => onViewDetails(task)}
          className="btn-sm btn-primary flex items-center rounded-full px-4"
        >
          <Eye className="w-4 h-4 mr-1" />
          View Details
        </button>
        {task.status === 'open' && (
          <button className="btn-sm btn-secondary flex items-center">
            <RefreshCw className="w-4 h-4 mr-1" />
            Edit Task
          </button>
        )}
      </div>
    </div>
  );
};

const Badge = ({ children, tone }) => {
  const tones = {
    success: 'bg-white/20 text-white border border-white/30',
    warning: 'bg-white/15 text-white border border-white/25',
    amber: 'bg-white/15 text-white border border-white/25',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${tones[tone] || tones.success}`}>
      {children}
    </span>
  );
};

export default ClientDashboard;
