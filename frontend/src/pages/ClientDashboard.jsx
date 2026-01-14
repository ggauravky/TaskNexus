import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, FileText, Clock, CheckCircle } from 'lucide-react';

/**
 * Client Dashboard
 */
const ClientDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  // Mock data - will be replaced with API calls
  const stats = {
    totalTasks: 12,
    activeTasks: 3,
    completedTasks: 9,
    pendingReview: 1
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">TaskNexus</h1>
              <p className="text-sm text-gray-600">Client Dashboard</p>
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
            Manage your tasks and track progress all in one place
          </p>
        </div>
        
        {/* Quick Action */}
        <div className="mb-8">
          <button className="btn btn-primary flex items-center text-lg">
            <Plus className="w-5 h-5 mr-2" />
            Create New Task
          </button>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Tasks"
            value={stats.totalTasks}
            icon={<FileText className="w-8 h-8 text-primary-600" />}
            color="bg-primary-50"
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
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingReview}
            icon={<Clock className="w-8 h-8 text-orange-600" />}
            color="bg-orange-50"
          />
        </div>
        
        {/* Recent Tasks */}
        <div className="card">
          <h3 className="text-xl font-bold mb-4">Recent Tasks</h3>
          <div className="space-y-4">
            {/* Placeholder for task list */}
            <div className="text-center py-8 text-gray-500">
              <p>No tasks yet. Create your first task to get started!</p>
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
