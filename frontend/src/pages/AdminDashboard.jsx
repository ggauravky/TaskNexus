import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, Briefcase, DollarSign, Activity } from 'lucide-react';

/**
 * Admin Dashboard
 */
const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  // Mock data
  const stats = {
    totalTasks: 45,
    pendingReview: 8,
    activeTasks: 15,
    totalUsers: 120,
    totalRevenue: 12450.00
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
            Admin Control Center
          </h2>
          <p className="text-gray-600">
            Manage tasks, users, and monitor platform performance
          </p>
        </div>
        
        {/* Platform Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard
            title="Total Tasks"
            value={stats.totalTasks}
            icon={<Briefcase className="w-8 h-8 text-primary-600" />}
            color="bg-primary-50"
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingReview}
            icon={<Activity className="w-8 h-8 text-orange-600" />}
            color="bg-orange-50"
          />
          <StatCard
            title="Active Tasks"
            value={stats.activeTasks}
            icon={<Activity className="w-8 h-8 text-yellow-600" />}
            color="bg-yellow-50"
          />
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon={<Users className="w-8 h-8 text-green-600" />}
            color="bg-green-50"
          />
          <StatCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            icon={<DollarSign className="w-8 h-8 text-purple-600" />}
            color="bg-purple-50"
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
          <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="text-center py-8 text-gray-500">
              <p>Recent platform activity will appear here</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

/**
 * Stat Card Component
 */
const StatCard = ({ title, value, icon, color }) => {
  return (
    <div className="card">
      <div className="flex flex-col">
        <div className={`p-3 rounded-lg ${color} w-fit mb-3`}>
          {icon}
        </div>
        <p className="text-sm text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
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
