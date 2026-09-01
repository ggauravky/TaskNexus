import PublicFooter from "./PublicFooter";
import PublicNavigation from "./PublicNavigation";

const PublicSiteLayout = ({
  eyebrow,
  title,
  subtitle,
  children,
  heroAside = null,
  heroActions = null,
}) => (
  <div className="min-h-screen bg-slate-50 text-slate-950">
    <header className="border-b border-slate-200 bg-white">
      <PublicNavigation />
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 lg:px-8">
        <div className={`grid items-center gap-10 ${heroAside ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
          <div className="max-w-3xl">
            {eyebrow ? <p className="text-sm font-medium text-primary-700">{eyebrow}</p> : null}
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">{subtitle}</p>
            {heroActions ? <div className="mt-7 flex flex-wrap gap-3">{heroActions}</div> : null}
          </div>
          {heroAside ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">{heroAside}</div> : null}
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">{children}</main>
    <PublicFooter />
  </div>
);

export default PublicSiteLayout;
