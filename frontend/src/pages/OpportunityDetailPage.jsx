import { AlertCircle as CircleAlert, ArrowUpRight, Bookmark, Building2, CalendarClock, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import TeamShell from "../components/teams/TeamShell";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { APPLICATION_STATUS_LABELS, ELIGIBILITY_LABELS, OPPORTUNITY_TYPE_LABELS, WORK_MODE_LABELS, apiError, compensationLabel, formatDate, locationLabel } from "../utils/opportunities";

const OpportunityDetailPage = () => {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const [item, setItem] = useState(null);
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await api.get(`/opportunities/${slug}`);
      const next = response.data.data;
      setItem(next);
      setNotes(next.viewer_state?.notes || "");
      setState("ready");
      setDynamicMeta(next);
    } catch (_error) {
      setState("missing");
    }
  }, [slug]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    if (!isAuthenticated) return toast.error("Sign in to save Opportunities");
    setBusy(true);
    try {
      if (item.viewer_state?.saved) await api.delete(`/opportunities/${item.id}/save`);
      else await api.post(`/opportunities/${item.id}/save`);
      toast.success(item.viewer_state?.saved ? "Removed from saved" : "Opportunity saved");
      await load();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  const track = async (status) => {
    if (!isAuthenticated) return toast.error("Sign in to track applications");
    setBusy(true);
    try {
      const payload = { status, notes, ...(item.viewer_state ? { revision: item.viewer_state.revision } : {}) };
      await api.put(`/opportunities/${item.id}/application`, payload);
      toast.success(`Application marked ${APPLICATION_STATUS_LABELS[status]}`);
      await load();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  if (state === "loading") return <TeamShell><div className="flex min-h-[70dvh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" /></div></TeamShell>;
  if (!item) return <TeamShell><main className="mx-auto max-w-3xl px-4 py-24 text-center"><CircleAlert className="mx-auto h-8 w-8 text-[#62666d]" /><h1 className="mt-4 text-2xl font-semibold">Opportunity not found</h1><Link to="/opportunities" className="team-button-primary mt-6">Browse open Opportunities</Link></main></TeamShell>;
  return <TeamShell><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <Link to="/opportunities" className="text-sm text-[#828fff] hover:text-[#b7bdf8]">← All Opportunities</Link>
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <article>
        <header className="border-b border-[#23252a] pb-8">
          <div className="flex flex-wrap items-center gap-2"><span className="team-chip">{OPPORTUNITY_TYPE_LABELS[item.type]}</span><span className="team-chip">{WORK_MODE_LABELS[item.work_mode]}</span>{!item.is_open ? <span className="team-chip border-amber-900 text-amber-200">Closed</span> : null}</div>
          <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{item.title}</h1>
          <Link to={`/organizations/${item.organization.slug}`} className="mt-4 inline-flex items-center gap-2 text-[#b7bdf8] hover:text-white"><Building2 className="h-4 w-4" /> {item.organization.name}</Link>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#8a8f98]">{item.summary}</p>
        </header>
        <Section title="About the role"><Text value={item.description} /></Section>
        <Section title="Responsibilities"><List values={item.responsibilities} /></Section>
        <Section title="Requirements"><List values={item.requirements} /></Section>
        <Section title="Skills"><div className="flex flex-wrap gap-2">{item.required_skills.map((skill) => <span className="team-chip" key={skill.id}>Required · {skill.name}</span>)}{item.preferred_skills.map((skill) => <span className="team-chip" key={skill.id}>Preferred · {skill.name}</span>)}</div></Section>
        <Section title="Source and provenance">
          <p className="text-sm leading-6 text-[#a8adb6]">{sourceLabel(item.source?.type)} TaskNexus displays this external role and does not represent itself as the employer.</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><SourceFact label="Published at source" value={formatDate(item.source?.published_at)} /><SourceFact label="Last verified" value={formatDate(item.source?.last_verified_at)} /></dl>
          {item.source?.url ? <a href={item.source.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-[#828fff] hover:text-[#b7bdf8]">View original source <ArrowUpRight className="h-4 w-4" /></a> : null}
        </Section>
      </article>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5">
          <dl className="space-y-4 text-sm"><Fact icon={MapPin} label="Location" value={item.work_mode === "remote" ? "Remote" : item.locations.map(locationLabel).join(" · ")} /><Fact icon={CalendarClock} label="Deadline" value={formatDate(item.application_deadline)} /><Fact icon={CheckCircle2} label="Compensation" value={compensationLabel(item.compensation)} /></dl>
          <a href={item.application_url} target="_blank" rel="noopener noreferrer" className="team-button-primary mt-5 w-full">Apply on organization site <ArrowUpRight className="h-4 w-4" /></a>
          <button disabled={busy} type="button" onClick={save} className="team-button-secondary mt-2 w-full"><Bookmark className={`h-4 w-4 ${item.viewer_state?.saved ? "fill-current" : ""}`} />{item.viewer_state?.saved ? "Saved" : "Save Opportunity"}</button>
          <p className="mt-4 text-xs leading-5 text-[#62666d]">TaskNexus does not receive or submit this application. Verify details on the organization’s site.</p>
        </section>
        {item.eligibility ? <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5" aria-labelledby="eligibility-heading"><p className="team-eyebrow">Your profile context</p><h2 id="eligibility-heading" className="mt-2 text-lg font-semibold">{ELIGIBILITY_LABELS[item.eligibility.result]}</h2><div className="mt-4 space-y-3">{item.eligibility.checks.map((check) => <div key={check.key} className="border-l border-[#34343a] pl-3"><p className="text-xs font-medium capitalize text-[#d0d6e0]">{check.key.split(":")[0].replaceAll("_", " ")} · {check.result}</p><p className="mt-1 text-xs leading-5 text-[#8a8f98]">{check.reason}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-[#62666d]">{item.eligibility.disclaimer}</p></section> : <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5 text-sm text-[#8a8f98]">Sign in to compare published requirements with your structured profile.</section>}
        {isAuthenticated ? <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5"><h2 className="font-medium">Track your application</h2><p className="mt-2 text-xs leading-5 text-[#8a8f98]">Private notes and status are owned by you. They are not sent to the organization.</p><label className="mt-4 block"><span className="team-label">Status</span><select disabled={busy} className="team-input" value={item.viewer_state?.application_status || "interested"} onChange={(event) => track(event.target.value)}>{Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-4 block"><span className="team-label">Private notes</span><textarea className="team-input min-h-24 resize-y" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button disabled={busy} onClick={() => track(item.viewer_state?.application_status || "interested")} className="team-button-secondary mt-3 w-full">Save tracking details</button></section> : null}
      </aside>
    </div>
  </main></TeamShell>;
};
const Section = ({ title, children }) => <section className="border-b border-[#23252a] py-8"><h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2><div className="mt-4">{children}</div></section>;
const Text = ({ value }) => <p className="whitespace-pre-line text-sm leading-7 text-[#a8adb6]">{value || "No additional description was published."}</p>;
const List = ({ values = [] }) => values.length ? <ul className="space-y-3 text-sm leading-6 text-[#a8adb6]">{values.map((value) => <li key={value} className="flex gap-3"><span aria-hidden="true" className="text-[#828fff]">•</span><span>{value}</span></li>)}</ul> : <p className="text-sm text-[#62666d]">No structured items were published.</p>;
const Fact = ({ icon: Icon, label, value }) => <div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#828fff]" /><div><dt className="text-xs text-[#62666d]">{label}</dt><dd className="mt-1 text-[#d0d6e0]">{value}</dd></div></div>;
const SourceFact = ({ label, value }) => <div><dt className="text-xs text-[#62666d]">{label}</dt><dd className="mt-1 text-[#d0d6e0]">{value}</dd></div>;
const sourceLabel = (type) => ({ official: "Official organization listing.", admin_curated: "Admin-curated catalog listing.", external: "External listing." }[type] || "Catalog source not specified.");
const setDynamicMeta = (item) => { document.title = `${item.title} at ${item.organization.name} | TaskNexus`; const description = document.querySelector('meta[name="description"]'); if (description) description.setAttribute("content", item.summary || `View ${item.title} at ${item.organization.name}.`); for (const [property, content] of [["og:title", document.title], ["og:description", description?.content || ""]]) { const tag = document.querySelector(`meta[property="${property}"]`); if (tag) tag.setAttribute("content", content); } };
export default OpportunityDetailPage;
