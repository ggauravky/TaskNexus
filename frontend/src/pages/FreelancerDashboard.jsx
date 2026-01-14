import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Briefcase, DollarSign, Star, TrendingUp } from 'lucide-react';

/**
 * Freelancer Dashboard
 */
const FreelancerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  // Mock data
  const stats = {
    activeTasks: 2,
    completedTasks: user?.freelancerProfile?.completedTasks || 0,
    earnings: 1250.00,
    performanceScore: user?.freelancerProfile?.performanceScore || 50,
    rating: user?.freelancerProfile?.rating || 0
  };
  
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

export default FreelancerDashboard;
