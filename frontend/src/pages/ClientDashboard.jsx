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

/**
 * Enhanced Client Dashboard with API Integration
 */
const ClientDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
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

  const handleViewAllTasks = () => {
    toast.info('Navigating to all tasks...');
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
        {/* Welcome Section with Gradient */}
        <div className="mb-8 bg-gradient-to-r from-primary-50 to-blue-50 rounded-2xl p-8 shadow-sm border border-primary-100">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.profile.firstName}! 👋
          </h2>
          <p className="text-gray-600 text-lg">
            Manage your tasks and track progress all in one place
          </p>
          {stats.totalTasks > 0 && (
            <div className="mt-4 flex items-center space-x-6 text-sm">
              <span className="flex items-center text-green-700 font-medium">
                <CheckCircle className="w-4 h-4 mr-1" />
                {stats.completedTasks} completed
              </span>
              <span className="flex items-center text-yellow-700 font-medium">
                <Clock className="w-4 h-4 mr-1" />
                {stats.activeTasks} in progress
              </span>
              {stats.pendingReview > 0 && (
                <span className="flex items-center text-orange-700 font-medium">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {stats.pendingReview} pending review
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={handleCreateTask}
            className="btn btn-primary flex items-center text-lg shadow-lg hover:shadow-xl transition-shadow"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Task
          </button>
          <button
            onClick={handleViewAllTasks}
            className="btn btn-secondary flex items-center text-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <List className="w-5 h-5 mr-2" />
            View All Tasks
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
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Recent Tasks</h3>
            {recentTasks.length > 0 && (
              <button
                onClick={handleViewAllTasks}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                View All →
              </button>
            )}
          </div>
          <div className="p-6">
            {recentTasks.length === 0 ? (
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
                {recentTasks.map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    onRefresh={fetchDashboardData}
                    onViewDetails={handleViewTask}
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
const TaskCard = ({ task, onRefresh, onViewDetails }) => {
  const formatDate = (date) => {
    if (!date) return 'No deadline';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-all duration-200 hover:border-primary-300 bg-white">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-2 text-lg hover:text-primary-600 transition-colors">
            {task.title || 'Untitled Task'}
          </h4>
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {task.description || 'No description'}
          </p>
        </div>
        <div className="ml-4">
          <StatusBadge status={task.status} />
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-4 text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
        <span className="flex items-center font-medium">
          <DollarSign className="w-4 h-4 mr-1 text-green-600" />
          ${task.budget || 0}
        </span>
        <span className="flex items-center">
          <Calendar className="w-4 h-4 mr-1 text-blue-600" />
          {formatDate(task.deadline)}
        </span>
        {task.category && (
          <span className="flex items-center capitalize">
            <FileText className="w-4 h-4 mr-1 text-purple-600" />
            {task.category.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => onViewDetails(task)}
          className="btn-sm btn-primary flex items-center"
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

export default ClientDashboard;
