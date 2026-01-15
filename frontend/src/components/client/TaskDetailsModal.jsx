import { useState } from 'react';
import { X, DollarSign, Calendar, User, Tag, Clock, MapPin, FileText } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

/**
 * Task Details Modal Component
 * Shows detailed information about a task
 */
const TaskDetailsModal = ({ isOpen, onClose, task }) => {
    if (!isOpen || !task) return null;

    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {task.title || 'Task Details'}
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
                            {task.description || 'No description provided'}
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
                                ${task.budget || 0}
                            </p>
                        </div>

                        {/* Deadline */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center text-gray-600 mb-1">
                                <Calendar className="w-5 h-5 mr-2" />
                                <span className="text-sm font-medium">Deadline</span>
                            </div>
                            <p className="text-xl font-semibold text-gray-900">
                                {formatDate(task.deadline)}
                            </p>
                        </div>

                        {/* Category */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center text-gray-600 mb-1">
                                <Tag className="w-5 h-5 mr-2" />
                                <span className="text-sm font-medium">Category</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900 capitalize">
                                {task.category?.replace(/_/g, ' ') || 'N/A'}
                            </p>
                        </div>

                        {/* Experience Level */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center text-gray-600 mb-1">
                                <Clock className="w-5 h-5 mr-2" />
                                <span className="text-sm font-medium">Experience Level</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900 capitalize">
                                {task.experienceLevel || 'N/A'}
                            </p>
                        </div>
                    </div>

                    {/* Skills Required */}
                    {task.skillsRequired && task.skillsRequired.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Skills Required</h3>
                            <div className="flex flex-wrap gap-2">
                                {task.skillsRequired.map((skill, index) => (
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
                                        ⭐ {task.freelancerId.freelancerProfile.rating.toFixed(1)} rating
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Timestamps */}
                    <div className="border-t pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                                <span className="font-medium">Created:</span> {formatDate(task.createdAt)}
                            </div>
                            <div>
                                <span className="font-medium">Last Updated:</span> {formatDate(task.updatedAt)}
                            </div>
                        </div>
                    </div>
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
