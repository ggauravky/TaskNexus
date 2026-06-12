import { Link, NavLink } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

const navItems = [
  { to: "/blog", label: "Blog" },
  { to: "/services", label: "Services" },
  { to: "/support-jar", label: "Support Jar" },
];

const PublicSiteLayout = ({
  eyebrow,
  title,
  subtitle,
  children,
  heroAside = null,
  heroActions = null,
}) => {
  return (
    <div className="shell bg-slate-50">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#081326] via-[#0f1c3c] to-[#155e75] text-white">
        <div className="absolute inset-0 hero-grid opacity-25" />
        <div className="absolute -left-12 top-12 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

        <nav className="relative z-10 container mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-6">
          <Link to="/" className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-glass backdrop-blur">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sky-100">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-semibold">TaskNexus</span>
              <span className="block text-xs text-slate-300">Managed delivery system</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white text-slate-900"
                      : "bg-white/10 text-slate-100 hover:bg-white/20"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/login" className="btn btn-secondary btn-sm">
              Login
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm inline-flex items-center gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <div className="relative z-10 container mx-auto px-6 pb-16 pt-6">
          <div className={`grid gap-8 ${heroAside ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                {eyebrow}
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
                {subtitle}
              </p>
              {heroActions ? <div className="mt-7 flex flex-wrap gap-3">{heroActions}</div> : null}
            </div>

            {heroAside ? <div className="public-hero-card">{heroAside}</div> : null}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">{children}</main>

      <footer className="bg-[#081326] py-10 text-slate-300">
        <div className="container mx-auto flex flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">TaskNexus</p>
            <p className="mt-1 text-sm text-slate-400">
              Managed delivery, sharper operations, and cleaner execution.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <Link to="/blog" className="hover:text-white">
              Blog
            </Link>
            <Link to="/services" className="hover:text-white">
              Services
            </Link>
            <Link to="/support-jar" className="hover:text-white">
              Support Jar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicSiteLayout;
