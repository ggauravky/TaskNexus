import { LogIn, LogOut, UserRound, UsersRound } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { dashboardFor } from "../../utils/teams";

const navClass = ({ isActive }) => `team-nav-link ${isActive ? "is-active" : ""}`;

const TeamShell = ({ children }) => {
  const { isAuthenticated, logout, user } = useAuth();
  return (
    <div className="team-shell min-h-[100dvh] bg-[#010102] text-[#f7f8f8]">
      <header className="sticky top-0 z-40 border-b border-[#23252a] bg-[#010102]/95 backdrop-blur">
        <div className="mx-auto grid min-h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-2 sm:flex sm:flex-wrap sm:gap-3 sm:px-6 lg:px-8">
          <Link to={isAuthenticated ? dashboardFor(user?.role) : "/"} className="flex min-w-0 items-center gap-2 font-semibold tracking-[-0.02em]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5e6ad2] text-xs text-white">TN</span>
            <span className="truncate">TaskNexus</span>
          </Link>
          {isAuthenticated ? (
            <nav className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-1 sm:order-none sm:mr-auto" aria-label="Workspace navigation">
              <NavLink to={dashboardFor(user?.role)} className={navClass}>Workspace</NavLink>
              <NavLink to="/teams" end className={navClass}><UsersRound className="h-4 w-4" /> Teams</NavLink>
              <NavLink to="/profile" className={navClass}><UserRound className="h-4 w-4" /> Profile</NavLink>
            </nav>
          ) : null}
          {isAuthenticated ? (
            <button type="button" onClick={() => logout()} className="team-button-secondary"><LogOut className="h-4 w-4" /> Sign out</button>
          ) : (
            <Link to="/login" className="team-button-primary"><LogIn className="h-4 w-4" /> Sign in</Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
};

export default TeamShell;
