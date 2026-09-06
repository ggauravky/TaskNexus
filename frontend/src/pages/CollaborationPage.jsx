import { Ban, Check, Loader2, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import TeamShell from "../components/teams/TeamShell";
import api from "../services/api";
import { apiError, labelFor } from "../utils/discovery";

const CollaborationPage = () => {
  const [scope, setScope] = useState("incoming");
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = scope === "blocked" ? await api.get("/user-blocks") : await api.get("/collaboration-requests", { params: { scope, status, limit: 50 } }); setItems(response.data.data || []); }
    catch (error) { toast.error(apiError(error, "Requests could not be loaded")); }
    finally { setLoading(false); }
  }, [scope, status]);
  useEffect(() => { load(); }, [load]);
  const act = async (item, action) => {
    setBusy(item.id);
    try {
      if (action === "cancel") await api.delete(`/collaboration-requests/${item.id}`);
      else await api.post(`/collaboration-requests/${item.id}/${action}`);
      toast.success(action === "cancel" ? "Request cancelled" : `Request ${action}ed`); await load();
    } catch (error) { toast.error(apiError(error)); } finally { setBusy(""); }
  };
  const block = async (item) => {
    const user = scope === "incoming" ? item.sender : item.recipient;
    setBusy(item.id);
    try { await api.post("/user-blocks", { userId: user.id }); toast.success("User blocked and pending requests cancelled"); await load(); }
    catch (error) { toast.error(apiError(error)); } finally { setBusy(""); }
  };
  const unblock = async (item) => { setBusy(item.id); try { await api.delete(`/user-blocks/${item.user.id}`); toast.success("User unblocked"); await load(); } catch (error) { toast.error(apiError(error)); } finally { setBusy(""); } };
  return <TeamShell><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><header className="flex flex-col gap-5 border-b border-[#23252a] pb-8 sm:flex-row sm:items-end sm:justify-between"><div><p className="team-eyebrow">Collaboration intent</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Requests</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#8a8f98]">Accepting connects intent only. It never grants Team or Project access and does not open a chat.</p></div><Link to="/people" className="team-button-primary"><Send className="h-4 w-4" /> Discover people</Link></header><div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><nav className="flex flex-wrap gap-1" aria-label="Request direction">{["incoming", "outgoing", "blocked"].map((item) => <button key={item} onClick={() => setScope(item)} aria-pressed={scope === item} className={`team-choice capitalize ${scope === item ? "is-active" : ""}`}>{item}</button>)}</nav>{scope !== "blocked" ? <label className="flex items-center gap-2 text-xs text-[#8a8f98]">Status<select className="team-input min-h-10 w-36 py-2" value={status} onChange={(event) => setStatus(event.target.value)}>{["pending", "accepted", "declined", "cancelled"].map((item) => <option key={item}>{item}</option>)}</select></label> : null}</div><section className="mt-6" aria-live="polite" aria-busy={loading}>{loading ? <div className="flex min-h-60 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#828fff]" aria-label="Loading collaboration requests" /></div> : items.length ? <div className="space-y-3">{scope === "blocked" ? items.map((item) => <div key={item.id} className="team-row-card"><div><p className="text-sm font-medium">{item.user.display_name}</p><p className="mt-1 text-xs text-[#62666d]">{item.user.username ? `@${item.user.username}` : "TaskNexus member"}</p></div><button disabled={busy === item.id} onClick={() => unblock(item)} className="team-button-secondary">Unblock</button></div>) : items.map((item) => <RequestCard key={item.id} item={item} scope={scope} busy={busy === item.id} onAction={act} onBlock={block} />)}</div> : <div className="rounded-xl border border-dashed border-[#34343a] bg-[#0f1011] px-5 py-16 text-center"><h2 className="font-medium">No {scope === "blocked" ? "blocked users" : `${status} ${scope} requests`}</h2><p className="mt-2 text-sm text-[#8a8f98]">{scope === "blocked" ? "Blocked users will not be actionable in your discovery results." : "Professional collaboration intent will appear here."}</p></div>}</section></main></TeamShell>;
};

const RequestCard = ({ item, scope, busy, onAction, onBlock }) => {
  const person = scope === "incoming" ? item.sender : item.recipient;
  return <article className="team-row-card items-start sm:items-start"><div className="min-w-0 flex-1"><div className="flex items-center gap-3">{person.avatar_url ? <img src={person.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#34343a] bg-[#18191a] text-xs">{person.display_name.slice(0, 2).toUpperCase()}</span>}<div className="min-w-0"><Link to={person.username ? `/u/${person.username}` : "#"} className="truncate text-sm font-medium hover:text-[#b7bdf8]">{person.display_name}</Link><p className="truncate text-xs text-[#62666d]">{person.username ? `@${person.username}` : "TaskNexus member"}</p></div><span className="team-chip ml-auto capitalize">{item.status}</span></div>{item.opening ? <p className="mt-4 text-xs text-[#828fff]">Team opening · {item.opening.title} · {labelFor(item.opening.role)}</p> : item.team ? <p className="mt-4 text-xs text-[#828fff]">Team · {item.team.name}</p> : item.project ? <p className="mt-4 text-xs text-[#828fff]">Project · {item.project.name}</p> : <p className="mt-4 text-xs text-[#62666d]">General collaboration</p>}{item.message ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#d0d6e0]">{item.message}</p> : <p className="mt-3 text-sm text-[#62666d]">No message attached.</p>}<p className="mt-3 text-xs text-[#62666d]">{new Date(item.created_at).toLocaleDateString()}</p></div><div className="flex flex-wrap gap-2 sm:justify-end">{item.status === "pending" && scope === "incoming" ? <><button disabled={busy} onClick={() => onAction(item, "decline")} className="team-button-secondary"><X className="h-4 w-4" /> Decline</button><button disabled={busy} onClick={() => onAction(item, "accept")} className="team-button-primary">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept</button></> : null}{item.status === "pending" && scope === "outgoing" ? <button disabled={busy} onClick={() => onAction(item, "cancel")} className="team-button-secondary"><X className="h-4 w-4" /> Cancel</button> : null}<button disabled={busy} onClick={() => onBlock(item)} className="team-button-secondary text-red-200"><Ban className="h-4 w-4" /> Block</button></div></article>;
};

export default CollaborationPage;
