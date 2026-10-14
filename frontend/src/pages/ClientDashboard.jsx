import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CreditCard, FileCheck2, ListChecks, Plus, RefreshCw, Search, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import CreateTaskModal from "../components/client/CreateTaskModal";
import TaskDetailsModal from "../components/client/TaskDetailsModal";
import EmptyState from "../components/common/EmptyState";
import Loading from "../components/common/Loading";
import StatusBadge from "../components/common/StatusBadge";
import WorkspaceSettingsDialog from "../components/dashboard/WorkspaceSettingsDialog";
import { MetricStrip, Pagination, SectionCard, WorkspaceHeader } from "../components/dashboard/WorkspacePrimitives";
import { usePreferences } from "../hooks/usePreferences";
import useRealtimeEvents from "../hooks/useRealtimeEvents";
import api from "../services/api";
import { TASK_STATUS } from "../utils/constants";
import { apiError, dueLabel, formatCurrency, formatDate, personName, taskBudget, taskDeadline, taskTitle } from "../utils/marketplace";

const VIEWS = [
  ["overview", "Overview"],
  ["tasks", "My tasks"],
  ["deliveries", "Deliveries"],
  ["payments", "Payments"],
];

const statusOptions = [
  ["", "All statuses"],
  [TASK_STATUS.SUBMITTED, "Submitted"],
  [TASK_STATUS.UNDER_REVIEW, "Marketplace review"],
  [TASK_STATUS.ASSIGNED, "Assigned"],
  [TASK_STATUS.IN_PROGRESS, "In progress"],
  [TASK_STATUS.DELIVERED, "Delivered"],
  [TASK_STATUS.CLIENT_REVISION, "Revision in progress"],
  [TASK_STATUS.COMPLETED, "Completed"],
];

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [view, setView] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskPagination, setTaskPagination] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [taskDetail, setTaskDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const preferenceState = usePreferences();
  const { preferences } = preferenceState;

  const loadOverview = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get("/client/dashboard");
      setDashboard(response.data.data);
      setError("");
    } catch (requestError) {
      const message = apiError(requestError, "Client workspace could not be loaded");
      setError(message);
      if (!silent) toast.error(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setSectionLoading(true);
    try {
      const response = await api.get("/client/tasks", { params: {
        page,
        limit: 10,
        status: status || undefined,
        search: debouncedSearch || undefined,
        sortBy: "created_at",
        sortOrder: preferences.defaultTaskSort === "oldest" ? "asc" : "desc",
      } });
      setTasks(response.data.data?.tasks || []);
      setTaskPagination(response.data.meta?.pagination || null);
    } catch (requestError) {
      toast.error(apiError(requestError, "Tasks could not be loaded"));
    } finally {
      if (!silent) setSectionLoading(false);
    }
  }, [debouncedSearch, page, preferences.defaultTaskSort, status]);

  const loadSubmissions = useCallback(async () => {
    setSectionLoading(true);
    try {
      const response = await api.get("/client/submissions", { params: { status: "pending" } });
      setSubmissions(response.data.data || []);
    } catch (requestError) {
      toast.error(apiError(requestError, "Deliveries could not be loaded"));
    } finally {
      setSectionLoading(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setSectionLoading(true);
    try {
      const response = await api.get("/client/payments");
      setPayments(response.data.data || []);
    } catch (requestError) {
      toast.error(apiError(requestError, "Payments could not be loaded"));
    } finally {
      setSectionLoading(false);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setDebouncedSearch(search.trim()); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { if (view === "tasks") loadTasks(); }, [loadTasks, view]);
  useEffect(() => { if (view === "deliveries") loadSubmissions(); }, [loadSubmissions, view]);
  useEffect(() => { if (view === "payments") loadPayments(); }, [loadPayments, view]);
  useEffect(() => {
    if (!preferences.autoRefresh) return undefined;
    const timer = window.setInterval(() => loadOverview({ silent: true }), Math.max(30, Number(preferences.autoRefreshSeconds || 120)) * 1000);
    return () => window.clearInterval(timer);
  }, [loadOverview, preferences.autoRefresh, preferences.autoRefreshSeconds]);

  useRealtimeEvents(useCallback((event) => {
    if (["task.created", "task.updated", "task.status_changed", "task.progress.updated"].includes(event?.type)) {
      loadOverview({ silent: true });
      if (view === "tasks") loadTasks({ silent: true });
    }
    if (["submission.updated", "task.status_changed"].includes(event?.type) && view === "deliveries") loadSubmissions();
  }, [loadOverview, loadSubmissions, loadTasks, view]));

  const refresh = async () => {
    setRefreshing(true);
    await loadOverview({ silent: true });
    if (view === "tasks") await loadTasks({ silent: true });
    if (view === "deliveries") await loadSubmissions();
    if (view === "payments") await loadPayments();
    setRefreshing(false);
    toast.success("Workspace refreshed");
  };

  const openTask = async (task) => {
    setTaskDetail({ task });
    setDetailLoading(true);
    try {
      const response = await api.get(`/client/tasks/${task.id}`);
      setTaskDetail(response.data.data);
    } catch (requestError) {
      toast.error(apiError(requestError, "Task details could not be loaded"));
      setTaskDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openTaskWorkspace = (task, tab) => {
    if (!task?.id) return;
    const targetTab = tab || (task.status === TASK_STATUS.DELIVERED ? "delivery" : "");
    navigate(`/tasks/${task.id}${targetTab ? `?tab=${targetTab}` : ""}`);
  };

  const reviewSubmission = async (submissionId, action, feedback) => {
    const key = `review-${submissionId}`;
    if (busyAction) return;
    setBusyAction(key);
    try {
      await api.post(`/client/submissions/${submissionId}/review`, {
        action,
        ...(action === "request_revision" ? { revisionRequested: feedback } : { feedback }),
      });
      toast.success(action === "approve" ? "Delivery approved" : "Revision requested");
      await Promise.all([loadOverview({ silent: true }), loadSubmissions()]);
      if (taskDetail?.task) await openTask(taskDetail.task);
    } catch (requestError) {
      toast.error(apiError(requestError, "The delivery could not be reviewed"));
    } finally {
      setBusyAction("");
    }
  };

  const rateFreelancer = async (taskId, rating, feedback) => {
    if (busyAction) return;
    setBusyAction(`rate-${taskId}`);
    try {
      await api.post("/client/rate-freelancer", { taskId, rating, feedback });
      toast.success("Rating submitted");
      if (taskDetail?.task) await openTask(taskDetail.task);
    } catch (requestError) {
      toast.error(apiError(requestError, "Rating could not be submitted"));
    } finally {
      setBusyAction("");
    }
  };

  const recentTasks = dashboard?.recentTasks || [];
  const activeRecent = recentTasks.filter((task) => ![TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED].includes(task.status));
  const completedRecent = recentTasks.filter((task) => task.status === TASK_STATUS.COMPLETED);
  const metrics = useMemo(() => [
    { label: "Active tasks", value: dashboard?.activeTasks || 0 },
    { label: "Awaiting your review", value: dashboard?.pendingReview || 0 },
    { label: "Completed", value: dashboard?.completedTasks || 0 },
    { label: "Total spent", value: preferences.hideFinancials ? "Hidden" : formatCurrency(dashboard?.totalSpent || 0) },
  ], [dashboard, preferences.hideFinancials]);

  if (loading) return <Loading fullScreen text="Loading client workspace..." />;
  if (error && !dashboard) return <WorkspaceError message={error} onRetry={loadOverview} />;

  return (
    <div className="min-h-screen bg-[#010102] text-[#f7f8f8]">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <WorkspaceHeader eyebrow="Client workspace" title="Manage delivery without the noise." description="Create work, review deliveries, and keep every active task moving." actions={<><button type="button" onClick={() => setShowCreate(true)} className="team-button-primary"><Plus className="h-4 w-4" /> Create task</button><button type="button" onClick={refresh} disabled={refreshing} className="team-button-secondary"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button><button type="button" onClick={() => setShowSettings(true)} className="team-icon-button" aria-label="Open workspace settings"><Settings2 className="h-4 w-4" /></button></>} />
        <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Client workspace views">{VIEWS.map(([id, label]) => <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className={`team-choice whitespace-nowrap ${view === id ? "is-active" : ""}`}>{label}{id === "deliveries" && dashboard?.pendingReview ? <span className="team-chip">{dashboard.pendingReview}</span> : null}</button>)}</nav>

        {view === "overview" ? <>
          <MetricStrip items={metrics} />
          {!dashboard?.totalTasks ? <SectionCard title="No tasks yet" description="Create your first task to start a delivery."><EmptyState icon={ListChecks} title="Your client workspace is ready" description="Post a clear brief and TaskNexus will move it through review, assignment, delivery, and approval." action={<button onClick={() => setShowCreate(true)} className="team-button-primary"><Plus className="h-4 w-4" /> Create your first task</button>} /></SectionCard> : <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
              <SectionCard title="Needs attention" description="Only work that requires a client decision or is overdue.">{dashboard?.attentionTasks?.length ? <div className="space-y-2">{dashboard.attentionTasks.map((task) => <AttentionRow key={task.id} task={task} onOpen={() => openTaskWorkspace(task)} />)}</div> : <EmptyState icon={FileCheck2} title="You're all caught up" description="There are no deliveries or overdue tasks requiring action." className="py-7" />}</SectionCard>
              <SectionCard title="Quick actions" description="The shortest path to your next step"><div className="grid gap-2"><button onClick={() => setShowCreate(true)} className="team-button-primary w-full"><Plus className="h-4 w-4" /> Create task</button><button onClick={() => setView("deliveries")} className="team-button-secondary w-full"><FileCheck2 className="h-4 w-4" /> Review deliveries</button><button onClick={() => setView("tasks")} className="team-button-secondary w-full"><ListChecks className="h-4 w-4" /> View tasks</button></div></SectionCard>
            </div>
            <SectionCard title="Active work" description="Recently updated marketplace tasks" action={<button onClick={() => setView("tasks")} className="text-sm text-[#b7bdf8] hover:text-white">View all</button>}><TaskTable tasks={activeRecent.slice(0, 5)} onOpen={openTaskWorkspace} hideFinancials={preferences.hideFinancials} empty="No active work right now." /></SectionCard>
            {completedRecent.length ? <SectionCard title="Recent completed work"><TaskTable tasks={completedRecent} onOpen={openTaskWorkspace} hideFinancials={preferences.hideFinancials} /></SectionCard> : null}
          </>}
        </> : null}

        {view === "tasks" ? <SectionCard title="My tasks" description="Server-paginated task history and active work">
          <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]"><label><span className="team-label">Search tasks</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#62666d]" /><input className="team-input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title" /></span></label><label><span className="team-label">Status</span><select className="team-input" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>{statusOptions.map(([value, label]) => <option key={value || "all"} value={value}>{label}</option>)}</select></label></div>
          {sectionLoading ? <SectionSpinner /> : <TaskTable tasks={tasks} onOpen={openTaskWorkspace} hideFinancials={preferences.hideFinancials} empty="No tasks match these filters." />}
          <Pagination pagination={taskPagination} onPage={setPage} disabled={sectionLoading} />
        </SectionCard> : null}

        {view === "deliveries" ? <SectionCard title="Deliveries" description="Submitted work awaiting your decision">{sectionLoading ? <SectionSpinner /> : submissions.length ? <div className="space-y-3">{submissions.map((submission) => <article key={submission.id} className="team-row-card"><div className="min-w-0"><StatusBadge status={submission.task?.status} /><h3 className="mt-2 truncate text-sm font-medium">{taskTitle(submission.task)}</h3><p className="mt-1 text-xs text-[#62666d]">Submitted {formatDate(submission.created_at)} · {submission.content?.deliverables?.length || 0} deliverable(s)</p></div><button onClick={() => openTaskWorkspace(submission.task, "delivery")} className="team-button-primary">Review delivery</button></article>)}</div> : <EmptyState icon={FileCheck2} title="No deliveries awaiting review" description="New submissions will appear here when client action is required." />}</SectionCard> : null}

        {view === "payments" ? <SectionCard title="Payments" description="Authoritative payment records for completed work">{sectionLoading ? <SectionSpinner /> : payments.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs text-[#62666d]"><tr><th className="pb-3 pr-5 font-medium">Payment</th><th className="pb-3 pr-5 font-medium">Status</th><th className="pb-3 pr-5 font-medium">Amount</th><th className="pb-3 font-medium">Date</th></tr></thead><tbody className="divide-y divide-[#23252a]">{payments.map((payment) => <tr key={payment.id}><td className="py-4 pr-5 text-[#d0d6e0]">{payment.payment_id || payment.id}</td><td className="py-4 pr-5 capitalize text-[#8a8f98]">{payment.status}</td><td className="py-4 pr-5">{preferences.hideFinancials ? "Hidden" : formatCurrency(payment.amounts?.taskBudget)}</td><td className="py-4 text-[#8a8f98]">{formatDate(payment.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState icon={CreditCard} title="No payment records" description="Payment records are created after an approved delivery." />}</SectionCard> : null}
      </main>

      <CreateTaskModal isOpen={showCreate} onClose={() => setShowCreate(false)} onTaskCreated={async () => { setShowCreate(false); await loadOverview(); if (view === "tasks") await loadTasks(); }} />
      <TaskDetailsModal isOpen={Boolean(taskDetail)} onClose={() => setTaskDetail(null)} detail={taskDetail} loading={detailLoading} busyAction={busyAction} onReview={reviewSubmission} onRate={rateFreelancer} />
      <WorkspaceSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} role="client" settings={preferenceState} />
    </div>
  );
};

const AttentionRow = ({ task, onOpen }) => {
  const delivered = task.status === TASK_STATUS.DELIVERED;
  const due = dueLabel(task);
  return <div className="flex flex-col gap-3 rounded-lg border border-[#23252a] bg-[#141516] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={task.status} />{due.urgent ? <span className="team-chip border-amber-900 text-amber-200">{due.label}</span> : null}</div><p className="mt-2 truncate text-sm font-medium">{taskTitle(task)}</p></div><button onClick={onOpen} className={delivered ? "team-button-primary" : "team-button-secondary"}>{delivered ? "Review delivery" : "Open task"}</button></div>;
};

const TaskTable = ({ tasks, onOpen, hideFinancials, empty = "No tasks yet." }) => tasks.length ? (
  <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="text-xs text-[#62666d]"><tr><th className="pb-3 pr-5 font-medium">Task</th><th className="pb-3 pr-5 font-medium">Freelancer</th><th className="pb-3 pr-5 font-medium">Status</th><th className="pb-3 pr-5 font-medium">Deadline</th><th className="pb-3 pr-5 font-medium">Budget</th><th className="pb-3 text-right font-medium">Next action</th></tr></thead><tbody className="divide-y divide-[#23252a]">{tasks.map((task) => <tr key={task.id}><td className="max-w-64 py-4 pr-5"><p className="truncate font-medium text-[#f7f8f8]">{taskTitle(task)}</p><p className="mt-1 text-xs text-[#62666d]">{task.task_id}</p></td><td className="py-4 pr-5 text-[#8a8f98]">{personName(task.freelancer)}</td><td className="py-4 pr-5"><StatusBadge status={task.status} /></td><td className="py-4 pr-5 text-[#8a8f98]">{formatDate(taskDeadline(task))}</td><td className="py-4 pr-5">{hideFinancials ? "Hidden" : formatCurrency(taskBudget(task))}</td><td className="py-4 text-right"><button onClick={() => onOpen(task)} className={task.status === TASK_STATUS.DELIVERED ? "team-button-primary" : "team-button-secondary"}>{task.status === TASK_STATUS.DELIVERED ? "Review" : "Open"}</button></td></tr>)}</tbody></table></div>
) : <p className="py-8 text-center text-sm text-[#62666d]">{empty}</p>;

const SectionSpinner = () => <div className="flex min-h-40 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-[#828fff]" aria-label="Loading" /></div>;
const WorkspaceError = ({ message, onRetry }) => <main className="flex min-h-[70dvh] items-center justify-center bg-[#010102] px-4 text-[#f7f8f8]"><div className="max-w-md rounded-xl border border-red-900 bg-red-950/20 p-6 text-center"><AlertCircle className="mx-auto h-7 w-7 text-red-300" /><h1 className="mt-4 text-xl font-semibold">Unable to load workspace</h1><p className="mt-2 text-sm text-[#8a8f98]">{message}</p><button onClick={() => onRetry()} className="team-button-primary mt-5">Try again</button></div></main>;

export default ClientDashboard;
