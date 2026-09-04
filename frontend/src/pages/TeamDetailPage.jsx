import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowLeft, Check, Clock3, Loader2, LockKeyhole, Settings2, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import Dialog from "../components/common/Dialog";
import ConfirmActionDialog from "../components/teams/ConfirmActionDialog";
import TeamShell from "../components/teams/TeamShell";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { apiError, initials, interestLabel } from "../utils/teams";

const TeamDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const detail = await api.get(`/teams/${slug}`);
      const nextTeam = detail.data.data;
      setTeam(nextTeam);
      const memberResponse = await api.get(`/teams/${nextTeam.id}/members`, { params: { limit: 50 } });
      setMembers(memberResponse.data.data || []);
      if (nextTeam.viewer_permissions?.view_activity) {
        const activityResponse = await api.get(`/teams/${nextTeam.id}/activity`, { params: { limit: 20 } });
        setActivity(activityResponse.data.data || []);
      } else setActivity([]);
    } catch (requestError) { setError(apiError(requestError, "Team could not be loaded")); }
    finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const run = async (request, success) => {
    setActing(true);
    try { const response = await request(); toast.success(response.data.message || success); await load(); return response; }
    catch (requestError) { toast.error(apiError(requestError)); return null; }
    finally { setActing(false); }
  };

  const join = () => run(() => api.post(`/teams/${team.id}/join`), "Joined team");
  const invitation = (action) => run(() => api.post(`/team-invitations/${team.viewer_relationship.invitation_id}/${action}`), `Invitation ${action}ed`);
  const leave = async () => {
    const response = await run(() => api.post(`/teams/${team.id}/leave`), "Left team");
    if (response) { setLeaveOpen(false); navigate("/teams"); }
  };

  if (loading) return <TeamShell><div className="flex min-h-[70dvh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" aria-label="Loading team" /></div></TeamShell>;
  if (error || !team) return <TeamShell><main className="mx-auto max-w-3xl px-4 py-24 text-center"><h1 className="text-2xl font-semibold">Team unavailable</h1><p className="mt-3 text-[#8a8f98]">{error}</p><Link to={isAuthenticated ? "/teams" : "/"} className="team-button-primary mt-6">Back to teams</Link></main></TeamShell>;

  const relationship = team.viewer_relationship || { kind: "none" };
  const role = relationship.role;

  return (
    <TeamShell>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <Link to="/teams" className="inline-flex items-center gap-2 text-sm text-[#8a8f98] hover:text-white"><ArrowLeft className="h-4 w-4" /> All teams</Link>
        <section className="mt-6 overflow-hidden rounded-2xl border border-[#23252a] bg-[#0f1011]">
          <div className={`${team.cover_url ? "h-24 sm:h-32" : "h-16 sm:h-20"} border-b border-[#23252a] bg-[#141516]`}>{team.cover_url ? <img src={team.cover_url} alt="" className="h-full w-full object-cover" /> : null}</div>
          <div className="p-5 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 gap-4">
                {team.avatar_url ? <img src={team.avatar_url} alt="" className="-mt-12 h-20 w-20 shrink-0 rounded-2xl border-4 border-[#0f1011] object-cover sm:h-24 sm:w-24" /> : <span className="team-avatar -mt-12 h-20 w-20 shrink-0 rounded-2xl border-4 border-[#0f1011] text-xl sm:h-24 sm:w-24">{initials(team.name)}</span>}
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-4xl">{team.name}</h1>{team.visibility === "private" ? <span className="team-chip"><LockKeyhole className="h-3 w-3" /> Private</span> : null}{role ? <span className="team-chip text-[#b7bdf8]"><ShieldCheck className="h-3 w-3" /> {role}</span> : null}</div><p className="mt-2 text-sm text-[#62666d]">/{team.slug}</p><p className="mt-3 max-w-2xl text-sm leading-6 text-[#d0d6e0] sm:text-base">{team.tagline || "A TaskNexus collaboration team."}</p></div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2"><ViewerActions team={team} isAuthenticated={isAuthenticated} acting={acting} onJoin={join} onRequest={() => setRequestOpen(true)} onInvitation={invitation} onLeave={() => setLeaveOpen(true)} /></div>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#23252a] pt-5 text-sm text-[#8a8f98]"><span className="flex items-center gap-1.5"><UsersRound className="h-4 w-4" /> {team.member_count} members</span><span className="capitalize">{team.join_policy.replace("_", " ")}</span>{(team.primary_interests || []).map((item) => <span key={item} className="team-chip">{interestLabel(item)}</span>)}</div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8">
            <TeamSection title="About"><p className="whitespace-pre-wrap text-sm leading-7 text-[#d0d6e0]">{team.description || "This team has not added a detailed description yet."}</p></TeamSection>
            <TeamSection title="Members" action={<span className="text-xs text-[#62666d]">Safe profile summaries only</span>}>
              <div className="divide-y divide-[#23252a]">{members.map((member) => <MemberItem key={member.id} member={member} />)}</div>
            </TeamSection>
          </div>
          <aside className="space-y-8">
            {team.viewer_permissions?.view_activity ? <TeamSection title="Recent activity"><div className="space-y-4">{activity.length ? activity.map((item) => <ActivityItem key={item.id} item={item} />) : <p className="text-sm text-[#62666d]">No activity yet.</p>}</div></TeamSection> : <TeamSection title="Activity"><p className="text-sm leading-6 text-[#8a8f98]">Activity is visible to active team members.</p></TeamSection>}
            <TeamSection title="Team owner"><div className="flex items-center gap-3"><PersonAvatar profile={team.owner} /><div><p className="text-sm font-medium">{team.owner?.display_name || "Team owner"}</p>{team.owner?.username ? <p className="text-xs text-[#62666d]">@{team.owner.username}</p> : null}</div></div></TeamSection>
          </aside>
        </div>
      </main>
      {requestOpen ? <JoinRequestDialog team={team} onClose={() => setRequestOpen(false)} onSent={async () => { setRequestOpen(false); await load(); }} /> : null}
      {leaveOpen ? <ConfirmActionDialog title="Leave this team?" description="Your membership will become inactive. You can only return through the team’s current join policy." confirmLabel="Leave team" destructive busy={acting} onClose={() => setLeaveOpen(false)} onConfirm={leave} /> : null}
    </TeamShell>
  );
};

const ViewerActions = ({ team, isAuthenticated, acting, onJoin, onRequest, onInvitation, onLeave }) => {
  const relationship = team.viewer_relationship?.kind;
  if (!isAuthenticated) return <Link to="/login" className="team-button-primary">Sign in to join</Link>;
  if (relationship === "invited") return <><button disabled={acting} onClick={() => onInvitation("decline")} className="team-button-secondary">Decline</button><button disabled={acting} onClick={() => onInvitation("accept")} className="team-button-primary"><Check className="h-4 w-4" /> Accept invitation</button></>;
  if (relationship === "pending_request") return <button type="button" disabled className="team-button-secondary"><Clock3 className="h-4 w-4" /> Request pending</button>;
  if (relationship === "member") return <>{team.viewer_permissions?.edit_team ? <Link to={`/teams/${team.slug}/settings`} className="team-button-primary"><Settings2 className="h-4 w-4" /> Manage team</Link> : null}{team.viewer_relationship.role !== "owner" ? <button disabled={acting} onClick={onLeave} className="team-button-secondary">Leave team</button> : null}</>;
  if (team.join_policy === "open") return <button disabled={acting} onClick={onJoin} className="team-button-primary"><UserPlus className="h-4 w-4" /> Join team</button>;
  if (team.join_policy === "request") return <button disabled={acting} onClick={onRequest} className="team-button-primary"><UserPlus className="h-4 w-4" /> Request to join</button>;
  return <button type="button" disabled className="team-button-secondary"><LockKeyhole className="h-4 w-4" /> Invitation required</button>;
};

const JoinRequestDialog = ({ team, onClose, onSent }) => {
  const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { await api.post(`/teams/${team.id}/join-requests`, { message }); toast.success("Join request sent"); onSent(); } catch (error) { toast.error(apiError(error)); } finally { setSaving(false); } };
  return <Dialog onClose={onClose} titleId="join-request-title" descriptionId="join-request-copy" panelClassName="max-w-lg !border-[#34343a] !bg-[#0f1011] !shadow-none"><form onSubmit={submit} className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 id="join-request-title" className="text-xl font-semibold text-[#f7f8f8]">Request to join {team.name}</h2><p id="join-request-copy" className="mt-2 text-sm leading-6 text-[#8a8f98]">Add a short note about how you hope to contribute. It is optional.</p></div><button type="button" onClick={onClose} className="team-icon-button" aria-label="Close"><X className="h-4 w-4" /></button></div><label className="mt-5 block"><span className="team-label">Message</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} className="team-input min-h-28 resize-y" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="team-button-secondary">Cancel</button><button disabled={saving} className="team-button-primary">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send request</button></div></form></Dialog>;
};

const TeamSection = ({ title, action, children }) => <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-medium tracking-[-0.02em]">{title}</h2>{action}</div>{children}</section>;
const PersonAvatar = ({ profile }) => profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#34343a] bg-[#18191a] text-xs font-medium">{initials(profile?.display_name)}</span>;
const MemberItem = ({ member }) => <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-3"><PersonAvatar profile={member.profile} /><div className="min-w-0"><p className="truncate text-sm font-medium">{member.profile?.display_name || "TaskNexus member"}</p><p className="truncate text-xs text-[#8a8f98]">{member.profile?.headline || (member.profile?.username ? `@${member.profile.username}` : "Private professional profile")}</p></div></div><span className="team-chip capitalize">{member.role}</span></div>;
const ActivityItem = ({ item }) => <div className="flex gap-3"><span className="team-section-icon h-8 w-8"><Activity className="h-3.5 w-3.5" /></span><div><p className="text-sm text-[#d0d6e0]"><span className="font-medium text-[#f7f8f8]">{item.actor?.display_name || "A member"}</span> {String(item.type).replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[#62666d]">{new Date(item.created_at).toLocaleDateString()}</p></div></div>;

export default TeamDetailPage;
