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
  <div className="public-site min-h-screen bg-[#010102] text-[#f7f8f8]">
    <header className="border-b border-[#23252a] bg-[#010102]">
      <PublicNavigation />
    </header>

    <main>
      <section className="border-b border-[#23252a] bg-[#010102]">
        <div className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 lg:px-8">
          <div className={`grid items-center gap-10 ${heroAside ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
            <div className="max-w-3xl">
              {eyebrow ? <p className="team-eyebrow">{eyebrow}</p> : null}
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.035em] text-[#f7f8f8] sm:text-5xl">{title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#8a8f98] sm:text-lg">{subtitle}</p>
              {heroActions ? <div className="mt-7 flex flex-wrap gap-3">{heroActions}</div> : null}
            </div>
            {heroAside ? <div className="rounded-xl border border-[#34343a] bg-[#0f1011] p-5">{heroAside}</div> : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>
    </main>
    <PublicFooter />
  </div>
);

export default PublicSiteLayout;
