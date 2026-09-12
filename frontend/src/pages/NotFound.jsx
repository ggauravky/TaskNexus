import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import PublicNavigation from '../components/marketing/PublicNavigation';

/**
 * 404 Not Found Page
 */
const NotFound = () => {
  return (
    <div className="min-h-screen bg-[#010102] text-[#f7f8f8]">
      <header className="border-b border-[#23252a]"><PublicNavigation dark /></header>
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4">
      <div className="max-w-lg rounded-xl border border-[#23252a] bg-[#0f1011] p-8 text-center sm:p-10">
        <p className="team-eyebrow">Error 404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">This page is not here.</h1>
        <h2 className="sr-only">
          Page Not Found
        </h2>
        <p className="mb-8 mt-4 text-sm leading-6 text-[#8a8f98]">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="team-button-primary"
        >
          <Home className="w-4 h-4 mr-2" />
          Go back home
        </Link>
      </div>
      </main>
    </div>
  );
};

export default NotFound;
