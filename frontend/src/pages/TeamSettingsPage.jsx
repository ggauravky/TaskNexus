import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Search, Send, ShieldCheck, UserMinus, UserRoundCog, UsersRound, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmActionDialog from "../components/teams/ConfirmActionDialog";
import TeamShell from "../components/teams/TeamShell";
import api from "../services/api";
import { apiError, initials, TEAM_INTERESTS } from "../utils/teams";

const TeamSettingsPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [form, setForm] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [inviteSearch, setInviteSearch] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [inviteMessage, setInviteMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await api.get(`/teams/${slug}`);
      const nextTeam = detail.data.data;
      setTeam(nextTeam);
      setForm({ name: nextTeam.name, tagline: nextTeam.tagline || "", description: nextTeam.description || "", visibility: nextTeam.visibility, joinPolicy: nextTeam.join_policy, primaryInterests: nextTeam.primary_interests || [] });
      if (!nextTeam.viewer_permissions?.edit_team) return;
      const [memberResponse, invitationResponse, requestResponse] = await Promise.all([
        api.get(`/teams/${nextTeam.id}/members`, { params: { limit: 50 } }),
        api.get(`/teams/${nextTeam.id}/invitations`, { params: { limit: 50 } }),
        api.get(`/teams/${nextTeam.id}/join-requests`, { params: { limit: 50 } }),
      ]);
      setMembers(memberResponse.data.data || []);
      setInvitations(invitationResponse.data.data || []);
      setRequests(requestResponse.data.data || []);
    } catch (error) { toast.error(apiError(error, "Team settings could not be loaded")); }
    finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleInterest = (value) => set("primaryInterests", form.primaryInterests.includes(value) ? form.primaryInterests.filter((item) => item !== value) : [...form.primaryInterests, value].slice(0, 12));

  const saveGeneral = async (event) => {
    event.preventDefault(); setSaving(true);
    try { await api.patch(`/teams/${team.id}`, form); toast.success("Team settings saved"); await load(); }
    catch (error) { toast.error(apiError(error)); } finally { setSaving(false); }
  };

  const searchCandidates = async (event) => {
    event.preventDefault();
    if (inviteSearch.trim().length < 2) return;
    try { const response = await api.get(`/teams/${team.id}/invite-candidates`, { params: { search: inviteSearch.trim() } }); setCandidates(response.data.data || []); }
    catch (error) { toast.error(apiError(error)); }
  };

  const invite = async (userId) => {
    setSaving(true);
    try { await api.post(`/teams/${team.id}/invitations`, { userId, message: inviteMessage }); toast.success("Invitation sent"); setCandidates([]); setInviteSearch(""); setInviteMessage(""); await load(); }
    catch (error) { toast.error(apiError(error)); } finally { setSaving(false); }
  };

  const changeRole = async (member, role) => {
    setSaving(true);
    try { await api.patch(`/teams/${team.id}/members/${member.user_id}/role`, { role }); toast.success("Member role updated"); await load(); }
    catch (error) { toast.error(apiError(error)); } finally { setSaving(false); }
  };

  const requestDecision = async (request, action) => {
    setSaving(true);
    try { await api.post(`/team-join-requests/${request.id}/${action}`); toast.success(`Join request ${action}ed`); await load(); }
    catch (error) { toast.error(apiError(error)); } finally { setSaving(false); }
  };

  const cancelInvitation = async (invitation) => {
    setSaving(true);
    try { await api.delete(`/teams/${team.id}/invitations/${invitation.id}`); toast.success("Invitation cancelled"); await load(); }
    catch (error) { toast.error(apiError(error)); } finally { setSaving(false); }
  };

  const confirmAction = async () => {
    setSaving(true);
    try {
      if (confirm.type === "remove") await api.delete(`/teams/${team.id}/members/${confirm.target.user_id}`);
      if (confirm.type === "transfer") await api.post(`/teams/${team.id}/transfer-ownership`, { userId: confirm.target.user_id });
      if (confirm.type === "archive") await api.post(`/teams/${team.id}/archive`);
      toast.success(confirm.type === "remove" ? "Member removed" : confirm.type === "transfer" ? "Ownership transferred" : "Team archived");
      setConfirm(null);
      if (confirm.type === "archive") navigate("/teams"); else await load();
    } catch (error) { toast.error(apiError(error)); } finally { setSaving(false); }
  };

  if (loading) return <TeamShell><div className="flex min-h-[70dvh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" aria-label="Loading team settings" /></div></TeamShell>;
  if (!team?.viewer_permissions?.edit_team) return <TeamShell><main className="mx-auto max-w-2xl px-4 py-24 text-center"><h1 className="text-2xl font-semibold">Team settings are restricted</h1><p className="mt-3 text-[#8a8f98]">Only this team’s owner and admins can manage it.</p><Link to={team ? `/teams/${team.slug}` : "/teams"} className="team-button-primary mt-6">Back to team</Link></main></TeamShell>;

  const viewerRole = team.viewer_relationship.role;
  const manageable = (member) => member.role !== "owner" && (viewerRole === "owner" || (viewerRole === "admin" && member.role === "member"));

  return <TeamShell>
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link to={`/teams/${team.slug}`} className="inline-flex items-center gap-2 text-sm text-[#8a8f98] hover:text-white"><ArrowLeft className="h-4 w-4" /> {team.name}</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start"><p className="team-eyebrow">Team settings</p><h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Manage {team.name}</h1><nav className="mt-6 grid gap-1" aria-label="Settings sections">{[["general", "General"], ["access", "Access"], ["members", "Members"], ["invitations", "Invitations"], ["requests", "Join requests"], ...(viewerRole === "owner" ? [["danger", "Danger zone"]] : [])].map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-lg px-3 py-2 text-sm text-[#8a8f98] hover:bg-[#141516] hover:text-white">{label}</a>)}</nav></aside>
        <div className="space-y-8">
          <SettingsSection id="general" title="General" copy="The public-facing identity and purpose of your team.">
            <form onSubmit={saveGeneral} className="grid gap-4 sm:grid-cols-2"><Field required label="Name" value={form.name} onChange={(value) => set("name", value)} maxLength={80} /><Field label="Tagline" value={form.tagline} onChange={(value) => set("tagline", value)} maxLength={160} /><label className="sm:col-span-2"><span className="team-label">Description</span><textarea className="team-input min-h-32 resize-y" value={form.description} onChange={(event) => set("description", event.target.value)} maxLength={3000} /></label><div className="sm:col-span-2 flex justify-end"><button disabled={saving} className="team-button-primary">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save general settings</button></div></form>
          </SettingsSection>

          <SettingsSection id="access" title="Access" copy="Visibility controls who can view the team. Join policy controls how membership begins.">
            <div className="grid gap-4 sm:grid-cols-2"><label><span className="team-label">Visibility</span><select className="team-input" value={form.visibility} onChange={(event) => set("visibility", event.target.value)}><option value="public">Public</option><option value="private">Private</option></select></label><label><span className="team-label">Join policy</span><select className="team-input" value={form.joinPolicy} onChange={(event) => set("joinPolicy", event.target.value)}><option value="open">Open</option><option value="request">Request approval</option><option value="invite_only">Invitation only</option></select></label></div><fieldset className="mt-5"><legend className="team-label">Interests</legend><div className="flex flex-wrap gap-2">{TEAM_INTERESTS.map(([value, label]) => <button type="button" key={value} onClick={() => toggleInterest(value)} aria-pressed={form.primaryInterests.includes(value)} className={`team-choice ${form.primaryInterests.includes(value) ? "is-active" : ""}`}>{form.primaryInterests.includes(value) ? <Check className="h-3.5 w-3.5" /> : null}{label}</button>)}</div></fieldset><div className="mt-5 flex justify-end"><button type="button" disabled={saving} onClick={saveGeneral} className="team-button-primary">Save access settings</button></div>
          </SettingsSection>

          <SettingsSection id="members" title="Members" copy="Roles here are contextual and never change marketplace account roles.">
            <div className="divide-y divide-[#23252a]">{members.map((member) => <MemberManagementRow key={member.id} member={member} viewerRole={viewerRole} manageable={manageable(member)} busy={saving} onRole={changeRole} onRemove={() => setConfirm({ type: "remove", target: member })} onTransfer={() => setConfirm({ type: "transfer", target: member })} />)}</div>
          </SettingsSection>

          <SettingsSection id="invitations" title="Invitations" copy="Search a bounded set of discoverable TaskNexus profiles.">
            <form onSubmit={searchCandidates} className="flex gap-2"><label className="relative flex-1"><span className="sr-only">Search people</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]" /><input className="team-input pl-10" value={inviteSearch} onChange={(event) => setInviteSearch(event.target.value)} placeholder="Username, name, headline, or primary skill" /></label><button className="team-button-secondary">Search</button></form>
            {candidates.length ? <div className="mt-4 rounded-xl border border-[#23252a]">{candidates.map((candidate) => <div key={candidate.id} className="team-row-card border-0 border-b border-[#23252a] last:border-b-0"><ProfileIdentity profile={candidate} /><button disabled={saving} onClick={() => invite(candidate.id)} className="team-button-primary"><Send className="h-4 w-4" /> Invite</button></div>)}</div> : null}
            <label className="mt-4 block"><span className="team-label">Optional invitation note</span><textarea className="team-input min-h-20 resize-y" value={inviteMessage} onChange={(event) => setInviteMessage(event.target.value)} maxLength={500} /></label>
            <div className="mt-6 space-y-3">{invitations.length ? invitations.map((invitation) => <div key={invitation.id} className="team-row-card"><ProfileIdentity profile={invitation.invited_user} /><button disabled={saving} onClick={() => cancelInvitation(invitation)} className="team-button-secondary"><X className="h-4 w-4" /> Cancel</button></div>) : <p className="text-sm text-[#62666d]">No pending invitations.</p>}</div>
          </SettingsSection>

          <SettingsSection id="requests" title="Join requests" copy="Owner and admins may accept or reject. Each decision is transactional.">
            <div className="space-y-3">{requests.length ? requests.map((request) => <div key={request.id} className="team-row-card"><div className="min-w-0"><ProfileIdentity profile={request.requester} />{request.message ? <p className="mt-3 text-sm leading-6 text-[#d0d6e0]">{request.message}</p> : null}</div><div className="flex gap-2"><button disabled={saving} onClick={() => requestDecision(request, "reject")} className="team-button-secondary">Reject</button><button disabled={saving} onClick={() => requestDecision(request, "accept")} className="team-button-primary"><Check className="h-4 w-4" /> Accept</button></div></div>) : <p className="text-sm text-[#62666d]">No pending join requests.</p>}</div>
          </SettingsSection>

          {viewerRole === "owner" ? <SettingsSection id="danger" title="Danger zone" copy="Ownership changes and archival require a deliberate confirmation." danger><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-[#34343a] bg-[#141516] p-4"><h3 className="text-sm font-medium">Transfer ownership</h3><p className="mt-2 text-xs leading-5 text-[#8a8f98]">Choose an active member above. You become an admin after transfer.</p></div><div className="rounded-xl border border-red-950 bg-red-950/10 p-4"><h3 className="text-sm font-medium text-red-100">Archive team</h3><p className="mt-2 text-xs leading-5 text-red-200/60">Hide this team and stop new membership actions. Existing history remains.</p><button onClick={() => setConfirm({ type: "archive" })} className="team-button-danger mt-4">Archive team</button></div></div></SettingsSection> : null}
        </div>
      </div>
    </main>
    {confirm ? <ConfirmActionDialog title={confirm.type === "remove" ? `Remove ${confirm.target?.profile?.display_name || "member"}?` : confirm.type === "transfer" ? `Transfer ownership to ${confirm.target?.profile?.display_name || "this member"}?` : "Archive this team?"} description={confirm.type === "remove" ? "Their active membership ends immediately. The activity history remains." : confirm.type === "transfer" ? "You become an admin and the selected member becomes the sole owner in one transaction." : "The team leaves discovery and no new membership actions will be allowed."} confirmLabel={confirm.type === "remove" ? "Remove member" : confirm.type === "transfer" ? "Transfer ownership" : "Archive team"} destructive={confirm.type !== "transfer"} busy={saving} onClose={() => setConfirm(null)} onConfirm={confirmAction} /> : null}
  </TeamShell>;
};

const SettingsSection = ({ id, title, copy, danger = false, children }) => <section id={id} className={`scroll-mt-24 rounded-xl border p-5 sm:p-7 ${danger ? "border-red-950 bg-red-950/10" : "border-[#23252a] bg-[#0f1011]"}`}><div className="mb-6"><h2 className="text-lg font-medium tracking-[-0.02em]">{title}</h2><p className="mt-1 text-sm leading-6 text-[#8a8f98]">{copy}</p></div>{children}</section>;
const Field = ({ label, value, onChange, ...props }) => <label><span className="team-label">{label}</span><input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="team-input" /></label>;
const ProfileIdentity = ({ profile }) => <div className="flex min-w-0 items-center gap-3">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#34343a] bg-[#18191a] text-xs">{initials(profile?.display_name)}</span>}<div className="min-w-0"><p className="truncate text-sm font-medium">{profile?.display_name || "TaskNexus member"}</p><p className="truncate text-xs text-[#8a8f98]">{profile?.headline || (profile?.username ? `@${profile.username}` : "Discoverable profile")}</p></div></div>;
const MemberManagementRow = ({ member, viewerRole, manageable, busy, onRole, onRemove, onTransfer }) => <div className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><ProfileIdentity profile={member.profile} /><div className="flex flex-wrap items-center gap-2"><span className="team-chip capitalize"><ShieldCheck className="h-3 w-3" /> {member.role}</span>{viewerRole === "owner" && member.role !== "owner" ? <button disabled={busy} onClick={() => onRole(member, member.role === "admin" ? "member" : "admin")} className="team-button-secondary"><UserRoundCog className="h-4 w-4" /> {member.role === "admin" ? "Make member" : "Make admin"}</button> : null}{viewerRole === "owner" && member.role !== "owner" ? <button disabled={busy} onClick={onTransfer} className="team-button-secondary"><UsersRound className="h-4 w-4" /> Transfer</button> : null}{manageable ? <button disabled={busy} onClick={onRemove} className="team-button-secondary text-red-200"><UserMinus className="h-4 w-4" /> Remove</button> : null}</div></div>;

export default TeamSettingsPage;
