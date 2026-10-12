import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import EmptyState from "../components/common/EmptyState";
import { Pagination, SectionCard, WorkspaceHeader } from "../components/dashboard/WorkspacePrimitives";
import api from "../services/api";
import { apiError, formatDate, personName } from "../utils/marketplace";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const load = useCallback(async () => { setLoading(true); try { const response = await api.get("/admin/users", { params: { page, limit: 20, search: debouncedSearch || undefined, role: role || undefined, status: status || undefined, sortBy: "created_at", sortOrder: "desc" } }); setUsers(response.data.data?.users || []); setPagination(response.data.meta?.pagination || null); } catch (error) { toast.error(apiError(error, "Users could not be loaded")); } finally { setLoading(false); } }, [debouncedSearch, page, role, status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setDebouncedSearch(search.trim()); }, 250); return () => window.clearTimeout(timer); }, [search]);
  const updateStatus = async (user, nextStatus) => { if (busyId) return; setBusyId(user.id); try { await api.patch(`/admin/users/${user.id}/status`, { status: nextStatus }); toast.success(`Account ${nextStatus}`); await load(); } catch (error) { toast.error(apiError(error, "Account status could not be updated")); } finally { setBusyId(""); } };
  return <div className="min-h-screen bg-[#010102] text-[#f7f8f8]"><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <WorkspaceHeader eyebrow="Admin workspace" title="User operations" description="Search accounts and manage access without changing contextual Team or Organization roles." actions={<><Link to="/admin/dashboard" className="team-button-secondary"><ArrowLeft className="h-4 w-4" /> Overview</Link><button onClick={load} disabled={loading} className="team-button-secondary"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button></>} />
    <SectionCard title="Platform accounts" description="Server-paginated users and global marketplace roles"><div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]"><label><span className="team-label">Search name or email</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#62666d]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="team-input pl-10" /></span></label><label><span className="team-label">Global role</span><select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className="team-input"><option value="">All roles</option><option value="client">Client</option><option value="freelancer">Freelancer</option><option value="admin">Admin</option></select></label><label><span className="team-label">Account status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="team-input"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="blocked">Blocked</option></select></label></div>
      {loading ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#828fff]" /></div> : users.length ? <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="text-xs text-[#62666d]"><tr><th className="pb-3 pr-5 font-medium">User</th><th className="pb-3 pr-5 font-medium">Role</th><th className="pb-3 pr-5 font-medium">Status</th><th className="pb-3 pr-5 font-medium">Joined</th><th className="pb-3 text-right font-medium">Account action</th></tr></thead><tbody className="divide-y divide-[#23252a]">{users.map((user) => <tr key={user.id}><td className="py-4 pr-5"><p className="font-medium">{personName(user, "TaskNexus user")}</p><p className="mt-1 text-xs text-[#62666d]">{user.email}</p></td><td className="py-4 pr-5 capitalize text-[#8a8f98]">{user.role}</td><td className="py-4 pr-5"><span className={`team-chip capitalize ${user.status === "active" ? "text-emerald-200" : "text-amber-200"}`}>{user.status}</span></td><td className="py-4 pr-5 text-[#8a8f98]">{formatDate(user.created_at)}</td><td className="py-4 text-right">{user.role === "admin" ? <span className="text-xs text-[#62666d]">Protected administrator</span> : <select aria-label={`Change status for ${user.email}`} disabled={busyId === user.id} value={user.status} onChange={(event) => updateStatus(user, event.target.value)} className="team-input ml-auto min-h-10 w-36 py-2"><option value="active">Active</option><option value="suspended">Suspended</option><option value="blocked">Blocked</option></select>}</td></tr>)}</tbody></table></div> : <EmptyState title="No users found" description="Adjust the search or account filters." />}<Pagination pagination={pagination} onPage={setPage} disabled={loading} />
    </SectionCard>
  </main></div>;
};

export default AdminUsers;
