/**
 * Error Boundary Component
 * Catches JavaScript errors in the component tree
 */
import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        if (import.meta.env.DEV) console.error('Error caught by ErrorBoundary:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-[#010102] px-4 text-[#f7f8f8]">
                    <div className="w-full max-w-md rounded-xl border border-[#34343a] bg-[#0f1011] p-8 text-center">
                        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-400" />
                        <h1 className="mb-2 text-2xl font-semibold">
                            Something went wrong
                        </h1>
                        <p className="mb-6 text-sm leading-6 text-[#8a8f98]">
                            We are sorry for the inconvenience. Please try refreshing the page.
                        </p>

                        {import.meta.env.DEV && this.state.error && (
                            <details className="mb-4 rounded-lg border border-[#23252a] bg-[#141516] p-4 text-left">
                                <summary className="mb-2 cursor-pointer font-medium text-[#d0d6e0]">
                                    Error details
                                </summary>
                                <pre className="text-xs text-red-600 overflow-auto">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="btn btn-primary w-full"
                        >
                            Refresh page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
