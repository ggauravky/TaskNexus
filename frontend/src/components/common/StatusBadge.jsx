/**
 * Status Badge Component
 * Displays task status with appropriate styling
 */
const StatusBadge = ({ status }) => {
    const statusConfig = {
        submitted: { class: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Submitted', dot: 'bg-blue-600' },
        under_review: { class: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Under Review', dot: 'bg-yellow-600' },
        assigned: { class: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Assigned', dot: 'bg-purple-600' },
        in_progress: { class: 'bg-indigo-100 text-indigo-800 border-indigo-200', label: 'In Progress', dot: 'bg-indigo-600' },
        submitted_work: { class: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Work Submitted', dot: 'bg-orange-600' },
        qa_review: { class: 'bg-pink-100 text-pink-800 border-pink-200', label: 'QA Review', dot: 'bg-pink-600' },
        revision_requested: { class: 'bg-red-100 text-red-800 border-red-200', label: 'Revision Requested', dot: 'bg-red-600' },
        delivered: { class: 'bg-teal-100 text-teal-800 border-teal-200', label: 'Delivered', dot: 'bg-teal-600' },
        client_revision: { class: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Client Revision', dot: 'bg-amber-600' },
        completed: { class: 'bg-green-100 text-green-800 border-green-200', label: 'Completed', dot: 'bg-green-600' },
        cancelled: { class: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Cancelled', dot: 'bg-gray-600' },
        disputed: { class: 'bg-red-200 text-red-900 border-red-300', label: 'Disputed', dot: 'bg-red-700' }
    };

    const config = statusConfig[status] || statusConfig.submitted;

    return (
        <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${config.class}`}>
            <span className={`w-2 h-2 rounded-full ${config.dot} mr-2`}></span>
            {config.label}
        </span>
    );
};

export default StatusBadge;
