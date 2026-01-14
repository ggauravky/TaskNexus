import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Briefcase, DollarSign, Star, TrendingUp, Clock,
  CheckCircle, RefreshCw, Eye, Target
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';

/**
 * Enhanced Freelancer Dashboard with API Integration
 */
const FreelancerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    activeTasks: 0,
    completedTasks: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    performanceScore: 0,
    rating: 0,
    onTimeDeliveryRate: 0
  });
  const [myTasks, setMyTasks] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, myTasksRes, availableRes] = await Promise.all([
        api.get('/freelancer/dashboard'),
        api.get('/freelancer/my-tasks?limit=5'),
        api.get('/freelancer/available-tasks?limit=5')
      ]);

      if (dashboardRes.data.success) {
        setStats(dashboardRes.data.data);
      }

      if (myTasksRes.data.success) {
        setMyTasks(myTasksRes.data.data.tasks || []);
      }

      if (availableRes.data.success) {
        setAvailableTasks(availableRes.data.data.tasks || []);
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
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">TaskNexus</h1>
              <p className="text-sm text-gray-600">Freelancer Dashboard</p>
            </div>
            <div className="flex items-center space-x-4">
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
            Welcome back, {user?.profile.firstName}!
          </h2>
          <p className="text-gray-600">
            Here's your performance overview and assigned tasks
          </p>
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard
            title="Active Tasks"
            value={stats.activeTasks}
            icon={<Briefcase className="w-8 h-8 text-primary-600" />}
            color="bg-primary-50"
          />
          <StatCard
            title="Completed"
            value={stats.completedTasks}
            icon={<TrendingUp className="w-8 h-8 text-green-600" />}
            color="bg-green-50"
          />
          <StatCard
            title="Total Earnings"
            value={`$${stats.earnings}`}
            icon={<DollarSign className="w-8 h-8 text-yellow-600" />}
            color="bg-yellow-50"
          />
          <StatCard
            title="Performance"
            value={`${stats.performanceScore}/100`}
            icon={<Star className="w-8 h-8 text-purple-600" />}
            color="bg-purple-50"
          />
          <StatCard
            title="Rating"
            value={stats.rating > 0 ? `${stats.rating}/5 ⭐` : 'No ratings'}
            icon={<Star className="w-8 h-8 text-orange-600" />}
            color="bg-orange-50"
          />
        </div>

        {/* Skills Section */}
        <div className="card mb-8">
          <h3 className="text-xl font-bold mb-4">Your Skills</h3>
          <div className="flex flex-wrap gap-2">
            {user?.freelancerProfile?.skills?.length > 0 ? (
              user.freelancerProfile.skills.map((skill, index) => (
                <span key={index} className="badge badge-info">
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-gray-500">No skills added yet. Update your profile to add skills.</p>
            )}
          </div>
        </div>

        {/* Assigned Tasks */}
        <div className="card">
          <h3 className="text-xl font-bold mb-4">Assigned Tasks</h3>
          <div className="space-y-4">
            <div className="text-center py-8 text-gray-500">
              <p>No tasks assigned yet. Tasks will appear here once assigned by admin.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FreelancerDashboard;
