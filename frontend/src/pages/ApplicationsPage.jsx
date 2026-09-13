import { Bookmark, Briefcase as BriefcaseBusiness, Building2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import Dialog from "../components/common/Dialog";
import OpportunityCard from "../components/opportunities/OpportunityCard";
import TeamShell from "../components/teams/TeamShell";
import PageHeader from "../components/ui/PageHeader";
import api from "../services/api";
import { APPLICATION_STATUS_LABELS, NATIVE_APPLICATION_STAGE_LABELS, apiError, formatDate } from "../utils/opportunities";

const externalSections = [
  ["saved", "Saved"], ["interested", "Interested"], ["applied", "Applied"],
  ["assessment", "Assessment"], ["interview", "Interview"], ["offer", "Offers"],
  ["rejected", "Rejected"], ["withdrawn", "Withdrawn"], ["closed", "Closed history"],
];
const withdrawableStages = new Set(["submitted", "reviewing", "shortlisted", "assessment", "interview"]);

const ApplicationsPage = () => {
  const [mode, setMode] = useState("native");
  const [view, setView] = useState("saved");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === "native") setItems((await api.get("/native-applications/me", { params: { limit: 50 } })).data.data || []);
      else {
        const response = view === "saved"
          ? await api.get("/opportunities/me/saved", { params: { limit: 50 } })
          : await api.get("/applications", { params: { limit: 50, ...(view === "closed" ? {} : { status: view }) } });
        const rows = response.data.data || [];
        setItems(view === "closed" ? rows.filter((row) => !row.opportunity.is_open) : rows);
      }
    } catch (error) { toast.error(apiError(error, "Applications could not be loaded")); }
    finally { setLoading(false); }
  }, [mode, view]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = "Applications | TaskNexus"; }, []);
  const openApplication = async (id) => {
    try { setDetail((await api.get(`/native-applications/${id}`)).data.data); }
    catch (error) { toast.error(apiError(error, "Application details could not be loaded")); }
  };
  const withdraw = async () => {
    setBusy(true);
    try {
      await api.post(`/native-applications/${detail.id}/withdraw`, { revision: detail.revision });
      toast.success("Application withdrawn");
      setDetail(null);
      await load();
    } catch (error) { toast.error(apiError(error)); }
    finally { setBusy(false); }
  };
  return <TeamShell><main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <PageHeader eyebrow="Candidate workspace" title="Applications" description="TaskNexus-native employer workflows and your private external tracking stay deliberately separate." />
    <nav className="project-tabs" role="tablist" aria-label="Application source"><button type="button" role="tab" aria-selected={mode === "native"} onClick={() => setMode("native")} className={`project-tab ${mode === "native" ? "is-active" : ""}`}>TaskNexus Applications</button><button type="button" role="tab" aria-selected={mode === "external"} onClick={() => setMode("external")} className={`project-tab ${mode === "external" ? "is-active" : ""}`}>External Applications</button></nav>
    {mode === "external" ? <><p className="mt-6 max-w-3xl text-sm leading-6 text-[#8a8f98]">Private candidate-owned records. Organizations cannot access these statuses or notes through TaskNexus.</p><nav className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-2" aria-label="External application stages">{externalSections.map(([value, label]) => <button type="button" key={value} onClick={() => setView(value)} className={`team-chip shrink-0 ${view === value ? "border-[#5e6ad2] text-white" : ""}`} aria-current={view === value ? "page" : undefined}>{label}</button>)}</nav></> : <p className="mt-6 max-w-3xl text-sm leading-6 text-[#8a8f98]">Employer-managed application stages based on the bounded profile snapshot you consented to share at submission.</p>}
    <section className="mt-7" role="tabpanel" aria-live="polite" aria-busy={loading}>{loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" /></div> : mode === "native" ? <NativeApplications items={items} onOpen={openApplication} /> : <ExternalApplications items={items} view={view} />}</section>
    {detail ? <Dialog onClose={() => setDetail(null)} titleId="candidate-application-title" descriptionId="candidate-application-description" panelClassName="max-w-2xl">
      <div className="border-b border-[#23252a] p-5">
        <h2 id="candidate-application-title" className="text-lg font-semibold">{detail.opportunity?.title || "TaskNexus application"}</h2>
        <p id="candidate-application-description" className="mt-2 text-sm text-[#8a8f98]">Employer-managed status and the activity preserved for this application.</p>
      </div>
      <div className="space-y-6 p-5">
        <div className="flex flex-wrap gap-2"><span className="team-chip">{NATIVE_APPLICATION_STAGE_LABELS[detail.stage]}</span><span className="team-chip">Submitted {formatDate(detail.submitted_at)}</span></div>
        <section><h3 className="text-sm font-medium">Shared snapshot</h3><p className="mt-2 text-sm text-[#8a8f98]">{detail.shared_snapshot?.display_name || "TaskNexus candidate"}{detail.shared_snapshot?.headline ? ` · ${detail.shared_snapshot.headline}` : ""}</p>{detail.shared_snapshot?.projects?.length ? <div className="mt-3 flex flex-wrap gap-2">{detail.shared_snapshot.projects.map((project) => <span key={project.id} className="team-chip">{project.name}</span>)}</div> : <p className="mt-2 text-xs text-[#62666d]">No Projects were shared.</p>}{detail.shared_snapshot?.evidence?.length ? <div className="mt-3 space-y-2">{detail.shared_snapshot.evidence.map((item) => <div key={item.id} className="rounded-lg border border-[#23252a] bg-[#141516] p-3"><p className="text-sm text-[#d0d6e0]">{item.title}</p><p className="mt-1 text-xs text-[#62666d]">{item.evidence_type.replaceAll("_", " ")} · {item.verification_level.replaceAll("_", " ")}</p></div>)}</div> : null}</section>
        <section><h3 className="text-sm font-medium">Application timeline</h3><ol className="mt-3 space-y-3">{detail.activity?.map((item) => <li key={item.id} className="rounded-lg border border-[#23252a] bg-[#141516] p-3 text-sm"><span className="text-[#d0d6e0]">{NATIVE_APPLICATION_STAGE_LABELS[item.to_stage] || item.type}</span><span className="ml-2 text-xs text-[#62666d]">{formatDate(item.created_at)}</span></li>)}</ol></section>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#23252a] p-5"><button type="button" onClick={() => setDetail(null)} className="team-button-secondary">Close</button>{withdrawableStages.has(detail.stage) ? <button type="button" disabled={busy} onClick={withdraw} className="team-button-primary">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Withdraw application</button> : null}</div>
    </Dialog> : null}
  </main></TeamShell>;
};

const NativeApplications = ({ items, onOpen }) => items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((row) => <article key={row.id} className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5"><div className="flex items-start justify-between gap-3"><span className="team-chip">{NATIVE_APPLICATION_STAGE_LABELS[row.stage]}</span><span className="text-xs text-[#62666d]">{formatDate(row.submitted_at)}</span></div><h2 className="mt-5 text-lg font-medium">{row.opportunity?.title || "Opportunity unavailable"}</h2>{row.organization ? <Link to={`/organizations/${row.organization.slug}`} className="mt-2 inline-flex items-center gap-2 text-sm text-[#8a8f98] hover:text-white"><Building2 className="h-4 w-4" />{row.organization.name}</Link> : null}<p className="mt-5 text-xs leading-5 text-[#62666d]">This status is controlled by the Organization. Your external application notes and saved Opportunities remain private.</p><div className="mt-5 flex flex-col gap-2"><button type="button" onClick={() => onOpen(row.id)} className="team-button-primary w-full">View application</button>{row.opportunity?.slug ? <Link to={`/opportunities/${row.opportunity.slug}`} className="team-button-secondary w-full">View Opportunity</Link> : null}</div></article>)}</div> : <Empty icon={BriefcaseBusiness} title="No TaskNexus applications yet" description="Native applications you submit to Organization-owned Opportunities will appear here." />;

const ExternalApplications = ({ items, view }) => items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((row) => <div key={row.id}><OpportunityCard opportunity={row.opportunity} /><p className="mt-2 rounded-lg border border-[#23252a] px-3 py-2 text-xs text-[#8a8f98]">{row.application_status ? `Private status: ${APPLICATION_STATUS_LABELS[row.application_status]}` : <><Bookmark className="mr-1 inline h-3 w-3" /> Saved</>}{row.notes ? ` · ${row.notes}` : ""}</p></div>)}</div> : <Empty icon={BriefcaseBusiness} title={`Nothing in ${externalSections.find(([value]) => value === view)?.[1].toLowerCase()}.`} description="Browse Opportunities and keep your external next steps in one private place." />;

const Empty = ({ icon: Icon, title, description }) => <div className="rounded-xl border border-dashed border-[#34343a] bg-[#0f1011] px-5 py-16 text-center"><Icon className="mx-auto h-7 w-7 text-[#62666d]" /><h2 className="mt-4 font-medium">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8a8f98]">{description}</p></div>;

export default ApplicationsPage;
