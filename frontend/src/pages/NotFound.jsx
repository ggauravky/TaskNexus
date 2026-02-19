import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

/**
 * 404 Not Found Page
 */
const NotFound = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4">
      <div className="text-center max-w-lg bg-white/90 border border-slate-100 shadow-xl rounded-3xl p-10">
        <h1 className="text-8xl font-bold bg-gradient-to-r from-primary-600 to-cyan-600 bg-clip-text text-transparent">404</h1>
        <h2 className="text-3xl font-semibold text-gray-900 mt-4 mb-2">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="btn btn-primary inline-flex items-center rounded-full px-6"
        >
          <Home className="w-4 h-4 mr-2" />
          Go Back Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
