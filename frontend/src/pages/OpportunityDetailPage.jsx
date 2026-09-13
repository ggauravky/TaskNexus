import { AlertCircle as CircleAlert, ArrowUpRight, Bookmark, Building2, CalendarClock, CheckCircle2, FileCheck2, Loader2, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import TeamShell from "../components/teams/TeamShell";
import Dialog from "../components/common/Dialog";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { APPLICATION_STATUS_LABELS, ELIGIBILITY_LABELS, NATIVE_APPLICATION_STAGE_LABELS, OPPORTUNITY_TYPE_LABELS, WORK_MODE_LABELS, apiError, compensationLabel, formatDate, locationLabel } from "../utils/opportunities";

const OpportunityDetailPage = () => {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const [item, setItem] = useState(null);
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [eligibleProjects, setEligibleProjects] = useState([]);
  const [applicationForm, setApplicationForm] = useState({ coverNote: "", selectedProjectIds: [], consent: false });
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
  const openNativeApplication = async () => {
    if (!isAuthenticated) return toast.error("Sign in to apply with TaskNexus");
    setBusy(true);
    try {
      const response = await api.get("/native-applications/eligible-projects");
      setEligibleProjects(response.data.data || []);
      setApplyOpen(true);
    } catch (error) { toast.error(apiError(error)); }
    finally { setBusy(false); }
    return undefined;
  };
  const submitNativeApplication = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await api.post(`/opportunities/${item.id}/applications`, applicationForm);
      toast.success("TaskNexus application submitted"); setApplyOpen(false); await load();
    } catch (error) { toast.error(apiError(error)); }
    finally { setBusy(false); }
  };
  const withdrawNativeApplication = async () => {
    setBusy(true);
    try {
      await api.post(`/native-applications/${item.viewer_native_application.id}/withdraw`, { revision: item.viewer_native_application.revision });
      toast.success("Application withdrawn"); await load();
    } catch (error) { toast.error(apiError(error)); }
    finally { setBusy(false); }
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
          <p className="text-sm leading-6 text-[#a8adb6]">{sourceLabel(item.source?.type)} {item.source?.type === "organization_owned" ? "This listing is managed by authorized Organization members." : "TaskNexus displays this external role and does not represent itself as the employer."}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><SourceFact label="Published at source" value={formatDate(item.source?.published_at)} /><SourceFact label="Last verified" value={formatDate(item.source?.last_verified_at)} /></dl>
          {item.source?.url ? <a href={item.source.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-[#828fff] hover:text-[#b7bdf8]">View original source <ArrowUpRight className="h-4 w-4" /></a> : null}
        </Section>
      </article>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5">
          <dl className="space-y-4 text-sm"><Fact icon={MapPin} label="Location" value={item.work_mode === "remote" ? "Remote" : item.locations.map(locationLabel).join(" · ")} /><Fact icon={CalendarClock} label="Deadline" value={formatDate(item.application_deadline)} /><Fact icon={CheckCircle2} label="Compensation" value={compensationLabel(item.compensation)} /></dl>
          {item.application_mode === "external" ? <a href={item.application_url} target="_blank" rel="noopener noreferrer" className="team-button-primary mt-5 w-full">Apply on organization site <ArrowUpRight className="h-4 w-4" /></a> : item.viewer_native_application ? <div className="mt-5 rounded-lg border border-[#34343a] bg-[#141516] p-4"><p className="text-xs text-[#62666d]">TaskNexus application</p><p className="mt-1 font-medium">{NATIVE_APPLICATION_STAGE_LABELS[item.viewer_native_application.stage]}</p><p className="mt-2 text-xs text-[#8a8f98]">Submitted {formatDate(item.viewer_native_application.submitted_at)}</p>{!["rejected", "withdrawn"].includes(item.viewer_native_application.stage) ? <button disabled={busy} onClick={withdrawNativeApplication} className="team-button-secondary mt-4 w-full">Withdraw application</button> : null}</div> : <button disabled={busy || !item.is_open} onClick={openNativeApplication} className="team-button-primary mt-5 w-full"><FileCheck2 className="h-4 w-4" /> Apply with TaskNexus</button>}
          <button disabled={busy} type="button" onClick={save} className="team-button-secondary mt-2 w-full"><Bookmark className={`h-4 w-4 ${item.viewer_state?.saved ? "fill-current" : ""}`} />{item.viewer_state?.saved ? "Saved" : "Save Opportunity"}</button>
          <p className="mt-4 text-xs leading-5 text-[#62666d]">{item.application_mode === "external" ? "TaskNexus does not receive or submit this application. Verify details on the organization’s site." : "Your application shares only the reviewed snapshot shown before submission. Email, phone, private Projects, and private tracking are excluded."}</p>
        </section>
        {item.eligibility ? <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5" aria-labelledby="eligibility-heading"><p className="team-eyebrow">Your profile context</p><h2 id="eligibility-heading" className="mt-2 text-lg font-semibold">{ELIGIBILITY_LABELS[item.eligibility.result]}</h2><div className="mt-4 space-y-3">{item.eligibility.checks.map((check) => <div key={check.key} className="border-l border-[#34343a] pl-3"><p className="text-xs font-medium capitalize text-[#d0d6e0]">{check.key.split(":")[0].replaceAll("_", " ")} · {check.result}</p><p className="mt-1 text-xs leading-5 text-[#8a8f98]">{check.reason}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-[#62666d]">{item.eligibility.disclaimer}</p></section> : <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5 text-sm text-[#8a8f98]">Sign in to compare published requirements with your structured profile.</section>}
        {isAuthenticated && item.application_mode === "external" ? <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5"><h2 className="font-medium">Track your application</h2><p className="mt-2 text-xs leading-5 text-[#8a8f98]">Private notes and status are owned by you. They are not sent to the organization.</p><label className="mt-4 block"><span className="team-label">Status</span><select disabled={busy} className="team-input" value={item.viewer_state?.application_status || "interested"} onChange={(event) => track(event.target.value)}>{Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-4 block"><span className="team-label">Private notes</span><textarea className="team-input min-h-24 resize-y" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button disabled={busy} onClick={() => track(item.viewer_state?.application_status || "interested")} className="team-button-secondary mt-3 w-full">Save tracking details</button></section> : null}
      </aside>
    </div>
    {applyOpen ? <Dialog onClose={() => setApplyOpen(false)} titleId="native-application-title" descriptionId="native-application-description" panelClassName="max-w-2xl"><form onSubmit={submitNativeApplication}><div className="flex items-start justify-between gap-4 border-b border-[#23252a] p-5"><div><h2 id="native-application-title" className="text-lg font-semibold">Apply with TaskNexus</h2><p id="native-application-description" className="mt-2 text-sm leading-6 text-[#8a8f98]">Review exactly what will be shared with {item.organization.name}.</p></div><button type="button" aria-label="Close application" onClick={() => setApplyOpen(false)} className="team-icon-button"><X className="h-4 w-4" /></button></div><div className="space-y-6 p-5"><section className="rounded-lg border border-[#34343a] bg-[#141516] p-4"><h3 className="text-sm font-medium">Shared at submission</h3><ul className="mt-3 space-y-2 text-xs leading-5 text-[#8a8f98]"><li>Display name, username, headline, and avatar</li><li>Education summary and skills</li><li>Only the public evidence-backed Projects you select below</li><li>Your optional cover note</li></ul><p className="mt-3 text-xs font-medium text-[#d0d6e0]">Never shared: email, phone, private Projects, Teams, saved Opportunities, private notes, blocks, sessions, or security data.</p></section><label className="block"><span className="team-label">Cover note <span className="text-[#62666d]">optional</span></span><textarea maxLength={2000} className="team-input mt-2 min-h-32" value={applicationForm.coverNote} onChange={(event) => setApplicationForm({ ...applicationForm, coverNote: event.target.value })} /><span className="mt-1 block text-right text-xs text-[#62666d]">{applicationForm.coverNote.length}/2000</span></label><fieldset><legend className="team-label">Evidence-backed Projects <span className="text-[#62666d]">optional, up to 5</span></legend>{eligibleProjects.length ? <div className="mt-3 space-y-2">{eligibleProjects.map((project) => { const checked = applicationForm.selectedProjectIds.includes(project.id); return <label key={project.id} className="flex cursor-pointer gap-3 rounded-lg border border-[#23252a] p-3"><input type="checkbox" checked={checked} disabled={!checked && applicationForm.selectedProjectIds.length >= 5} onChange={(event) => setApplicationForm({ ...applicationForm, selectedProjectIds: event.target.checked ? [...applicationForm.selectedProjectIds, project.id] : applicationForm.selectedProjectIds.filter((id) => id !== project.id) })} /><span><span className="block text-sm font-medium">{project.name}</span><span className="mt-1 block text-xs text-[#8a8f98]">{project.participant_role} · {project.evidence_count} public-safe evidence item{project.evidence_count === 1 ? "" : "s"}</span></span></label>; })}</div> : <p className="mt-3 text-sm text-[#62666d]">No eligible completed public Projects. You can still apply without selecting one.</p>}</fieldset><label className="flex gap-3 rounded-lg border border-[#34343a] p-4"><input required type="checkbox" checked={applicationForm.consent} onChange={(event) => setApplicationForm({ ...applicationForm, consent: event.target.checked })} /><span className="text-sm leading-6 text-[#a8adb6]">I consent to share the bounded application snapshot listed above with this Organization and understand it is preserved as submitted.</span></label></div><div className="flex justify-end gap-2 border-t border-[#23252a] p-5"><button type="button" onClick={() => setApplyOpen(false)} className="team-button-secondary">Cancel</button><button disabled={busy || !applicationForm.consent} className="team-button-primary">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Submit application</button></div></form></Dialog> : null}
  </main></TeamShell>;
};
const Section = ({ title, children }) => <section className="border-b border-[#23252a] py-8"><h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2><div className="mt-4">{children}</div></section>;
const Text = ({ value }) => <p className="whitespace-pre-line text-sm leading-7 text-[#a8adb6]">{value || "No additional description was published."}</p>;
const List = ({ values = [] }) => values.length ? <ul className="space-y-3 text-sm leading-6 text-[#a8adb6]">{values.map((value) => <li key={value} className="flex gap-3"><span aria-hidden="true" className="text-[#828fff]">•</span><span>{value}</span></li>)}</ul> : <p className="text-sm text-[#62666d]">No structured items were published.</p>;
const Fact = ({ icon: Icon, label, value }) => <div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#828fff]" /><div><dt className="text-xs text-[#62666d]">{label}</dt><dd className="mt-1 text-[#d0d6e0]">{value}</dd></div></div>;
const SourceFact = ({ label, value }) => <div><dt className="text-xs text-[#62666d]">{label}</dt><dd className="mt-1 text-[#d0d6e0]">{value}</dd></div>;
const sourceLabel = (type) => ({ official: "Official organization listing.", admin_curated: "Admin-curated catalog listing.", external: "External listing.", organization_owned: "Organization-owned listing." }[type] || "Catalog source not specified.");
const setDynamicMeta = (item) => { document.title = `${item.title} at ${item.organization.name} | TaskNexus`; const description = document.querySelector('meta[name="description"]'); if (description) description.setAttribute("content", item.summary || `View ${item.title} at ${item.organization.name}.`); for (const [property, content] of [["og:title", document.title], ["og:description", description?.content || ""]]) { const tag = document.querySelector(`meta[property="${property}"]`); if (tag) tag.setAttribute("content", content); } };
export default OpportunityDetailPage;
