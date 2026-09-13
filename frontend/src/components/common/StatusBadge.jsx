/**
 * Status Badge Component
 * Displays task status with appropriate styling
 */
const StatusBadge = ({ status }) => {
    const statusConfig = {
        submitted: { class: 'bg-blue-950/40 text-blue-200 border-blue-900', label: 'Submitted', dot: 'bg-blue-400' },
        under_review: { class: 'bg-amber-950/40 text-amber-200 border-amber-900', label: 'Under Review', dot: 'bg-amber-400' },
        assigned: { class: 'bg-purple-950/40 text-purple-200 border-purple-900', label: 'Assigned', dot: 'bg-purple-400' },
        in_progress: { class: 'bg-indigo-950/40 text-indigo-200 border-indigo-900', label: 'In Progress', dot: 'bg-indigo-400' },
        submitted_work: { class: 'bg-orange-950/40 text-orange-200 border-orange-900', label: 'Work Submitted', dot: 'bg-orange-400' },
        qa_review: { class: 'bg-pink-950/40 text-pink-200 border-pink-900', label: 'QA Review', dot: 'bg-pink-400' },
        revision_requested: { class: 'bg-red-950/40 text-red-200 border-red-900', label: 'Revision Requested', dot: 'bg-red-400' },
        delivered: { class: 'bg-teal-950/40 text-teal-200 border-teal-900', label: 'Delivered', dot: 'bg-teal-400' },
        client_revision: { class: 'bg-amber-950/40 text-amber-200 border-amber-900', label: 'Client Revision', dot: 'bg-amber-400' },
        completed: { class: 'bg-emerald-950/40 text-emerald-200 border-emerald-900', label: 'Completed', dot: 'bg-emerald-400' },
        cancelled: { class: 'bg-[#18191a] text-[#8a8f98] border-[#34343a]', label: 'Cancelled', dot: 'bg-[#62666d]' },
        disputed: { class: 'bg-red-950/50 text-red-100 border-red-800', label: 'Disputed', dot: 'bg-red-400' }
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
