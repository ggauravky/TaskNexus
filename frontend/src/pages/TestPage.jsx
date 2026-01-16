/**
 * Simple Test Page to debug rendering issues
 */
const TestPage = () => {
    console.log('[TestPage] Rendering');

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                textAlign: 'center',
                maxWidth: '600px'
            }}>
                <h1 style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: '#1f2937',
                    marginBottom: '16px'
                }}>
                    ✅ Test Page Working!
                </h1>
                <p style={{
                    color: '#6b7280',
                    fontSize: '18px',
                    marginBottom: '24px'
                }}>
                    If you can see this, routing is working correctly.
                </p>
                <div style={{
                    backgroundColor: '#dbeafe',
                    padding: '16px',
                    borderRadius: '4px',
                    marginTop: '20px'
                }}>
                    <p style={{
                        color: '#1e40af',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}>
                        Check the browser console for detailed logs
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TestPage;
