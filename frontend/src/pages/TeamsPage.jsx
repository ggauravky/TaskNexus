import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Compass, Inbox, Loader2, Plus, Search, UsersRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Dialog from "../components/common/Dialog";
import TeamCard from "../components/teams/TeamCard";
import TeamShell from "../components/teams/TeamShell";
import api from "../services/api";
import { apiError, TEAM_INTERESTS } from "../utils/teams";

const initialForm = {
  name: "", slug: "", tagline: "", description: "", visibility: "public", joinPolicy: "request", primaryInterests: [],
};

const TeamsPage = () => {
  const navigate = useNavigate();
  const [myTeams, setMyTeams] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [interest, setInterest] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [actingId, setActingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, publicTeams, invites, ownRequests] = await Promise.all([
        api.get("/teams", { params: { scope: "mine", limit: 30 } }),
        api.get("/teams", { params: { search, interest, limit: 24 } }),
        api.get("/team-invitations", { params: { limit: 20 } }),
        api.get("/team-join-requests", { params: { limit: 20 } }),
      ]);
      setMyTeams(mine.data.data || []);
      setDiscover(publicTeams.data.data || []);
      setInvitations(invites.data.data || []);
      setRequests(ownRequests.data.data || []);
    } catch (error) {
      toast.error(apiError(error, "Teams could not be loaded"));
    } finally {
      setLoading(false);
    }
  }, [interest, search]);

  useEffect(() => { load(); }, [load]);

  const invitationAction = async (id, action) => {
    setActingId(id);
    try {
      const response = await api.post(`/team-invitations/${id}/${action}`);
      toast.success(response.data.message);
      await load();
      if (action === "accept" && response.data.data?.team_slug) navigate(`/teams/${response.data.data.team_slug}`);
    } catch (error) { toast.error(apiError(error)); } finally { setActingId(null); }
  };

  const cancelRequest = async (id) => {
    setActingId(id);
    try { await api.delete(`/team-join-requests/${id}`); toast.success("Join request cancelled"); await load(); }
    catch (error) { toast.error(apiError(error)); } finally { setActingId(null); }
  };

  return (
    <TeamShell>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="flex flex-col gap-6 border-b border-[#23252a] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="team-eyebrow">Team foundation</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Find the people you build with.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#8a8f98] sm:text-base">Create a focused team, join an open one, or request access. Team permissions stay independent from your marketplace account role.</p>
          </div>
          <button type="button" onClick={() => setCreateOpen(true)} className="team-button-primary shrink-0"><Plus className="h-4 w-4" /> Create team</button>
        </header>

        {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" aria-label="Loading teams" /></div> : (
          <div className="mt-10 space-y-12">
            {(invitations.length || requests.length) ? (
              <section aria-labelledby="team-inbox-heading">
                <SectionHeading id="team-inbox-heading" icon={Inbox} title="Your inbox" copy="Invitations and requests waiting for a decision." />
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {invitations.map((invite) => (
                    <div key={invite.id} className="team-row-card">
                      <div className="min-w-0"><p className="text-sm font-medium text-[#f7f8f8]">Invitation to {invite.team?.name}</p><p className="mt-1 text-xs text-[#8a8f98]">From {invite.invited_by_user?.display_name || "a team administrator"}</p>{invite.message ? <p className="mt-3 text-sm text-[#d0d6e0]">{invite.message}</p> : null}</div>
                      <div className="flex shrink-0 gap-2"><button disabled={actingId === invite.id} onClick={() => invitationAction(invite.id, "decline")} className="team-button-secondary">Decline</button><button disabled={actingId === invite.id} onClick={() => invitationAction(invite.id, "accept")} className="team-button-primary"><Check className="h-4 w-4" /> Accept</button></div>
                    </div>
                  ))}
                  {requests.map((request) => (
                    <div key={request.id} className="team-row-card">
                      <div><p className="text-sm font-medium text-[#f7f8f8]">Request pending · {request.team?.name}</p><p className="mt-1 text-xs text-[#8a8f98]">The team owner or an admin can review it.</p></div>
                      <button disabled={actingId === request.id} onClick={() => cancelRequest(request.id)} className="team-button-secondary">Cancel request</button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section aria-labelledby="my-teams-heading">
              <SectionHeading id="my-teams-heading" icon={UsersRound} title="My teams" copy="Teams where you have an active membership." />
              {myTeams.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{myTeams.map((team) => <TeamCard key={team.id} team={team} />)}</div> : <div className="mt-5"><TeamEmpty title="No teams yet" copy="Create a team or discover one that matches how you want to collaborate." /></div>}
            </section>

            <section aria-labelledby="discover-teams-heading">
              <SectionHeading id="discover-teams-heading" icon={Compass} title="Discover public teams" copy="Search by name and narrow the list by interest." />
              <form onSubmit={(event) => { event.preventDefault(); load(); }} className="mt-5 grid gap-3 rounded-xl border border-[#23252a] bg-[#0f1011] p-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
                <label className="relative"><span className="sr-only">Search teams</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="team-input pl-10" placeholder="Search teams" /></label>
                <label><span className="sr-only">Filter by interest</span><select value={interest} onChange={(event) => setInterest(event.target.value)} className="team-input"><option value="">All interests</option>{TEAM_INTERESTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <button className="team-button-secondary" type="submit">Apply filters</button>
              </form>
              {discover.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{discover.map((team) => <TeamCard key={team.id} team={team} />)}</div> : <div className="mt-5"><TeamEmpty title="No teams found" copy="Try a broader search or create the team you want to see." /></div>}
            </section>
          </div>
        )}
      </main>
      {createOpen ? <CreateTeamDialog onClose={() => setCreateOpen(false)} onCreated={(team) => navigate(`/teams/${team.slug}`)} /> : null}
    </TeamShell>
  );
};

const SectionHeading = ({ id, icon: Icon, title, copy }) => <div className="flex items-start gap-3"><span className="team-section-icon"><Icon className="h-4 w-4" /></span><div><h2 className="text-lg font-medium tracking-[-0.02em]" id={id}>{title}</h2><p className="mt-1 text-sm text-[#8a8f98]">{copy}</p></div></div>;
const TeamEmpty = ({ title, copy }) => <div className="rounded-xl border border-dashed border-[#34343a] bg-[#0f1011] px-5 py-10 text-center"><Compass className="mx-auto h-6 w-6 text-[#62666d]" /><h3 className="mt-3 text-sm font-medium text-[#d0d6e0]">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#62666d]">{copy}</p></div>;

const CreateTeamDialog = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateName = (name) => {
    setForm((current) => ({ ...current, name, ...(!slugEdited ? { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") } : {}) }));
  };
  const toggleInterest = (value) => set("primaryInterests", form.primaryInterests.includes(value) ? form.primaryInterests.filter((item) => item !== value) : [...form.primaryInterests, value].slice(0, 12));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try { const response = await api.post("/teams", form); toast.success("Team created"); onCreated(response.data.data); }
    catch (error) { toast.error(apiError(error, "Team could not be created")); } finally { setSaving(false); }
  };
  return <Dialog onClose={onClose} titleId="create-team-title" descriptionId="create-team-copy" panelClassName="max-w-2xl !border-[#34343a] !bg-[#0f1011] !shadow-none">
    <form onSubmit={submit} className="p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="team-eyebrow">New team</p><h2 id="create-team-title" className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#f7f8f8]">Create a place to build together.</h2><p id="create-team-copy" className="mt-2 text-sm leading-6 text-[#8a8f98]">Start with the essentials. You can refine access and members afterward.</p></div><button type="button" onClick={onClose} className="team-icon-button" aria-label="Close"><X className="h-4 w-4" /></button></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <TeamField required label="Team name" value={form.name} onChange={updateName} maxLength={80} />
        <TeamField required label="Slug" value={form.slug} onChange={(value) => { setSlugEdited(true); set("slug", value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }} maxLength={60} prefix="tasknexus.com/teams/" />
        <div className="sm:col-span-2"><TeamField label="Tagline" value={form.tagline} onChange={(value) => set("tagline", value)} maxLength={160} placeholder="What are you here to build?" /></div>
        <label className="sm:col-span-2"><span className="team-label">Description</span><textarea className="team-input min-h-28 resize-y" value={form.description} onChange={(event) => set("description", event.target.value)} maxLength={3000} placeholder="Purpose, technologies, and who would thrive here." /></label>
        <label><span className="team-label">Visibility</span><select className="team-input" value={form.visibility} onChange={(event) => set("visibility", event.target.value)}><option value="public">Public</option><option value="private">Private</option></select></label>
        <label><span className="team-label">Joining</span><select className="team-input" value={form.joinPolicy} onChange={(event) => set("joinPolicy", event.target.value)}><option value="open">Open</option><option value="request">Request approval</option><option value="invite_only">Invitation only</option></select></label>
      </div>
      <fieldset className="mt-5"><legend className="team-label">Primary interests</legend><div className="flex flex-wrap gap-2">{TEAM_INTERESTS.map(([value, label]) => <button key={value} type="button" aria-pressed={form.primaryInterests.includes(value)} onClick={() => toggleInterest(value)} className={`team-choice ${form.primaryInterests.includes(value) ? "is-active" : ""}`}>{form.primaryInterests.includes(value) ? <Check className="h-3.5 w-3.5" /> : null}{label}</button>)}</div></fieldset>
      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="team-button-secondary">Cancel</button><button type="submit" disabled={saving} className="team-button-primary">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Create team</button></div>
    </form>
  </Dialog>;
};

const TeamField = ({ label, value, onChange, prefix, ...props }) => <label><span className="team-label">{label}</span>{prefix ? <span className="flex min-h-11 items-center overflow-hidden rounded-lg border border-[#34343a] bg-[#141516] focus-within:border-[#5e69d1] focus-within:ring-2 focus-within:ring-[#5e69d1]/30"><span className="hidden pl-3 text-xs text-[#62666d] sm:block">{prefix}</span><input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[#f7f8f8] outline-none" /></span> : <input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="team-input" />}</label>;

export default TeamsPage;
