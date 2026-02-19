import { FileQuestion } from 'lucide-react';

/**
 * EmptyState Component
 * Displays when there's no data to show
 */
const EmptyState = ({
    icon: Icon = FileQuestion,
    title = "No data found",
    description = "Get started by creating your first item",
    action = null,
    className = ""
}) => {
    return (
        <div className={`text-center py-12 ${className}`}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 border border-primary-100 mb-4">
                <Icon className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">{description}</p>
            {action && <div>{action}</div>}
        </div>
    );
};

export default EmptyState;
