/**
 * Loading Component
 * Reusable loading spinner component
 */
const Loading = ({ size = 'md', fullScreen = false, text = 'Loading...' }) => {
    const sizeClasses = {
        sm: 'h-4 w-4 border-2',
        md: 'h-8 w-8 border-2',
        lg: 'h-12 w-12 border-4',
    };

    const spinnerClass = `animate-spin rounded-full ${sizeClasses[size]} border-primary-600 border-t-transparent`;

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#010102]/90 backdrop-blur-sm">
                <div className="rounded-xl border border-[#34343a] bg-[#0f1011] px-8 py-6 text-center">
                    <div className={spinnerClass + ' mx-auto mb-4'}></div>
                    {text && <p className="font-medium text-[#d0d6e0]">{text}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-8">
            <div className="text-center">
                <div className={spinnerClass + ' mx-auto mb-2'}></div>
                {text && <p className="text-sm text-[#8a8f98]">{text}</p>}
            </div>
        </div>
    );
};

export default Loading;
