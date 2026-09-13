import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Briefcase as BriefcaseBusiness,
  CalendarRange,
  Compass,
  FolderKanban,
  History,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogIn,
  LogOut,
  Menu,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { dashboardFor } from "../../utils/teams";

const EmbeddedShellContext = createContext(false);

const baseLinks = [
  { to: "/teams", label: "Teams", icon: UsersRound },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/people", label: "People", icon: Compass },
  { to: "/hackathons", label: "Hackathons", icon: CalendarRange },
  { to: "/opportunities", label: "Opportunities", icon: BriefcaseBusiness },
];

const accountLinks = [
  { to: "/contributions", label: "Contributions", icon: History },
  { to: "/collaboration", label: "Requests", icon: Inbox },
  { to: "/applications", label: "Applications", icon: ListChecks },
  { to: "/profile", label: "Profile", icon: UserRound },
];

const adminLinks = [
  { to: "/admin/tasks", label: "Tasks", icon: ListChecks },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

const publicLinks = [
  { to: "/opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { to: "/hackathons", label: "Hackathons", icon: CalendarRange },
  { to: "/services", label: "Services", icon: LayoutDashboard },
  { to: "/blog", label: "Blog", icon: History },
  { to: "/support-jar", label: "Support", icon: HeartHandshake },
];

const navClass = ({ isActive }) => `app-nav-link ${isActive ? "is-active" : ""}`;

const Brand = ({ destination }) => (
  <Link to={destination} className="app-brand">
    <span className="app-brand-mark" aria-hidden="true">TN</span>
    <span className="truncate">TaskNexus</span>
  </Link>
);

const NavigationLink = ({ item, onNavigate, mobile = false }) => {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/teams"}
      onClick={onNavigate}
      className={mobile ? ({ isActive }) => `app-mobile-nav-link ${isActive ? "is-active" : ""}` : navClass}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {item.label}
    </NavLink>
  );
};

export const AppShellFrame = ({ children }) => {
  const { isAuthenticated, logout, user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const dashboard = isAuthenticated ? dashboardFor(user?.role) : "/";
  const desktopLinks = isAuthenticated ? baseLinks : publicLinks;
  const mobileLinks = isAuthenticated
    ? [
        { to: dashboard, label: "Workspace", icon: LayoutDashboard },
        ...baseLinks,
        ...accountLinks,
        ...(user?.role === "admin" ? adminLinks : []),
      ]
    : publicLinks;

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const focusable = () => Array.from(menuRef.current?.querySelectorAll('a[href], button:not([disabled])') || []);
    focusable()[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <div className="app-shell min-h-[100dvh] bg-[#010102] text-[#f7f8f8]">
      <header className="app-shell-header">
        <div className="app-shell-bar">
          <Brand destination={dashboard} />
          <nav className="app-desktop-nav" aria-label={isAuthenticated ? "Workspace navigation" : "Primary navigation"}>
            {isAuthenticated ? (
              <NavLink to={dashboard} end className={navClass}>
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Workspace
              </NavLink>
            ) : null}
            {desktopLinks.map((item) => <NavigationLink key={item.to} item={item} />)}
          </nav>
          <div className="ml-auto hidden items-center gap-2 xl:flex">
            {isAuthenticated ? (
              <>
                <NavLink to="/profile" className="app-account-link" aria-label="Open profile">
                  <span className="app-user-avatar" aria-hidden="true">{(user?.profile?.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}</span>
                  <span className="max-w-28 truncate">{user?.profile?.firstName || "Profile"}</span>
                </NavLink>
                <button type="button" onClick={() => logout()} className="team-button-secondary"><LogOut className="h-4 w-4" /> Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="team-button-secondary"><LogIn className="h-4 w-4" /> Sign in</Link>
                <Link to="/register" className="team-button-primary">Create account</Link>
              </>
            )}
          </div>
          <button
            ref={menuButtonRef}
            type="button"
            className="team-icon-button ml-auto xl:hidden"
            aria-expanded={menuOpen}
            aria-controls="app-mobile-navigation"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {isAuthenticated ? (
          <nav className="app-secondary-nav" aria-label="Workspace secondary navigation">
            {accountLinks.slice(0, 3).map((item) => <NavigationLink key={item.to} item={item} />)}
            {user?.role === "admin" ? adminLinks.map((item) => <NavigationLink key={item.to} item={item} />) : null}
          </nav>
        ) : null}
        {menuOpen ? (
          <div ref={menuRef} id="app-mobile-navigation" className="app-mobile-menu">
            <nav className="grid gap-1 sm:grid-cols-2" aria-label="Mobile navigation">
              {mobileLinks.map((item) => <NavigationLink key={`${item.to}-${item.label}`} item={item} mobile onNavigate={() => setMenuOpen(false)} />)}
            </nav>
            <div className="mt-3 border-t border-[#23252a] pt-3">
              {isAuthenticated ? (
                <button type="button" onClick={() => logout()} className="team-button-secondary w-full"><LogOut className="h-4 w-4" /> Sign out</button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/login" className="team-button-secondary">Sign in</Link>
                  <Link to="/register" className="team-button-primary">Create account</Link>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </header>
      <div className="app-shell-content">{children}</div>
    </div>
  );
};

export const AuthenticatedAppShell = ({ children }) => (
  <EmbeddedShellContext.Provider value>
    <AppShellFrame>{children}</AppShellFrame>
  </EmbeddedShellContext.Provider>
);

export const useEmbeddedAppShell = () => useContext(EmbeddedShellContext);
