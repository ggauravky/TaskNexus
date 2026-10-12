import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Compass, DollarSign, RefreshCw, Search, Settings2, Star } from "lucide-react";
import toast from "react-hot-toast";
import EmptyState from "../components/common/EmptyState";
import Loading from "../components/common/Loading";
import StatusBadge from "../components/common/StatusBadge";
import WorkspaceSettingsDialog from "../components/dashboard/WorkspaceSettingsDialog";
import { MetricStrip, Pagination, SectionCard, WorkspaceHeader } from "../components/dashboard/WorkspacePrimitives";
import TaskDetailsModal from "../components/freelancer/TaskDetailsModal";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../hooks/usePreferences";
import useRealtimeEvents from "../hooks/useRealtimeEvents";
import api from "../services/api";
import { TASK_STATUS } from "../utils/constants";
import { apiError, dueLabel, formatCurrency, formatDate, personName, taskBudget, taskDeadline, taskTitle } from "../utils/marketplace";

const VIEWS = [["overview", "Overview"], ["work", "My work"], ["available", "Find work"], ["earnings", "Earnings"], ["reviews", "Reviews"]];
const availabilityOptions = [["available", "Available"], ["part_time", "Limited"], ["busy", "Busy"]];
const workStatuses = [["", "All statuses"], [TASK_STATUS.ASSIGNED, "Assigned"], [TASK_STATUS.IN_PROGRESS, "In progress"], [TASK_STATUS.DELIVERED, "Awaiting review"], [TASK_STATUS.CLIENT_REVISION, "Revision requested"], [TASK_STATUS.COMPLETED, "Completed"]];

const FreelancerDashboard = () => {
  const { user, updateUser } = useAuth();
  const preferenceState = usePreferences();
  const { preferences } = preferenceState;
  const [view, setView] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [myPagination, setMyPagination] = useState(null);
  const [availablePagination, setAvailablePagination] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [myPage, setMyPage] = useState(1);
  const [availablePage, setAvailablePage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [busyAction, setBusyAction] = useState("");

  const loadOverview = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [summary, offers] = await Promise.all([
        api.get("/freelancer/dashboard"),
        api.get("/freelancer/available-tasks", { params: { page: 1, limit: 4, sortBy: "updated_at", sortOrder: "desc" } }),
      ]);
      setDashboard(summary.data.data);
      setAvailableTasks(offers.data.data?.tasks || []);
      setAvailablePagination(offers.data.meta?.pagination || null);
      setError("");
    } catch (requestError) {
      const message = apiError(requestError, "Freelancer workspace could not be loaded");
      setError(message);
      if (!silent) toast.error(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadMyWork = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setSectionLoading(true);
    try {
      const response = await api.get("/freelancer/my-tasks", { params: { page: myPage, limit: 10, status: status || undefined, search: debouncedSearch || undefined, sortBy: "created_at", sortOrder: preferences.defaultTaskSort === "oldest" ? "asc" : "desc" } });
      setMyTasks(response.data.data?.tasks || []);
      setMyPagination(response.data.meta?.pagination || null);
    } catch (requestError) { toast.error(apiError(requestError, "Your work could not be loaded")); }
    finally { if (!silent) setSectionLoading(false); }
  }, [debouncedSearch, myPage, preferences.defaultTaskSort, status]);

  const loadAvailable = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setSectionLoading(true);
    try {
      const response = await api.get("/freelancer/available-tasks", { params: { page: availablePage, limit: 10, search: debouncedSearch || undefined, sortBy: "created_at", sortOrder: preferences.defaultTaskSort === "oldest" ? "asc" : "desc" } });
      setAvailableTasks(response.data.data?.tasks || []);
      setAvailablePagination(response.data.meta?.pagination || null);
    } catch (requestError) { toast.error(apiError(requestError, "Available work could not be loaded")); }
    finally { if (!silent) setSectionLoading(false); }
  }, [availablePage, debouncedSearch, preferences.defaultTaskSort]);

  const loadEarnings = useCallback(async () => { setSectionLoading(true); try { const response = await api.get("/freelancer/earnings"); setEarnings(response.data.data?.payments || []); } catch (error) { toast.error(apiError(error, "Earnings could not be loaded")); } finally { setSectionLoading(false); } }, []);
  const loadReviews = useCallback(async () => { setSectionLoading(true); try { const response = await api.get("/freelancer/reviews"); setReviews(response.data.data || []); } catch (error) { toast.error(apiError(error, "Reviews could not be loaded")); } finally { setSectionLoading(false); } }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { const timer = window.setTimeout(() => { setMyPage(1); setAvailablePage(1); setDebouncedSearch(search.trim()); }, 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { if (view === "work") loadMyWork(); }, [loadMyWork, view]);
  useEffect(() => { if (view === "available") loadAvailable(); }, [loadAvailable, view]);
  useEffect(() => { if (view === "earnings") loadEarnings(); }, [loadEarnings, view]);
  useEffect(() => { if (view === "reviews") loadReviews(); }, [loadReviews, view]);
  useEffect(() => { if (!preferences.autoRefresh) return undefined; const timer = window.setInterval(() => loadOverview({ silent: true }), Math.max(30, Number(preferences.autoRefreshSeconds || 120)) * 1000); return () => window.clearInterval(timer); }, [loadOverview, preferences.autoRefresh, preferences.autoRefreshSeconds]);

  useRealtimeEvents(useCallback((event) => {
    const type = event?.type;
    if (["task.status_changed", "task.progress.updated"].includes(type)) {
      loadOverview({ silent: true });
      if (view === "work") loadMyWork({ silent: true });
    }
    if (["offer.new", "offer.updated"].includes(type) && view === "available") loadAvailable({ silent: true });
    if (type === "payout.new" && view === "earnings") loadEarnings();
    if (type === "review.new" && view === "reviews") loadReviews();
  }, [loadAvailable, loadEarnings, loadMyWork, loadOverview, loadReviews, view]));

  const refresh = async () => { setRefreshing(true); await loadOverview({ silent: true }); if (view === "work") await loadMyWork({ silent: true }); if (view === "available") await loadAvailable({ silent: true }); if (view === "earnings") await loadEarnings(); if (view === "reviews") await loadReviews(); setRefreshing(false); toast.success("Workspace refreshed"); };
  const mutateTask = async (key, request, success) => {
    if (busyAction) return false;
    setBusyAction(key);
    try { await request(); toast.success(success); setSelectedTask(null); await loadOverview({ silent: true }); if (view === "work") await loadMyWork({ silent: true }); if (view === "available") await loadAvailable({ silent: true }); return true; }
    catch (error) { const fallback = error?.response?.status === 409 ? "This task is no longer available." : "The task could not be updated"; toast.error(apiError(error, fallback)); return false; }
    finally { setBusyAction(""); }
  };
  const accept = (task) => mutateTask(`accept-${task.id}`, () => api.post(`/freelancer/tasks/${task.id}/accept`), "Task accepted");
  const start = (task) => mutateTask(`start-${task.id}`, () => api.put(`/freelancer/tasks/${task.id}/start`), "Work started");
  const cancel = (task) => mutateTask(`cancel-${task.id}`, () => api.put(`/freelancer/tasks/${task.id}/cancel`), "Task returned to the marketplace");
  const progress = (task, payload) => mutateTask(`progress-${task.id}`, () => api.put(`/freelancer/tasks/${task.id}/progress`, payload), "Progress updated");
  const submit = (task, payload) => mutateTask(`submit-${task.id}`, () => api.post(`/tasks/${task.id}/submit`, payload), "Work submitted for review");
  const revise = (task, payload) => mutateTask(`revision-${task.id}`, () => api.put(`/freelancer/submissions/${task.active_submission.id}`, payload), "Revision submitted for review");
  const updateAvailability = async (availability) => { if (busyAction) return; setBusyAction("availability"); try { const response = await api.put("/freelancer/profile", { availability }); updateUser({ ...user, freelancer_profile: response.data.data.freelancerProfile }); toast.success("Availability updated"); } catch (error) { toast.error(apiError(error, "Availability could not be updated")); } finally { setBusyAction(""); } };

  const metrics = useMemo(() => [
    { label: "Active work", value: dashboard?.activeTasks || 0 },
    { label: "Awaiting review", value: dashboard?.pendingTasks || 0 },
    { label: "Total earnings", value: preferences.hideFinancials ? "Hidden" : formatCurrency(dashboard?.totalEarnings || 0) },
    { label: "Rating", value: dashboard?.totalReviews ? `${dashboard.rating}/5` : "No reviews" },
  ], [dashboard, preferences.hideFinancials]);
  if (loading) return <Loading fullScreen text="Loading freelancer workspace..." />;
  if (error && !dashboard) return <main className="flex min-h-[70dvh] items-center justify-center bg-[#010102] px-4 text-[#f7f8f8]"><div className="max-w-md rounded-xl border border-red-900 bg-red-950/20 p-6 text-center"><h1 className="text-xl font-semibold">Unable to load workspace</h1><p className="mt-2 text-sm text-[#8a8f98]">{error}</p><button onClick={() => loadOverview()} className="team-button-primary mt-5">Try again</button></div></main>;

  const currentWork = dashboard?.currentWork || [];
  return <div className="min-h-screen bg-[#010102] text-[#f7f8f8]"><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <WorkspaceHeader eyebrow="Freelancer workspace" title="Deliver great work, one next step at a time." description="Manage assignments, deadlines, submissions, and earnings from one focused workspace." actions={<><button onClick={() => setView("available")} className="team-button-primary"><Compass className="h-4 w-4" /> Explore work</button><label><span className="sr-only">Availability</span><select value={user?.freelancer_profile?.availability || "available"} onChange={(event) => updateAvailability(event.target.value)} disabled={busyAction === "availability"} className="team-input min-h-10 w-auto py-2">{availabilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button onClick={refresh} disabled={refreshing} className="team-button-secondary"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button><button onClick={() => setShowSettings(true)} className="team-icon-button" aria-label="Open workspace settings"><Settings2 className="h-4 w-4" /></button></>} />
    <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Freelancer workspace views">{VIEWS.map(([id, label]) => <button key={id} onClick={() => setView(id)} aria-pressed={view === id} className={`team-choice whitespace-nowrap ${view === id ? "is-active" : ""}`}>{label}</button>)}</nav>
    {view === "overview" ? <><MetricStrip items={metrics} />{!dashboard?.totalTasks && !availableTasks.length ? <SectionCard title="No active work" description="Complete your profile and browse available tasks when you're ready."><EmptyState icon={Compass} title="Find your next task" description="Available, administrator-approved marketplace work will appear here." action={<button onClick={() => setView("available")} className="team-button-primary">Find work</button>} /></SectionCard> : <><SectionCard title="Current work" description="Assignments ordered by recent activity" action={<button onClick={() => setView("work")} className="text-sm text-[#b7bdf8]">View all</button>}><WorkTable tasks={currentWork} onOpen={setSelectedTask} hideFinancials={preferences.hideFinancials} /></SectionCard><SectionCard title="Available for you" description="Open marketplace tasks—no opaque match score" action={<button onClick={() => setView("available")} className="text-sm text-[#b7bdf8]">Browse all</button>}><AvailableGrid tasks={availableTasks.slice(0, 4)} onOpen={setSelectedTask} onAccept={accept} busyAction={busyAction} hideFinancials={preferences.hideFinancials} /></SectionCard></>}</> : null}
    {view === "work" ? <SectionCard title="My work" description="Server-paginated assignments and delivery history"><TaskFilters search={search} setSearch={setSearch} status={status} setStatus={(value) => { setStatus(value); setMyPage(1); }} showStatus />{sectionLoading ? <Spinner /> : <WorkTable tasks={myTasks} onOpen={setSelectedTask} hideFinancials={preferences.hideFinancials} />}<Pagination pagination={myPagination} onPage={setMyPage} disabled={sectionLoading} /></SectionCard> : null}
    {view === "available" ? <SectionCard title="Available work" description="Administrator-approved tasks that are still unassigned"><TaskFilters search={search} setSearch={setSearch} />{sectionLoading ? <Spinner /> : <AvailableGrid tasks={availableTasks} onOpen={setSelectedTask} onAccept={accept} busyAction={busyAction} hideFinancials={preferences.hideFinancials} />}<Pagination pagination={availablePagination} onPage={setAvailablePage} disabled={sectionLoading} /></SectionCard> : null}
    {view === "earnings" ? <SectionCard title="Earnings" description="Released and pending payout records">{sectionLoading ? <Spinner /> : earnings.length ? <div className="overflow-x-auto"><table className="min-w-[650px] w-full text-left text-sm"><thead className="text-xs text-[#62666d]"><tr><th className="pb-3 pr-5 font-medium">Payment</th><th className="pb-3 pr-5 font-medium">Status</th><th className="pb-3 pr-5 font-medium">Payout</th><th className="pb-3 font-medium">Date</th></tr></thead><tbody className="divide-y divide-[#23252a]">{earnings.map((payment) => <tr key={payment.id}><td className="py-4 pr-5">{payment.payment_id || payment.id}</td><td className="py-4 pr-5 capitalize text-[#8a8f98]">{payment.status}</td><td className="py-4 pr-5">{preferences.hideFinancials ? "Hidden" : formatCurrency(payment.amounts?.freelancerPayout)}</td><td className="py-4 text-[#8a8f98]">{formatDate(payment.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState icon={DollarSign} title="No earnings yet" description="Approved work and payout records will appear here." />}</SectionCard> : null}
    {view === "reviews" ? <SectionCard title="Reviews" description="Feedback from completed marketplace work">{sectionLoading ? <Spinner /> : reviews.length ? <div className="grid gap-3 md:grid-cols-2">{reviews.map((review) => <article key={review.id} className="rounded-xl border border-[#23252a] bg-[#141516] p-4"><div className="flex gap-1" aria-label={`${review.rating} out of 5 stars`}>{[1,2,3,4,5].map((value) => <Star key={value} className={`h-4 w-4 ${value <= review.rating ? "fill-amber-300 text-amber-300" : "text-[#62666d]"}`} />)}</div><p className="mt-3 text-sm text-[#d0d6e0]">{review.feedback || "No written feedback."}</p><p className="mt-3 text-xs text-[#62666d]">{formatDate(review.created_at)}</p></article>)}</div> : <EmptyState icon={Star} title="No reviews yet" description="Reviews appear after completed work is rated." />}</SectionCard> : null}
  </main><TaskDetailsModal isOpen={Boolean(selectedTask)} onClose={() => !busyAction && setSelectedTask(null)} task={selectedTask} busyAction={busyAction} onAccept={accept} onStart={start} onCancel={cancel} onProgress={progress} onSubmit={submit} onRevise={revise} /><WorkspaceSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} role="freelancer" settings={preferenceState} /></div>;
};

const TaskFilters = ({ search, setSearch, status, setStatus, showStatus = false }) => <div className={`mb-5 grid gap-3 ${showStatus ? "sm:grid-cols-[minmax(0,1fr)_220px]" : ""}`}><label><span className="team-label">Search</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#62666d]" /><input className="team-input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by task title" /></span></label>{showStatus ? <label><span className="team-label">Status</span><select className="team-input" value={status} onChange={(event) => setStatus(event.target.value)}>{workStatuses.map(([value, label]) => <option key={value || "all"} value={value}>{label}</option>)}</select></label> : null}</div>;
const WorkTable = ({ tasks, onOpen, hideFinancials }) => tasks.length ? <div className="overflow-x-auto"><table className="min-w-[820px] w-full text-left text-sm"><thead className="text-xs text-[#62666d]"><tr><th className="pb-3 pr-5 font-medium">Task</th><th className="pb-3 pr-5 font-medium">Client</th><th className="pb-3 pr-5 font-medium">Status</th><th className="pb-3 pr-5 font-medium">Deadline</th><th className="pb-3 pr-5 font-medium">Progress</th><th className="pb-3 pr-5 font-medium">Payout</th><th className="pb-3 text-right font-medium">Next action</th></tr></thead><tbody className="divide-y divide-[#23252a]">{tasks.map((task) => { const due = dueLabel(task); return <tr key={task.id}><td className="max-w-64 py-4 pr-5"><p className="truncate font-medium">{taskTitle(task)}</p><p className="mt-1 text-xs text-[#62666d]">{task.task_id}</p></td><td className="py-4 pr-5 text-[#8a8f98]">{personName(task.client, "Client")}</td><td className="py-4 pr-5"><StatusBadge status={task.status} /></td><td className={`py-4 pr-5 ${due.urgent ? "text-amber-200" : "text-[#8a8f98]"}`}>{formatDate(taskDeadline(task))}<span className="mt-1 block text-xs">{due.label}</span></td><td className="py-4 pr-5">{Number(task.metrics?.progress || 0)}%</td><td className="py-4 pr-5">{hideFinancials ? "Hidden" : formatCurrency(taskBudget(task))}</td><td className="py-4 text-right"><button onClick={() => onOpen(task)} className={[TASK_STATUS.ASSIGNED, TASK_STATUS.IN_PROGRESS, TASK_STATUS.CLIENT_REVISION].includes(task.status) ? "team-button-primary" : "team-button-secondary"}>{task.status === TASK_STATUS.ASSIGNED ? "Start" : task.status === TASK_STATUS.IN_PROGRESS ? "Continue" : task.status === TASK_STATUS.CLIENT_REVISION ? "Open revision" : task.status === TASK_STATUS.DELIVERED ? "Waiting for review" : "View"}</button></td></tr>; })}</tbody></table></div> : <EmptyState icon={Briefcase} title="No active work" description="Browse available tasks when you're ready." />;
const AvailableGrid = ({ tasks, onOpen, onAccept, busyAction, hideFinancials }) => tasks.length ? <div className="grid gap-3 md:grid-cols-2">{tasks.map((task) => <article key={task.id} className="rounded-xl border border-[#23252a] bg-[#141516] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-medium">{taskTitle(task)}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#8a8f98]">{task.task_details?.description}</p></div><span className="team-chip shrink-0">{hideFinancials ? "Hidden" : formatCurrency(taskBudget(task))}</span></div><div className="mt-4 flex flex-col items-start justify-between gap-3 text-xs text-[#62666d] sm:flex-row sm:items-center"><span>{formatDate(taskDeadline(task))}</span><div className="flex gap-2"><button onClick={() => onOpen(task)} className="team-button-secondary">View</button><button disabled={Boolean(busyAction)} onClick={() => onAccept(task)} className="team-button-primary">{busyAction === `accept-${task.id}` ? <RefreshCw className="h-4 w-4 animate-spin" /> : null} Accept</button></div></div></article>)}</div> : <EmptyState icon={Compass} title="No available tasks" description="Check back later for newly approved marketplace work." />;
const Spinner = () => <div className="flex min-h-40 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-[#828fff]" aria-label="Loading" /></div>;

export default FreelancerDashboard;
