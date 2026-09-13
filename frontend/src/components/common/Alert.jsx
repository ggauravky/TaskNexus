import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

/**
 * Alert Component
 * Displays alert messages with different variants
 */
const Alert = ({ type = 'info', title, message, onClose, className = '' }) => {
    const variants = {
        success: {
            bg: 'bg-emerald-950/40',
            border: 'border-emerald-900',
            icon: <CheckCircle className="w-5 h-5 text-emerald-300" />,
            title: 'text-emerald-100',
            text: 'text-emerald-200',
        },
        error: {
            bg: 'bg-red-950/40',
            border: 'border-red-900',
            icon: <AlertCircle className="w-5 h-5 text-red-300" />,
            title: 'text-red-100',
            text: 'text-red-200',
        },
        warning: {
            bg: 'bg-amber-950/40',
            border: 'border-amber-900',
            icon: <AlertTriangle className="w-5 h-5 text-amber-300" />,
            title: 'text-amber-100',
            text: 'text-amber-200',
        },
        info: {
            bg: 'bg-indigo-950/40',
            border: 'border-indigo-900',
            icon: <Info className="w-5 h-5 text-indigo-300" />,
            title: 'text-indigo-100',
            text: 'text-indigo-200',
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
