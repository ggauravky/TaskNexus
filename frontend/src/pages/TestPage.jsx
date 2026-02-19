/**
 * Simple Test Page to debug rendering issues
 */
const TestPage = () => {
    console.log('[TestPage] Rendering');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 flex items-center justify-center p-6">
            <div className="max-w-xl w-full bg-white/90 border border-slate-100 rounded-3xl shadow-xl p-10 text-center">
                <h1 className="text-3xl font-bold text-slate-900 mb-4">
                    Test Page Working
                </h1>
                <p className="text-slate-600 text-lg mb-6">
                    If you can see this, routing is working correctly.
                </p>
                <div className="bg-primary-50 border border-primary-100 px-4 py-3 rounded-xl">
                    <p className="text-primary-700 text-sm font-semibold">
                        Check the browser console for detailed logs
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TestPage;
