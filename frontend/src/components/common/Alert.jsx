import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

/**
 * Alert Component
 * Displays alert messages with different variants
 */
const Alert = ({ type = 'info', title, message, onClose, className = '' }) => {
    const variants = {
        success: {
            bg: 'bg-green-50',
            border: 'border-green-200',
            icon: <CheckCircle className="w-5 h-5 text-green-600" />,
            title: 'text-green-800',
            text: 'text-green-700',
        },
        error: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            icon: <AlertCircle className="w-5 h-5 text-red-600" />,
            title: 'text-red-800',
            text: 'text-red-700',
        },
        warning: {
            bg: 'bg-yellow-50',
            border: 'border-yellow-200',
            icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
            title: 'text-yellow-800',
            text: 'text-yellow-700',
        },
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            icon: <Info className="w-5 h-5 text-blue-600" />,
            title: 'text-blue-800',
            text: 'text-blue-700',
        },
    };

    const variant = variants[type] || variants.info;

    return (
        <div
            className={`${variant.bg} ${variant.border} border rounded-lg p-4 ${className}`}
            role="alert"
        >
            <div className="flex">
                <div className="flex-shrink-0">{variant.icon}</div>
                <div className="ml-3 flex-1">
                    {title && (
                        <h3 className={`text-sm font-medium ${variant.title} mb-1`}>
                            {title}
                        </h3>
                    )}
                    {message && <div className={`text-sm ${variant.text}`}>{message}</div>}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className={`ml-3 inline-flex rounded-md p-1.5 ${variant.text} hover:bg-opacity-20 focus:outline-none`}
                    >
                        <span className="sr-only">Dismiss</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default Alert;
