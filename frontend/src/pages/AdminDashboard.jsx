import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Users, Briefcase, DollarSign, Activity,
  TrendingUp, AlertCircle, CheckCircle, Clock, RefreshCw,
  UserCheck, FileText, Eye
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Loading from '../components/common/Loading';
import StatusBadge from '../components/common/StatusBadge';

/**
 * Admin Dashboard with Real Data
 */
const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/dashboard');

      if (response.data.success) {
        setDashboardData(response.data.data);
        setRecentActivity(response.data.data.recentTasks || []);
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
    return <Loading fullScreen={true} text="Loading admin dashboard..." />;
  }

  // Calculate stats from dashboard data
  const stats = dashboardData ? {
    totalTasks: dashboardData.tasks?.total || 0,
    pendingReview: dashboardData.tasks?.byStatus?.find(s => s._id === 'under_review')?.count || 0,
    activeTasks: dashboardData.tasks?.byStatus?.find(s => ['assigned', 'in_progress'].includes(s._id))?.count || 0,
    totalUsers: dashboardData.users?.total || 0,
    totalRevenue: dashboardData.platformRevenue || 0,
    totalClients: dashboardData.users?.clients || 0,
    totalFreelancers: dashboardData.users?.freelancers || 0
  } : {
    totalTasks: 0,
    pendingReview: 0,
    activeTasks: 0,
    totalUsers: 0,
    totalRevenue: 0,
    totalClients: 0,
    totalFreelancers: 0
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">TaskNexus</h1>
              <p className="text-sm text-gray-600">Admin Dashboard</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user?.profile?.firstName} {user?.profile?.lastName}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-sm btn-secondary flex items-center"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
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
            Admin Control Center
          </h2>
          <p className="text-gray-600">
            Manage tasks, users, and monitor platform performance
          </p>
        </div>

        {/* Platform Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Tasks"
            value={stats.totalTasks}
            icon={<Briefcase className="w-8 h-8 text-primary-600" />}
            color="bg-primary-50"
            subtitle={`${stats.activeTasks} active`}
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingReview}
            icon={<Clock className="w-8 h-8 text-orange-600" />}
            color="bg-orange-50"
            subtitle="Needs attention"
          />
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon={<Users className="w-8 h-8 text-green-600" />}
            color="bg-green-50"
            subtitle={`${stats.totalClients} clients, ${stats.totalFreelancers} freelancers`}
          />
          <StatCard
            title="Platform Revenue"
            value={`$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<DollarSign className="w-8 h-8 text-purple-600" />}
            color="bg-purple-50"
            subtitle="Commission earned"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <ActionCard
            title="Review Tasks"
            description="Review and assign pending tasks"
            buttonText="View Tasks"
            onClick={() => navigate('/admin/tasks')}
          />
          <ActionCard
            title="Manage Users"
            description="View and manage platform users"
            buttonText="View Users"
            onClick={() => navigate('/admin/users')}
          />
          <ActionCard
            title="Analytics"
            description="View platform analytics and insights"
            buttonText="View Analytics"
            onClick={() => navigate('/admin/analytics')}
          />
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="text-xl font-bold mb-4">Recent Tasks</h3>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Task
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Freelancer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentActivity.map((task) => (
                      <tr key={task._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {task.taskDetails?.title || task.title || 'Untitled Task'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {task.client?.profile?.firstName} {task.client?.profile?.lastName}
                          </div>
                          <div className="text-xs text-gray-500">{task.client?.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {task.freelancer ? (
                            <>
                              <div className="text-sm text-gray-900">
                                {task.freelancer?.profile?.firstName} {task.freelancer?.profile?.lastName}
                              </div>
                              <div className="text-xs text-gray-500">{task.freelancer?.email}</div>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${(task.taskDetails?.budget || task.budget || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(task.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

/**
 * Stat Card Component
 */
const StatCard = ({ title, value, icon, color, subtitle }) => {
  return (
    <div className="card">
      <div className="flex flex-col">
        <div className={`p-3 rounded-lg ${color} w-fit mb-3`}>
          {icon}
        </div>
        <p className="text-sm text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

/**
 * Action Card Component
 */
const ActionCard = ({ title, description, buttonText, onClick }) => {
  return (
    <div className="card">
      <h4 className="text-lg font-semibold mb-2">{title}</h4>
      <p className="text-gray-600 mb-4 text-sm">{description}</p>
      <button onClick={onClick} className="btn btn-primary w-full">
        {buttonText}
      </button>
    </div>
  );
};

export default AdminDashboard;
