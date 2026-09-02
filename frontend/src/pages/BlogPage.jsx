import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Mail, Send, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import PublicSiteLayout from "../components/marketing/PublicSiteLayout";

const articles = [
  {
    title: "How clear ownership reduces coordination drag",
    category: "Operations",
    summary:
      "Why work moves more predictably when the brief, owner, review step, and next action are visible in one place.",
    body:
      "Start by naming one accountable owner and one review point for each task. Keep decisions beside the work instead of splitting them across private messages. A small amount of visible structure usually prevents more delay than another status meeting.",
  },
  {
    title: "The hidden cost of unclear handoffs",
    category: "Execution",
    summary:
      "A practical look at how vague briefs, missing review gates, and weak status ownership slow down delivery more than most teams realize.",
    body:
      "A useful handoff states the outcome, constraints, due date, source material, and definition of done. If any of those are missing, the receiver must guess or pause for clarification. A short checklist makes that uncertainty visible before work begins.",
  },
  {
    title: "What a calm task workflow looks like",
    category: "Systems",
    summary:
      "A starter model for teams that want less status-chasing, clearer priorities, and cleaner movement from request to finished output.",
    body:
      "Use a small set of meaningful states, make due work easy to find, and reserve notifications for changes that require attention. The goal is not more dashboards; it is a reliable answer to what is happening, who owns it, and what comes next.",
  },
];

const BlogPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSuccessMessage("");

    try {
      const response = await api.post("/public/newsletter/subscribe", {
        email: email.trim().toLowerCase(),
      });
      const message = response.data?.message || "Subscribed successfully.";
      setSuccessMessage(message);
      setEmail("");
      toast.success("Thanks. Check your inbox for the welcome note.");
    } catch (error) {
      const message =
        error.response?.data?.error?.message || "Unable to subscribe right now.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicSiteLayout
      eyebrow="TaskNexus Journal"
      title="Ideas for calmer delivery and sharper ops."
      subtitle="Short reads on managed execution, handoff quality, workflow design, and the systems that make teams easier to run."
      heroAside={
        <div className="space-y-5 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
            <Mail className="h-4 w-4" />
            Newsletter
          </div>
          <h2 className="text-2xl font-semibold">Useful updates only</h2>
          <p className="text-sm leading-7 text-slate-200">
            Subscribe for practical ops notes, service updates, and small ideas that help delivery feel less noisy.
          </p>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <label htmlFor="newsletter-email" className="sr-only">Email address</label>
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-300 focus:border-cyan-300 focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" />
              <span>{loading ? "Subscribing..." : "Subscribe to updates"}</span>
            </button>
          </form>
          {successMessage ? (
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {successMessage}
            </div>
          ) : null}
        </div>
      }
      heroActions={
        <>
          <Link to="/services" className="btn btn-primary inline-flex items-center gap-2">
            Explore services <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/support-jar" className="btn btn-secondary">
            Open support jar
          </Link>
        </>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-5">
          {articles.map((article) => (
            <article key={article.title} className="public-surface space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>{article.category}</span>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{article.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{article.summary}</p>
              </div>
              <details className="group rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
                  Read note
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-600">{article.body}</p>
              </details>
            </article>
          ))}
        </div>

        <aside className="space-y-5">
          <div className="public-surface">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
              <Sparkles className="h-4 w-4" />
              Why subscribe
            </div>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <li className="flex gap-3">
                <BookOpen className="mt-1 h-4 w-4 text-sky-600" />
                <span>Operational ideas grounded in real delivery problems, not abstract productivity fluff.</span>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-1 h-4 w-4 text-sky-600" />
                <span>Product and service updates when something materially changes.</span>
              </li>
              <li className="flex gap-3">
                <Sparkles className="mt-1 h-4 w-4 text-sky-600" />
                <span>A short thank-you email lands immediately after you subscribe.</span>
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </PublicSiteLayout>
  );
};

export default BlogPage;
