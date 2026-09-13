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
        <div className={`py-12 text-center ${className}`}>
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-[#34343a] bg-[#18191a]">
                <Icon className="h-6 w-6 text-[#828fff]" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-[#f7f8f8]">{title}</h3>
            <p className="mx-auto mb-6 max-w-sm text-sm leading-6 text-[#8a8f98]">{description}</p>
            {action && <div>{action}</div>}
        </div>
    );
};

export default EmptyState;
