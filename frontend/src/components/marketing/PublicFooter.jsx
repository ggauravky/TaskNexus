import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

const groups = [
  { title: "Product", links: [{ to: "/services", label: "Services" }] },
  { title: "Resources", links: [{ to: "/blog", label: "Blog" }, { to: "/support-jar", label: "Support Jar" }] },
  { title: "Access", links: [{ to: "/login", label: "Sign in" }, { to: "/register", label: "Create account" }, { to: "/admin/login", label: "Admin access" }] },
];

const PublicFooter = () => (
  <footer className="border-t border-white/10 bg-[#010102] text-slate-400">
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_2fr] lg:px-8">
      <div>
        <Link to="/" className="inline-flex items-center gap-3 text-white">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-primary-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-semibold">TaskNexus</span>
        </Link>
        <p className="mt-4 max-w-sm text-sm leading-6">A focused workspace for clearer tasks, visible progress, and accountable delivery.</p>
      </div>
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="text-sm font-semibold text-slate-200">{group.title}</h2>
            <ul className="mt-4 space-y-3">
              {group.links.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-sm transition-colors hover:text-white">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
    <div className="mx-auto max-w-7xl border-t border-white/10 px-4 py-5 text-xs sm:px-6 lg:px-8">
      © 2026 TaskNexus. Built for clearer work.
    </div>
  </footer>
);

export default PublicFooter;
