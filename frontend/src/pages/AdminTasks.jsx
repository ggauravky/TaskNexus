import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Search, X,
    CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Loading from '../components/common/Loading';
import StatusBadge from '../components/common/StatusBadge';

const AdminTasks = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState([]);
    const [filteredTasks, setFilteredTasks] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedTask, setSelectedTask] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    useEffect(() => {
        fetchTasks();
    }, []);

    useEffect(() => {
        let filtered = [...tasks];

        if (statusFilter !== 'all') {
            filtered = filtered.filter(task => task.status === statusFilter);
        }

        if (searchTerm) {
            filtered = filtered.filter(task =>
                task.taskDetails?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.client?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.freelancer?.email?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredTasks(filtered);
    }, [tasks, searchTerm, statusFilter]);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/tasks');
            if (response.data.success) {
                setTasks(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
            toast.error('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (task) => {
        setSelectedTask(task);
        setShowDetailsModal(true);
    };

    const handleUpdateStatus = async (taskId, newStatus) => {
        try {
            const response = await api.patch(`/admin/tasks/${taskId}/status`, { status: newStatus });
            if (response.data.success) {
                toast.success('Task status updated!');
                fetchTasks();
                setShowDetailsModal(false);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update status');
        }
    };

    if (loading) {
        return <Loading fullScreen={true} text="Loading tasks..." />;
    }

    const pendingReview = tasks.filter(t => t.status === 'under_review').length;
    const assigned = tasks.filter(t => t.status === 'assigned').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            {/* Header */}
            <header className="bg-white/85 backdrop-blur border-b border-slate-100 sticky top-0 z-20">
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
                                <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
                                <p className="text-sm text-gray-600">Review and manage all platform tasks</p>
                            </div>
                        </div>
                        <button
                            onClick={fetchTasks}
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
                <div className="mb-6 rounded-2xl border border-slate-100 bg-gradient-to-r from-primary-600 to-cyan-600 p-6 text-white shadow-xl">
                    <h2 className="text-2xl font-bold">Task Operations</h2>
                    <p className="text-primary-100 text-sm mt-1">Review, triage, and close tasks quickly from one workspace.</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <StatCard title="Pending Review" value={pendingReview} color="bg-orange-50 text-orange-600" />
                    <StatCard title="Assigned" value={assigned} color="bg-blue-50 text-blue-600" />
                    <StatCard title="In Progress" value={inProgress} color="bg-yellow-50 text-yellow-600" />
                    <StatCard title="Completed" value={completed} color="bg-green-50 text-green-600" />
                </div>

                {/* Filters */}
                <div className="bg-white/90 rounded-2xl border border-slate-100 shadow-sm p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search tasks, clients, freelancers..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input pl-10 py-2"
                                />
                            </div>
                        </div>
                        <div className="w-full md:w-48">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="input py-2"
                            >
                                <option value="all">All Status</option>
                                <option value="submitted">Submitted</option>
                                <option value="under_review">Under Review</option>
                                <option value="assigned">Assigned</option>
                                <option value="in_progress">In Progress</option>
                                <option value="submitted_work">Work Submitted</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tasks Table */}
                <div className="bg-white/90 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50/80">
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
                                        Deadline
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white/90 divide-y divide-slate-100">
                                {filteredTasks.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                            <p>No tasks found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTasks.map((task) => (
                                        <tr key={task._id} className="hover:bg-slate-50/80">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {task.taskDetails?.title || 'Untitled Task'}
                                                </div>
                                                <div className="text-xs text-gray-500 line-clamp-1">
                                                    {task.taskDetails?.description}
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
                                                ${(task.taskDetails?.budget || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <StatusBadge status={task.status} />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(task.taskDetails?.deadline).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                <button
                                                    onClick={() => handleViewDetails(task)}
                                                    className="text-primary-600 hover:text-primary-900 font-medium"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Task Details Modal */}
            {showDetailsModal && selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    onClose={() => setShowDetailsModal(false)}
                    onUpdateStatus={handleUpdateStatus}
                />
            )}
        </div>
    );
};

const StatCard = ({ title, value, color }) => (
    <div className="bg-white/90 rounded-2xl border border-slate-100 shadow-sm p-4">
        <p className="text-sm text-gray-600 mb-1">{title}</p>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
);

const TaskDetailsModal = ({ task, onClose, onUpdateStatus }) => {
    return (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 rounded-2xl border border-white/70 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Task Details</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Title</label>
                            <p className="text-gray-900">{task.taskDetails?.title}</p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700">Description</label>
                            <p className="text-gray-900">{task.taskDetails?.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700">Budget</label>
                                <p className="text-gray-900">${task.taskDetails?.budget.toLocaleString()}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700">Deadline</label>
                                <p className="text-gray-900">{new Date(task.taskDetails?.deadline).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700">Status</label>
                            <div className="mt-1">
                                <StatusBadge status={task.status} />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700">Client</label>
                            <p className="text-gray-900">
                                {task.client?.profile?.firstName} {task.client?.profile?.lastName} ({task.client?.email})
                            </p>
                        </div>

                        {task.freelancer && (
                            <div>
                                <label className="text-sm font-medium text-gray-700">Freelancer</label>
                                <p className="text-gray-900">
                                    {task.freelancer?.profile?.firstName} {task.freelancer?.profile?.lastName} ({task.freelancer?.email})
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2 pt-4">
                            {task.status === 'under_review' && (
                                <button
                                    onClick={() => onUpdateStatus(task._id, 'assigned')}
                                    className="btn btn-primary flex-1"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Approve & Assign
                                </button>
                            )}
                            <button onClick={onClose} className="btn btn-secondary flex-1">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminTasks;
