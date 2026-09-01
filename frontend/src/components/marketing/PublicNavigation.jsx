import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowRight, Menu, Sparkles, X } from "lucide-react";

const links = [
  { to: "/services", label: "Services" },
  { to: "/blog", label: "Blog" },
  { to: "/support-jar", label: "Support Jar" },
];

const PublicNavigation = ({ dark = false }) => {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      );

    focusable()[0]?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key === "Tab") {
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
      }
    };

    const handlePointerDown = (event) => {
      if (
        !panelRef.current?.contains(event.target) &&
        !menuButtonRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  const textClass = dark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-950";

  return (
    <nav aria-label="Primary navigation" className="relative z-40 mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <Link to="/" className="inline-flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${dark ? "border border-white/10 bg-white/5 text-primary-300" : "bg-slate-950 text-white"}`}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className={`text-base font-semibold tracking-tight ${dark ? "text-white" : "text-slate-950"}`}>TaskNexus</span>
      </Link>

      <div className="hidden items-center gap-1 md:flex">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 ${isActive ? (dark ? "bg-white/10 text-white" : "bg-slate-100 text-slate-950") : textClass}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <Link to="/login" className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 ${textClass}`}>
          Sign in
        </Link>
        <Link to="/register" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-300">
          Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <button
        ref={menuButtonRef}
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-public-menu"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border md:hidden ${dark ? "border-white/10 bg-white/5 text-white" : "border-slate-200 bg-white text-slate-900"}`}
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>

      {open ? (
        <div
          ref={panelRef}
          id="mobile-public-menu"
          className={`absolute left-4 right-4 top-[calc(100%+0.5rem)] rounded-xl border p-3 shadow-2xl md:hidden ${dark ? "border-white/10 bg-[#0f1011] text-white" : "border-slate-200 bg-white text-slate-950"}`}
        >
          <div className="grid gap-1">
            {links.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={`rounded-lg px-3 py-3 text-sm font-medium ${textClass}`}>
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className={`mt-3 grid grid-cols-2 gap-2 border-t pt-3 ${dark ? "border-white/10" : "border-slate-200"}`}>
            <Link to="/login" onClick={() => setOpen(false)} className={`inline-flex min-h-11 items-center justify-center rounded-lg border text-sm font-semibold ${dark ? "border-white/15 text-white" : "border-slate-200 text-slate-800"}`}>
              Sign in
            </Link>
            <Link to="/register" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-600 text-sm font-semibold text-white">
              Get started
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
};

export default PublicNavigation;
