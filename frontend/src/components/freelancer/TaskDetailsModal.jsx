import { X, Calendar, DollarSign, User, Clock, FileText, CheckCircle } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

/**
 * Task Details Modal for Freelancer
 * Shows comprehensive task information
 */
const TaskDetailsModal = ({ isOpen, onClose, task }) => {
    if (!isOpen || !task) return null;

    const formatDate = (date) => {
        if (!date) return 'No deadline';
        return new Date(date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };

    const getDaysRemaining = (deadline) => {
        if (!deadline) return null;
        const days = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
        if (days < 0) return `${Math.abs(days)} days overdue`;
        if (days === 0) return 'Due today';
        if (days === 1) return '1 day remaining';
        return `${days} days remaining`;
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start z-10">
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                {task.title || 'Untitled Task'}
                            </h2>
                            <div className="flex items-center gap-3">
                                <StatusBadge status={task.status} />
                                {task.type && (
                                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                        {task.type.replace(/-/g, ' ').toUpperCase()}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-6 space-y-6">
                        {/* Quick Info Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                <div className="flex items-center text-green-600 mb-1">
                                    <DollarSign className="w-5 h-5 mr-2" />
                                    <span className="text-sm font-medium">Budget</span>
                                </div>
                                <p className="text-2xl font-bold text-green-700">
                                    {formatCurrency(task.budget)}
                                </p>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <div className="flex items-center text-blue-600 mb-1">
                                    <Calendar className="w-5 h-5 mr-2" />
                                    <span className="text-sm font-medium">Deadline</span>
                                </div>
                                <p className="text-lg font-semibold text-blue-700">
                                    {formatDate(task.deadline).split(',')[0]}
                                </p>
                                <p className="text-sm text-blue-600 mt-1">
                                    {getDaysRemaining(task.deadline)}
                                </p>
                            </div>
                        </div>

                        {/* Client Information */}
                        {task.client && (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex items-center text-gray-700 mb-3">
                                    <User className="w-5 h-5 mr-2" />
                                    <span className="font-semibold">Client Information</span>
                                </div>
                                <div className="space-y-2 ml-7">
                                    <div>
                                        <span className="text-sm text-gray-600">Name: </span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {task.client.profile?.firstName} {task.client.profile?.lastName}
                                        </span>
                                    </div>
                                    {task.client.email && (
                                        <div>
                                            <span className="text-sm text-gray-600">Email: </span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {task.client.email}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <div className="flex items-center text-gray-700 mb-3">
                                <FileText className="w-5 h-5 mr-2" />
                                <h3 className="font-semibold text-lg">Description</h3>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {task.description || 'No description provided'}
                                </p>
                            </div>
                        </div>

                        {/* Skills Required */}
                        {task.skillsRequired && task.skillsRequired.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-lg text-gray-700 mb-3">
                                    Skills Required
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {task.skillsRequired.map((skill, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Experience Level */}
                        {task.experienceLevel && (
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-600">Experience Level:</span>
                                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium capitalize">
                                    {task.experienceLevel}
                                </span>
                            </div>
                        )}

                        {/* Task Timeline */}
                        {(task.workflow?.assignedAt || task.workflow?.startedAt || task.createdAt) && (
                            <div>
                                <h3 className="font-semibold text-lg text-gray-700 mb-3">
                                    Timeline
                                </h3>
                                <div className="space-y-3 ml-4">
                                    {task.createdAt && (
                                        <div className="flex items-start">
                                            <div className="w-2 h-2 rounded-full bg-gray-400 mt-2 mr-3"></div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Task Created</p>
                                                <p className="text-xs text-gray-500">{formatDate(task.createdAt)}</p>
                                            </div>
                                        </div>
                                    )}
                                    {task.workflow?.assignedAt && (
                                        <div className="flex items-start">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 mr-3"></div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Task Assigned</p>
                                                <p className="text-xs text-gray-500">{formatDate(task.workflow.assignedAt)}</p>
                                            </div>
                                        </div>
                                    )}
                                    {task.workflow?.startedAt && (
                                        <div className="flex items-start">
                                            <div className="w-2 h-2 rounded-full bg-green-500 mt-2 mr-3"></div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Work Started</p>
                                                <p className="text-xs text-gray-500">{formatDate(task.workflow.startedAt)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Task ID */}
                        <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                            Task ID: {task.taskId || task._id}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={onClose}
                                className="btn btn-secondary"
                            >
                                Close
                            </button>
                            {task.status === 'assigned' && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        // This will be implemented later for starting work
                                        onClose();
                                    }}
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Start Working
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailsModal;
