import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ListChecks, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import EmptyState from "../components/common/EmptyState";
import Loading from "../components/common/Loading";
import StatusBadge from "../components/common/StatusBadge";
import { MetricStrip, SectionCard, WorkspaceHeader } from "../components/dashboard/WorkspacePrimitives";
import api from "../services/api";
import { apiError, formatDate, taskTitle } from "../utils/marketplace";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { const response = await api.get("/admin/dashboard"); setData(response.data.data); } catch (error) { toast.error(apiError(error, "Admin workspace could not be loaded")); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const counts = useMemo(() => Object.fromEntries((data?.tasks?.byStatus || []).map((item) => [item.status, item.count])), [data]);
  const metrics = [
    { label: "Awaiting approval", value: counts.submitted || 0 },
    { label: "Active marketplace tasks", value: (counts.assigned || 0) + (counts.in_progress || 0) },
    { label: "Open disputes", value: counts.disputed || 0 },
    { label: "Platform users", value: data?.users?.total || 0 },
  ];
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); toast.success("Operations refreshed"); };
  if (loading) return <Loading fullScreen text="Loading admin workspace..." />;
  const recent = data?.recentTasks || [];
  const pending = recent.filter((task) => task.status === "submitted");
  return <div className="min-h-screen bg-[#010102] text-[#f7f8f8]"><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <WorkspaceHeader eyebrow="Administration" title="Marketplace operations" description="Review work, manage accounts, and monitor operational state." actions={<button onClick={refresh} disabled={refreshing} className="team-button-secondary"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button>} />
    <MetricStrip items={metrics} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
      <SectionCard title="Pending task reviews" description="New client tasks waiting for an administrator decision">{pending.length ? <div className="space-y-2">{pending.map((task) => <div key={task.id} className="team-row-card"><div className="min-w-0"><StatusBadge status={task.status} /><p className="mt-2 truncate text-sm font-medium">{taskTitle(task)}</p><p className="mt-1 text-xs text-[#62666d]">Updated {formatDate(task.updated_at)}</p></div><button onClick={() => navigate(`/admin/tasks?status=submitted&task=${task.id}`)} className="team-button-primary">Review</button></div>)}</div> : <EmptyState icon={ListChecks} title="Review queue is clear" description="Newly submitted marketplace tasks will appear here." className="py-7" />}</SectionCard>
      <SectionCard title="Quick actions" description="Operational tools"><div className="grid gap-2"><button onClick={() => navigate("/admin/tasks?status=submitted")} className="team-button-primary w-full"><ListChecks className="h-4 w-4" /> Review tasks</button><button onClick={() => navigate("/admin/users")} className="team-button-secondary w-full"><Users className="h-4 w-4" /> Manage users</button><button onClick={() => navigate("/admin/tasks?status=disputed")} className="team-button-secondary w-full"><ShieldAlert className="h-4 w-4" /> Open disputes</button><button onClick={() => navigate("/admin/analytics")} className="team-button-secondary w-full"><BarChart3 className="h-4 w-4" /> View analytics</button></div></SectionCard>
    </div>
    <SectionCard title="Recent marketplace activity" description="Latest task records from the operational feed">{recent.length ? <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-left text-sm"><thead className="text-xs text-[#62666d]"><tr><th className="pb-3 pr-5 font-medium">Task</th><th className="pb-3 pr-5 font-medium">Status</th><th className="pb-3 pr-5 font-medium">Updated</th><th className="pb-3 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-[#23252a]">{recent.map((task) => <tr key={task.id}><td className="py-4 pr-5 font-medium">{taskTitle(task)}</td><td className="py-4 pr-5"><StatusBadge status={task.status} /></td><td className="py-4 pr-5 text-[#8a8f98]">{formatDate(task.updated_at)}</td><td className="py-4 text-right"><button onClick={() => navigate(`/admin/tasks?task=${task.id}`)} className="team-button-secondary">Open</button></td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-[#62666d]">No task activity yet.</p>}</SectionCard>
  </main></div>;
};

export default AdminDashboard;
