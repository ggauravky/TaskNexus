import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase as BriefcaseBusiness, Check, ChevronLeft, ChevronRight, ExternalLink, Filter, FolderKanban, Loader2, MapPin, Search, Send, UsersRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import CollaborationRequestDialog from "../components/discovery/CollaborationRequestDialog";
import ProjectSkillPicker from "../components/projects/ProjectSkillPicker";
import TeamShell from "../components/teams/TeamShell";
import api from "../services/api";
import { AVAILABILITY_LABELS, COMMITMENT_LABELS, INTEREST_LABELS, ROLE_LABELS, apiError, labelFor } from "../utils/discovery";

const defaultFilters = { search: "", skills: [], skillMode: "all", role: "", interest: "", availability: ["open", "limited"], hasPublishedProjects: false, hasExternalEvidence: false };

const PeoplePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "openings" ? "openings" : "people";
  const [filters, setFilters] = useState(defaultFilters);
  const [openingFilters, setOpeningFilters] = useState({ role: "", interest: "", skills: [] });
  const [people, setPeople] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);

  const params = useMemo(() => view === "people" ? {
    page, limit: 18, search: filters.search || undefined, skills: filters.skills.map((skill) => skill.id).join(",") || undefined,
    skillMode: filters.skillMode, roles: filters.role || undefined, interests: filters.interest || undefined,
    availability: filters.availability.join(","), hasPublishedProjects: filters.hasPublishedProjects || undefined,
    hasExternalEvidence: filters.hasExternalEvidence || undefined,
  } : {
    page, limit: 18, role: openingFilters.role || undefined, interest: openingFilters.interest || undefined,
    skill: openingFilters.skills[0]?.id || undefined,
  }, [filters, openingFilters, page, view]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(view === "people" ? "/people" : "/team-openings", { params });
      if (view === "people") setPeople(response.data.data || []); else setOpenings(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 0, total: 0 });
    } catch (error) { toast.error(apiError(error, "Discovery could not be loaded")); }
    finally { setLoading(false); }
  }, [params, view]);
  useEffect(() => { const timer = window.setTimeout(load, filters.search ? 220 : 0); return () => window.clearTimeout(timer); }, [filters.search, load]);
  useEffect(() => { setPage(1); }, [filters, openingFilters, view]);

  const chooseView = (next) => { setSearchParams(next === "openings" ? { view: "openings" } : {}); setPage(1); };
  const filterPanel = view === "people"
    ? <PeopleFilters value={filters} onChange={setFilters} />
    : <OpeningFilters value={openingFilters} onChange={setOpeningFilters} />;

  return <TeamShell><main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <header className="border-b border-[#23252a] pb-8"><p className="team-eyebrow">Deterministic discovery</p><div className="mt-2 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Find people to build with.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#8a8f98] sm:text-base">Search explicit skills, roles, interests, and availability. Results explain the facts they matched—never an opaque talent score.</p></div><Link to="/collaboration" className="team-button-secondary"><Send className="h-4 w-4" /> Request inbox</Link></div></header>
    <nav className="project-tabs mt-4" aria-label="Discovery sections"><button onClick={() => chooseView("people")} aria-current={view === "people" ? "page" : undefined} className={`project-tab ${view === "people" ? "is-active" : ""}`}><UsersRound className="mr-1.5 inline h-4 w-4" /> People</button><button onClick={() => chooseView("openings")} aria-current={view === "openings" ? "page" : undefined} className={`project-tab ${view === "openings" ? "is-active" : ""}`}><BriefcaseBusiness className="mr-1.5 inline h-4 w-4" /> Open Team roles</button></nav>
    <details className="mt-6 rounded-xl border border-[#23252a] bg-[#0f1011] lg:hidden"><summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium"><Filter className="h-4 w-4" /> Filters</summary><div className="border-t border-[#23252a] p-4">{filterPanel}</div></details>
    <div className="mt-6 grid gap-7 lg:grid-cols-[260px_minmax(0,1fr)]"><aside className="hidden lg:block"><div className="sticky top-24 rounded-xl border border-[#23252a] bg-[#0f1011] p-5"><h2 className="text-sm font-medium">Filters</h2><div className="mt-5">{filterPanel}</div></div></aside><section aria-live="polite" aria-busy={loading}>
      <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-[#8a8f98]">{loading ? "Searching…" : `${meta.total || 0} ${view === "people" ? "discoverable people" : "open roles"}`}</p>{view === "people" && filters.skills.length ? <p className="text-xs text-[#62666d]">Skills match {filters.skillMode.toUpperCase()}</p> : null}</div>
      {loading ? <div className="flex min-h-64 items-center justify-center rounded-xl border border-[#23252a] bg-[#0f1011]"><Loader2 className="h-6 w-6 animate-spin text-[#828fff]" aria-label="Loading discovery results" /></div> : view === "people" ? <PeopleResults items={people} onCollaborate={(person) => setDialog({ person })} /> : <OpeningResults items={openings} onInterest={(opening) => setDialog({ opening })} />}
      {!loading && meta.totalPages > 1 ? <nav className="mt-6 flex items-center justify-between" aria-label="Discovery pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="team-button-secondary"><ChevronLeft className="h-4 w-4" /> Previous</button><span className="text-xs text-[#62666d]">Page {page} of {meta.totalPages}</span><button disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)} className="team-button-secondary">Next <ChevronRight className="h-4 w-4" /></button></nav> : null}
    </section></div>
  </main>{dialog ? <CollaborationRequestDialog {...dialog} onClose={() => setDialog(null)} onSent={load} /> : null}</TeamShell>;
};

const PeopleFilters = ({ value, onChange }) => {
  const set = (key, next) => onChange({ ...value, [key]: next });
  const toggleAvailability = (availability) => set("availability", value.availability.includes(availability) ? value.availability.filter((item) => item !== availability) : [...value.availability, availability]);
  return <div className="space-y-5"><label><span className="team-label">Search</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#62666d]" /><input className="team-input pl-10" value={value.search} onChange={(event) => set("search", event.target.value)} maxLength={80} placeholder="Name, headline, skill…" /></span></label><ProjectSkillPicker value={value.skills} onChange={(skills) => set("skills", skills.slice(0, 8))} /><fieldset><legend className="team-label">Selected skills match</legend><div className="grid grid-cols-2 gap-2">{[["all", "All"], ["any", "Any"]].map(([mode, label]) => <button key={mode} type="button" aria-pressed={value.skillMode === mode} onClick={() => set("skillMode", mode)} className={`team-choice justify-center ${value.skillMode === mode ? "is-active" : ""}`}>{label}</button>)}</div></fieldset><FilterSelect label="Preferred role" value={value.role} onChange={(next) => set("role", next)} options={ROLE_LABELS} empty="Any role" /><FilterSelect label="Interest" value={value.interest} onChange={(next) => set("interest", next)} options={INTEREST_LABELS} empty="Any interest" /><fieldset><legend className="team-label">Availability</legend><div className="space-y-2">{["open", "limited"].map((item) => <label key={item} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-[#34343a] px-3 text-sm text-[#d0d6e0]"><input type="checkbox" checked={value.availability.includes(item)} onChange={() => toggleAvailability(item)} className="accent-[#5e6ad2]" /> {AVAILABILITY_LABELS[item]}</label>)}</div></fieldset><CheckFilter checked={value.hasPublishedProjects} onChange={(next) => set("hasPublishedProjects", next)} label="Has published projects" /><CheckFilter checked={value.hasExternalEvidence} onChange={(next) => set("hasExternalEvidence", next)} label="Has verified external evidence" /><button type="button" onClick={() => onChange(defaultFilters)} className="w-full text-left text-xs text-[#8a8f98] hover:text-white">Clear filters</button></div>;
};

const OpeningFilters = ({ value, onChange }) => {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return <div className="space-y-5"><FilterSelect label="Role" value={value.role} onChange={(next) => set("role", next)} options={ROLE_LABELS} empty="Any role" /><ProjectSkillPicker value={value.skills} onChange={(skills) => set("skills", skills.slice(-1))} /><p className="-mt-3 text-xs leading-5 text-[#62666d]">Choose one required or preferred skill.</p><FilterSelect label="Team interest" value={value.interest} onChange={(next) => set("interest", next)} options={INTEREST_LABELS} empty="Any interest" /><button type="button" onClick={() => onChange({ role: "", interest: "", skills: [] })} className="w-full text-left text-xs text-[#8a8f98] hover:text-white">Clear filters</button></div>;
};

const FilterSelect = ({ label, value, onChange, options, empty }) => <label><span className="team-label">{label}</span><select className="team-input" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{empty}</option>{Object.entries(options).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>;
const CheckFilter = ({ checked, onChange, label }) => <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-[#34343a] px-3 text-sm text-[#d0d6e0]"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-[#5e6ad2]" /> {label}</label>;

const PeopleResults = ({ items, onCollaborate }) => items.length ? <div className="grid gap-4 xl:grid-cols-2">{items.map((person) => <article key={person.id} className="team-card flex min-w-0 flex-col"><div className="flex items-start gap-3">{person.avatar_url ? <img src={person.avatar_url} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="team-avatar rounded-xl">{person.display_name.slice(0, 2).toUpperCase()}</span>}<div className="min-w-0 flex-1"><h2 className="truncate font-medium">{person.display_name}</h2><p className="truncate text-xs text-[#828fff]">@{person.username}</p><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#8a8f98]">{person.headline || "TaskNexus collaborator"}</p></div><span className="team-chip shrink-0">{AVAILABILITY_LABELS[person.availability]}</span></div>{person.location ? <p className="mt-4 flex items-center gap-1.5 text-xs text-[#62666d]"><MapPin className="h-3.5 w-3.5" /> {person.location}</p> : null}<div className="mt-4 flex flex-wrap gap-2">{person.skills.slice(0, 6).map((skill) => <span key={skill.id} className={`team-chip ${person.match_context.matched_skills.some((item) => item.id === skill.id) ? "border-[#5e6ad2] text-[#d0d6e0]" : ""}`}>{skill.name}</span>)}</div><div className="mt-4 grid grid-cols-3 gap-2 border-y border-[#23252a] py-4 text-center"><Fact value={person.published_project_count} label="projects" /><Fact value={person.evidence_summary.internal_task_contributions} label="task proofs" /><Fact value={person.evidence_summary.verified_github_pull_requests} label="verified PRs" /></div>{person.match_context.matched_skills.length || person.match_context.matched_roles.length || person.match_context.matched_interests.length ? <div className="mt-4 rounded-lg border border-[#23252a] bg-[#141516] p-3"><p className="text-xs font-medium text-[#d0d6e0]">Matches your filters</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#8a8f98]">{person.match_context.matched_skills.map((skill) => <span key={skill.id}><Check className="mr-1 inline h-3 w-3 text-[#828fff]" />{skill.name}</span>)}{person.match_context.matched_roles.map((role) => <span key={role}><Check className="mr-1 inline h-3 w-3 text-[#828fff]" />{labelFor(role)}</span>)}{person.match_context.matched_interests.map((interest) => <span key={interest}><Check className="mr-1 inline h-3 w-3 text-[#828fff]" />{labelFor(interest)}</span>)}</div></div> : <p className="mt-4 text-xs text-[#62666d]">Ordered by availability and recent profile update.</p>}<div className="mt-auto flex flex-wrap gap-2 pt-5"><Link to={`/u/${person.username}`} className="team-button-secondary flex-1">View profile <ExternalLink className="h-4 w-4" /></Link><button onClick={() => onCollaborate(person)} className="team-button-primary flex-1"><Send className="h-4 w-4" /> Collaborate</button></div></article>)}</div> : <DiscoveryEmpty title="No developers match all selected filters." copy="Try removing one skill, role, or availability filter. Results are never broadened silently." />;

const OpeningResults = ({ items, onInterest }) => items.length ? <div className="grid gap-4 xl:grid-cols-2">{items.map((opening) => <article key={opening.id} className="team-card flex flex-col"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#828fff]">{opening.team.name}</p><h2 className="mt-2 text-lg font-medium tracking-[-0.02em]">{opening.title}</h2><p className="mt-1 text-sm text-[#d0d6e0]">{labelFor(opening.role)}</p></div><span className="team-chip">Open</span></div>{opening.description ? <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#8a8f98]">{opening.description}</p> : null}<SkillList label="Required" items={opening.required_skills} /><SkillList label="Preferred" items={opening.preferred_skills} />{opening.commitment ? <p className="mt-4 text-xs text-[#62666d]">Commitment · {COMMITMENT_LABELS[opening.commitment]}</p> : null}<div className="mt-auto flex gap-2 pt-5"><Link to={`/teams/${opening.team.slug}`} className="team-button-secondary flex-1">View Team</Link><button onClick={() => onInterest(opening)} className="team-button-primary flex-1">I’m interested</button></div></article>)}</div> : <DiscoveryEmpty title="No open Team roles match." copy="Try a broader role, skill, or interest filter." />;
const SkillList = ({ label, items }) => items.length ? <div className="mt-4"><p className="text-xs text-[#62666d]">{label}</p><div className="mt-2 flex flex-wrap gap-2">{items.map((skill) => <span key={skill.id} className="team-chip">{skill.name}</span>)}</div></div> : null;
const Fact = ({ value, label }) => <div><strong className="block text-lg font-medium">{value}</strong><span className="text-[11px] text-[#62666d]">{label}</span></div>;
const DiscoveryEmpty = ({ title, copy }) => <div className="rounded-xl border border-dashed border-[#34343a] bg-[#0f1011] px-5 py-16 text-center"><FolderKanban className="mx-auto h-6 w-6 text-[#62666d]" /><h2 className="mt-4 font-medium">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8a8f98]">{copy}</p></div>;

export default PeoplePage;
