import { Building2, Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import TeamShell from "../components/teams/TeamShell";
import api from "../services/api";
import { apiError, formatDate } from "../utils/opportunities";

const OrganizationInvitationsPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  useEffect(() => { document.title = "Organization Invitations | TaskNexus"; }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.get("/organization-invitations", { params: { limit: 50 } })).data.data || []); }
    catch (error) { toast.error(apiError(error, "Organization invitations could not be loaded")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const respond = async (item, action) => {
    setBusy(item.id);
    try {
      const response = await api.post(`/organization-invitations/${item.id}/${action}`);
      toast.success(`Invitation ${action === "accept" ? "accepted" : "declined"}`);
      if (action === "accept") navigate(`/organizations/${response.data.data.organization_slug}/workspace`);
      else await load();
    } catch (error) { toast.error(apiError(error)); }
    finally { setBusy(null); }
  };
  return <TeamShell><main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <PageHeader eyebrow="Organization access" title="Organization invitations" description="Review contextual recruiter and administrator invitations. Accepting one does not change your global TaskNexus account role." actions={<Link to="/opportunities" className="team-button-secondary">Browse Opportunities</Link>} />
    <section className="mt-8" aria-live="polite" aria-busy={loading}>
      {loading ? <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" /></div> : items.length ? <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div className="flex min-w-0 gap-4"><div className="team-avatar h-11 w-11"><Building2 className="h-5 w-5" /></div><div><h2 className="font-medium">{item.organization.name}</h2><p className="mt-1 text-sm text-[#8a8f98]">Invited as <span className="text-[#d0d6e0]">{item.role}</span>{item.invited_by_user?.display_name ? ` by ${item.invited_by_user.display_name}` : ""}</p><p className="mt-1 text-xs text-[#62666d]">Expires {formatDate(item.expires_at)}</p>{item.message ? <p className="mt-3 text-sm leading-6 text-[#a8adb6]">{item.message}</p> : null}</div></div>
        <div className="mt-4 flex gap-2 sm:mt-0"><button disabled={busy === item.id} onClick={() => respond(item, "decline")} className="team-button-secondary"><X className="h-4 w-4" /> Decline</button><button disabled={busy === item.id} onClick={() => respond(item, "accept")} className="team-button-primary">{busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept</button></div>
      </article>)}</div> : <EmptyState icon={Building2} title="No pending Organization invitations" description="New invitations will appear here and in Notifications." />}
    </section>
  </main></TeamShell>;
};

export default OrganizationInvitationsPage;
