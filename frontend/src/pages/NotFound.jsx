import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

/**
 * 404 Not Found Page
 */
const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary-600">404</h1>
        <h2 className="text-3xl font-semibold text-gray-900 mt-4 mb-2">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="btn btn-primary inline-flex items-center"
        >
          <Home className="w-4 h-4 mr-2" />
          Go Back Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
