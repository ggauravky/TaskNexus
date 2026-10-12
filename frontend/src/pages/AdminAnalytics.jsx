import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { MetricStrip, SectionCard, WorkspaceHeader } from "../components/dashboard/WorkspacePrimitives";
import api from "../services/api";
import { apiError, formatCurrency } from "../utils/marketplace";

const AdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { const response = await api.get("/admin/statistics"); setData(response.data.data); } catch (error) { toast.error(apiError(error, "Analytics could not be loaded")); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const metrics = useMemo(() => [
    { label: "Active users", value: data?.activeUsers || 0 },
    { label: "Total tasks", value: data?.totalTasks || 0 },
    { label: "Completion rate", value: `${Number(data?.completionRate || 0).toFixed(1)}%` },
    { label: "Platform fees", value: formatCurrency(data?.platformRevenue || 0) },
  ], [data]);
  const taskRows = Object.entries(data?.tasksByStatus || {});
  const userRows = Object.entries(data?.usersByRole || {});
  return <div className="min-h-screen bg-[#010102] text-[#f7f8f8]"><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <WorkspaceHeader eyebrow="Admin workspace" title="Operational analytics" description="Authoritative platform aggregates from the backend—not partial browser data." actions={<><Link to="/admin/dashboard" className="team-button-secondary"><ArrowLeft className="h-4 w-4" /> Overview</Link><button onClick={load} disabled={loading} className="team-button-secondary"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button></>} />
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#828fff]" /></div> : <><MetricStrip items={metrics} /><div className="grid gap-6 lg:grid-cols-2"><SectionCard title="Tasks by status" description="Current marketplace lifecycle distribution"><Distribution rows={taskRows} total={data?.totalTasks || 0} /></SectionCard><SectionCard title="Users by global role" description="Client, freelancer, and administrator accounts"><Distribution rows={userRows} total={data?.totalUsers || 0} /></SectionCard></div><SectionCard title="Payment operations" description="Recorded payment totals and transaction counts"><div className="grid gap-px overflow-hidden rounded-xl border border-[#23252a] bg-[#23252a] sm:grid-cols-3"><Value label="Released payments" value={formatCurrency(data?.paymentStats?.completed)} detail={`${data?.paymentStats?.completedCount || 0} transactions`} /><Value label="Pending / escrowed" value={formatCurrency(data?.paymentStats?.pending)} detail={`${data?.paymentStats?.pendingCount || 0} transactions`} /><Value label="Platform fees" value={formatCurrency(data?.platformRevenue)} detail="Released fees" /></div></SectionCard><SectionCard title="Recent growth" description="Current calendar-month activity"><div className="grid gap-px overflow-hidden rounded-xl border border-[#23252a] bg-[#23252a] sm:grid-cols-4"><Value label="New users" value={data?.growth?.newUsers || 0} /><Value label="New tasks" value={data?.growth?.newTasks || 0} /><Value label="Average completion" value={`${Number(data?.averageCompletionTime || 0).toFixed(1)}d`} /><Value label="Satisfaction" value={`${Number(data?.satisfactionRate || 0).toFixed(1)}%`} /></div></SectionCard></>}
  </main></div>;
};
const Distribution = ({ rows, total }) => rows.length ? <div className="space-y-4">{rows.map(([label, count]) => <div key={label}><div className="mb-2 flex items-center justify-between text-sm"><span className="capitalize text-[#8a8f98]">{label.replaceAll("_", " ")}</span><span className="font-medium">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#23252a]"><div className="h-full rounded-full bg-[#5e6ad2]" style={{ width: `${total ? Math.min(100, (count / total) * 100) : 0}%` }} /></div></div>)}</div> : <p className="py-8 text-center text-sm text-[#62666d]">No aggregate data yet.</p>;
const Value = ({ label, value, detail }) => <div className="bg-[#141516] p-4"><p className="text-xs text-[#62666d]">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p>{detail ? <p className="mt-1 text-xs text-[#8a8f98]">{detail}</p> : null}</div>;
export default AdminAnalytics;
