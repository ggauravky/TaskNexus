import { X, DollarSign, Calendar, User, Tag, Clock, FileText, Activity } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

/**
 * Task Details Modal Component
 * Shows detailed information about a task
 */
const TaskDetailsModal = ({ isOpen, onClose, task }) => {
    if (!isOpen || !task) return null;

    // Normalize task fields (Supabase rows use task_details JSONB)
    const details = task.task_details || {};
    const workflow = task.workflow || {};

    const title = details.title || task.title || 'Task Details';
    const description = details.description || task.description || 'No description provided';
    const budget = details.budget ?? task.budget ?? 0;
    const deadline = details.deadline || task.deadline;
    const category = details.type || task.category;
    const experienceLevel = details.experienceLevel || task.experienceLevel;
    const skillsRequired = details.skillsRequired || task.skillsRequired;
    const createdAt = task.created_at || task.createdAt;
    const updatedAt = task.updated_at || task.updatedAt;

    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 rounded-2xl shadow-2xl border border-white/70 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {title}
                        </h2>
                        <StatusBadge status={task.status} />
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Description */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <FileText className="w-5 h-5 mr-2 text-primary-600" />
                            Description
                        </h3>
                        <p className="text-gray-700 whitespace-pre-wrap">
                            {description}
                        </p>
                    </div>

                    {/* Task Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Budget */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center text-gray-600 mb-1">
                                <DollarSign className="w-5 h-5 mr-2" />
                                <span className="text-sm font-medium">Budget</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">
                                ${budget}
                            </p>
                        </div>

                        {/* Deadline */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center text-gray-600 mb-1">
                                <Calendar className="w-5 h-5 mr-2" />
                                <span className="text-sm font-medium">Deadline</span>
                            </div>
                            <p className="text-xl font-semibold text-gray-900">
                                {formatDate(deadline)}
                            </p>
                        </div>

                        {/* Category */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center text-gray-600 mb-1">
                                <Tag className="w-5 h-5 mr-2" />
                                <span className="text-sm font-medium">Category</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900 capitalize">
                                {category ? category.replace(/[_-]/g, ' ') : 'N/A'}
                            </p>
                        </div>

                        {/* Experience Level */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center text-gray-600 mb-1">
                                <Clock className="w-5 h-5 mr-2" />
                                <span className="text-sm font-medium">Experience Level</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900 capitalize">
                                {experienceLevel || 'N/A'}
                            </p>
                        </div>
                    </div>

                    {/* Skills Required */}
                    {skillsRequired && skillsRequired.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Skills Required</h3>
                            <div className="flex flex-wrap gap-2">
                                {skillsRequired.map((skill, index) => (
                                    <span
                                        key={index}
                                        className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
                                    >
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Freelancer Info */}
                    {task.freelancerId && (
                        <div className="border-t pt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                                <User className="w-5 h-5 mr-2 text-primary-600" />
                                Assigned Freelancer
                            </h3>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="font-medium text-gray-900">
                                    {task.freelancerId.profile?.firstName} {task.freelancerId.profile?.lastName}
                                </p>
                                <p className="text-sm text-gray-600">{task.freelancerId.email}</p>
                                {task.freelancerId.freelancerProfile?.rating && (
                                    <p className="text-sm text-yellow-600 mt-1">
                                        Rating: {task.freelancerId.freelancerProfile.rating.toFixed(1)}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Timestamps */}
                    <div className="border-t pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                                <span className="font-medium">Created:</span> {formatDate(createdAt)}
                            </div>
                            <div>
                                <span className="font-medium">Last Updated:</span> {formatDate(updatedAt)}
                            </div>
                            {workflow.assignedAt && (
                                <div>
                                    <span className="font-medium">Assigned:</span> {formatDate(workflow.assignedAt)}
                                </div>
                            )}
                            <div>
                                <span className="font-medium">Task ID:</span> {task.task_id || task.id || task._id}
                            </div>
                        </div>
                    </div>

                    {/* Progress for client view */}
                    {(task.metrics?.progress !== undefined || task.metrics?.stage) && (
                        <div className="border-t pt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                                <Activity className="w-5 h-5 mr-2 text-primary-600" />
                                Progress
                            </h3>
                            <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden">
                                <div
                                    className="bg-primary-500 h-3"
                                    style={{ width: `${task.metrics?.progress || 0}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-sm text-gray-700">
                                <span>{task.metrics?.progress || 0}% complete</span>
                                {task.metrics?.stage && (
                                    <span className="capitalize">Stage: {task.metrics.stage.replace(/_/g, ' ')}</span>
                                )}
                            </div>
                            {task.metrics?.progressNote && (
                                <p className="text-sm text-gray-600 mt-2">
                                    Update: {task.metrics.progressNote}
                                </p>
                            )}
                            {task.metrics?.progressUpdatedAt && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Last update: {formatDate(task.metrics.progressUpdatedAt)}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t bg-gray-50 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="btn btn-secondary w-full"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailsModal;
