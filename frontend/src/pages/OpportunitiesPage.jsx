import { Briefcase as BriefcaseBusiness, Filter, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import OpportunityCard from "../components/opportunities/OpportunityCard";
import ProjectSkillPicker from "../components/projects/ProjectSkillPicker";
import TeamShell from "../components/teams/TeamShell";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { apiError } from "../utils/opportunities";

const initialFilters = {
  search: "",
  type: "",
  workMode: "",
  skills: [],
  location: "",
  freshersAllowed: false,
  compensationDisclosed: false,
  sortBy: "published_at",
};

const OpportunitiesPage = () => {
  const { isAuthenticated } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: 24,
        search: filters.search || undefined,
        type: filters.type || undefined,
        workMode: filters.workMode || undefined,
        skills: filters.skills.length ? filters.skills.map((skill) => skill.id).join(",") : undefined,
        location: filters.location || undefined,
        freshersAllowed: filters.freshersAllowed || undefined,
        compensationDisclosed: filters.compensationDisclosed || undefined,
        sortBy: filters.sortBy,
      };
      const response = await api.get("/opportunities", { params });
      setItems(response.data.data || []);
    } catch (error) {
      toast.error(apiError(error, "Opportunities could not be loaded"));
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    const timer = window.setTimeout(load, filters.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [filters.search, load]);
  const save = async (item) => {
    if (!isAuthenticated) return toast.error("Sign in to save Opportunities");
    setBusy(item.id);
    try {
      if (item.viewer_state?.saved) await api.delete(`/opportunities/${item.id}/save`);
      else await api.post(`/opportunities/${item.id}/save`);
      toast.success(item.viewer_state?.saved ? "Removed from saved" : "Opportunity saved");
      await load();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setBusy("");
    }
    return undefined;
  };
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return <TeamShell><main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><header className="border-b border-[#23252a] pb-8"><p className="team-eyebrow">Opportunity platform</p><div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Start where you can grow.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#8a8f98] sm:text-base">Explore internships and entry-level roles from a controlled catalog. Eligibility is transparent, deterministic, and never a hidden score.</p></div>{isAuthenticated ? <Link to="/applications" className="team-button-secondary">View applications</Link> : null}</div></header><section className="mt-6 rounded-xl border border-[#23252a] bg-[#0f1011] p-4" aria-label="Opportunity filters"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4 text-[#828fff]" /> Refine results</div><button type="button" onClick={() => setFilters(initialFilters)} className="text-xs text-[#8a8f98] hover:text-white">Clear filters</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><label className="relative lg:col-span-2"><span className="team-label">Search</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#62666d]" /><input className="team-input pl-10" value={filters.search} onChange={(event) => set("search", event.target.value)} placeholder="Role, organization, or skill" maxLength={200} /></span></label><Select label="Type" value={filters.type} set={(value) => set("type", value)}><option value="">Internships and jobs</option><option value="internship">Internships</option><option value="entry_level_job">Entry-level jobs</option></Select><Select label="Work mode" value={filters.workMode} set={(value) => set("workMode", value)}><option value="">Any work mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></Select><Select label="Sort" value={filters.sortBy} set={(value) => set("sortBy", value)}><option value="published_at">Newest</option><option value="application_deadline">Deadline soon</option><option value="last_verified_at">Recently verified</option></Select><div className="sm:col-span-2 lg:col-span-2"><ProjectSkillPicker value={filters.skills} onChange={(skills) => set("skills", skills.slice(0, 8))} /></div><label><span className="team-label">Location</span><input className="team-input" value={filters.location} onChange={(event) => set("location", event.target.value)} placeholder="City, state, or country" maxLength={100} /></label><Check label="Freshers allowed" checked={filters.freshersAllowed} set={(value) => set("freshersAllowed", value)} /><Check label="Compensation disclosed" checked={filters.compensationDisclosed} set={(value) => set("compensationDisclosed", value)} /></div></section><section className="mt-6" aria-live="polite" aria-busy={loading}>{loading ? <div className="flex min-h-72 items-center justify-center rounded-xl border border-[#23252a] bg-[#0f1011]"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" aria-label="Loading Opportunities" /></div> : items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <OpportunityCard key={item.id} opportunity={item} onSave={save} busy={busy === item.id} />)}</div> : <div className="rounded-xl border border-dashed border-[#34343a] bg-[#0f1011] px-5 py-16 text-center"><BriefcaseBusiness className="mx-auto h-7 w-7 text-[#62666d]" /><h2 className="mt-4 font-medium">No open Opportunities match.</h2><p className="mt-2 text-sm text-[#8a8f98]">Try fewer filters or a broader search.</p></div>}</section></main></TeamShell>;
};
const Select = ({ label, value, set, children }) => <label><span className="team-label">{label}</span><select aria-label={label} className="team-input" value={value} onChange={(event) => set(event.target.value)}>{children}</select></label>;
const Check = ({ label, checked, set }) => <label className="flex min-h-11 items-center gap-3 self-end rounded-lg border border-[#34343a] bg-[#141516] px-3 text-sm text-[#d0d6e0]"><input type="checkbox" checked={checked} onChange={(event) => set(event.target.checked)} className="h-4 w-4 accent-[#5e6ad2]" />{label}</label>;
export default OpportunitiesPage;
