import { Bookmark, Briefcase as BriefcaseBusiness, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import OpportunityCard from "../components/opportunities/OpportunityCard";
import TeamShell from "../components/teams/TeamShell";
import api from "../services/api";
import { APPLICATION_STATUS_LABELS, apiError } from "../utils/opportunities";

const sections = [
  ["saved", "Saved"], ["interested", "Interested"], ["applied", "Applied"],
  ["assessment", "Assessment"], ["interview", "Interview"], ["offer", "Offers"],
  ["rejected", "Rejected"], ["withdrawn", "Withdrawn"], ["closed", "Closed history"],
];

const ApplicationsPage = () => {
  const [view, setView] = useState("saved");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = view === "saved"
        ? await api.get("/opportunities/me/saved", { params: { limit: 50 } })
        : await api.get("/applications", { params: { limit: 50, ...(view === "closed" ? {} : { status: view }) } });
      const rows = response.data.data || [];
      setItems(view === "closed" ? rows.filter((row) => !row.opportunity.is_open) : rows);
    } catch (error) {
      toast.error(apiError(error, "Application history could not be loaded"));
    } finally {
      setLoading(false);
    }
  }, [view]);
  useEffect(() => { load(); }, [load]);
  return <TeamShell><main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><header className="border-b border-[#23252a] pb-7"><p className="team-eyebrow">Candidate-owned tracking</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Applications</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#8a8f98]">Your private record of external applications. Organizations cannot access these statuses or notes through TaskNexus.</p></header><nav className="project-tabs" aria-label="Application stages">{sections.map(([value, label]) => <button type="button" key={value} onClick={() => setView(value)} className={`project-tab ${view === value ? "is-active" : ""}`} aria-current={view === value ? "page" : undefined}>{label}</button>)}</nav><section className="mt-7" aria-live="polite" aria-busy={loading}>{loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" /></div> : items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((row) => <div key={row.id}><OpportunityCard opportunity={row.opportunity} /><p className="mt-2 rounded-lg border border-[#23252a] px-3 py-2 text-xs text-[#8a8f98]">{row.application_status ? `Status: ${APPLICATION_STATUS_LABELS[row.application_status]}` : <><Bookmark className="mr-1 inline h-3 w-3" /> Saved</>}{row.notes ? ` · ${row.notes}` : ""}</p></div>)}</div> : <div className="rounded-xl border border-dashed border-[#34343a] bg-[#0f1011] px-5 py-16 text-center"><BriefcaseBusiness className="mx-auto h-7 w-7 text-[#62666d]" /><h2 className="mt-4 font-medium">Nothing in {sections.find(([value]) => value === view)?.[1].toLowerCase()}.</h2><p className="mt-2 text-sm text-[#8a8f98]">Browse Opportunities and keep your next steps in one place.</p></div>}</section></main></TeamShell>;
};
export default ApplicationsPage;
