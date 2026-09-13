import { CalendarDays, Clock3, Loader2, MapPin, Search, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import TeamShell from "../components/teams/TeamShell";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { HACKATHON_MODE_LABELS, HACKATHON_STATUS_LABELS, apiError, formatHackathonDate } from "../utils/hackathons";

const tabs = [["", "Explore"], ["upcoming", "Upcoming"], ["registration_open", "Registration open"], ["active", "Active"], ["my", "My Hackathons"]];

const HackathonsPage = () => {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState(""); const [search, setSearch] = useState(""); const [mode, setMode] = useState("");
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/hackathons", { params: { limit: 30, sortBy: "event_start", sortOrder: "asc", search: search || undefined, mode: mode || undefined, ...(tab === "my" ? { my: true } : tab ? { status: tab } : {}) } });
      setItems(response.data.data || []);
    } catch (error) { toast.error(apiError(error, "Hackathons could not be loaded")); }
    finally { setLoading(false); }
  }, [mode, search, tab]);
  useEffect(() => { const timer = window.setTimeout(load, search ? 220 : 0); return () => window.clearTimeout(timer); }, [load, search]);

  return <TeamShell><main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <header className="border-b border-[#23252a] pb-8"><p className="team-eyebrow">Hackathon collaboration mode</p><div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:items-end"><div><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Form the team. Ship the entry.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#8a8f98] sm:text-base">Discover events, find visible teammates, reuse your Team and Project, and prepare a deterministic submission checklist.</p></div><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]"><label className="relative"><span className="sr-only">Search Hackathons</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#62666d]" /><input className="team-input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={200} placeholder="Search event or theme" /></label><label><span className="sr-only">Hackathon mode</span><select className="team-input" value={mode} onChange={(event) => setMode(event.target.value)}><option value="">Any mode</option>{Object.entries(HACKATHON_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></div></header>
    <nav className="project-tabs" aria-label="Hackathon views">{tabs.filter(([value]) => value !== "my" || isAuthenticated).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} aria-current={tab === value ? "page" : undefined} className={`project-tab ${tab === value ? "is-active" : ""}`}>{label}</button>)}</nav>
    <section className="mt-7" aria-live="polite" aria-busy={loading}>{loading ? <div className="flex min-h-72 items-center justify-center rounded-xl border border-[#23252a] bg-[#0f1011]"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" aria-label="Loading Hackathons" /></div> : items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((hackathon) => <HackathonCard key={hackathon.id} hackathon={hackathon} />)}</div> : <div className="rounded-xl border border-dashed border-[#34343a] bg-[#0f1011] px-5 py-16 text-center"><CalendarDays className="mx-auto h-7 w-7 text-[#62666d]" /><h2 className="mt-4 font-medium">No Hackathons match this view.</h2><p className="mt-2 text-sm text-[#8a8f98]">Try another lifecycle, mode, or search term.</p></div>}</section>
  </main></TeamShell>;
};

const HackathonCard = ({ hackathon }) => <article className="team-card flex min-w-0 flex-col overflow-hidden p-0"><div className="h-1 bg-[#5e6ad2]" /><div className="flex flex-1 flex-col p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs text-[#828fff]">{hackathon.organizer_name}</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{hackathon.name}</h2></div><span className="team-chip shrink-0">{HACKATHON_STATUS_LABELS[hackathon.status]}</span></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#8a8f98]">{hackathon.tagline || "Build something meaningful with a focused Team."}</p><dl className="mt-5 space-y-2 text-xs text-[#8a8f98]"><Info icon={CalendarDays} term="Starts" value={formatHackathonDate(hackathon.event_start)} /><Info icon={Clock3} term="Register by" value={formatHackathonDate(hackathon.registration_deadline)} /><Info icon={MapPin} term="Mode" value={`${HACKATHON_MODE_LABELS[hackathon.mode]}${hackathon.location?.city ? ` · ${hackathon.location.city}` : ""}`} /><Info icon={UsersRound} term="Team" value={hackathon.team_size.min || hackathon.team_size.max ? `${hackathon.team_size.min || 1} to ${hackathon.team_size.max || "any"} people` : "No size rule"} /></dl><div className="mt-5 flex flex-wrap gap-2">{hackathon.themes.slice(0, 4).map((theme) => <span key={theme} className="team-chip">{theme}</span>)}</div>{hackathon.viewer_participation ? <p className="mt-5 text-xs text-[#b7bdf8]">Your status: {hackathon.viewer_participation.status.replaceAll("_", " ")}{hackathon.viewer_participation.looking_for_team ? " · Looking for Team" : ""}</p> : null}<Link to={`/hackathons/${hackathon.slug}`} className="team-button-primary mt-5 w-full">Open Hackathon</Link></div></article>;
const Info = ({ icon: Icon, term, value }) => <div className="flex items-start gap-2"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#62666d]" /><dt className="sr-only">{term}</dt><dd>{value}</dd></div>;

export default HackathonsPage;
