import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Loader2, Play, RefreshCw } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import useRealtimeEvents from "../hooks/useRealtimeEvents";
import Loading from "../components/common/Loading";
import StatusBadge from "../components/common/StatusBadge";
import TaskWorkspaceTabs from "../components/tasks/TaskWorkspaceTabs";
import TaskOverview from "../components/tasks/TaskOverview";
import TaskWork from "../components/tasks/TaskWork";
import TaskDelivery from "../components/tasks/TaskDelivery";
import TaskDiscussion from "../components/tasks/TaskDiscussion";
import TaskActivity from "../components/tasks/TaskActivity";
import { apiError, formatDate, taskDeadline, taskTitle } from "../utils/marketplace";
import { dashboardFor } from "../utils/teams";
import { shouldClearWorkspaceForStatus } from "../utils/taskWorkspacePermissions";

const TABS = Object.freeze([
  { id: "overview", label: "Overview" },
  { id: "work", label: "Work" },
  { id: "delivery", label: "Delivery" },
  { id: "discussion", label: "Discussion" },
  { id: "activity", label: "Activity" },
]);
const TAB_IDS = new Set(TABS.map((tab) => tab.id));
const TASK_EVENTS = Object.freeze([
  "task.updated",
  "task.status_changed",
  "task.progress.updated",
  "task.comment.created",
  "task.subtask.created",
  "task.subtask.updated",
  "task.subtask.deleted",
  "review.new",
]);
const PRIMARY_ACTIONS = Object.freeze({
  start_work: { label: "Start work", tab: null },
  update_progress: { label: "Update progress", tab: "work" },
  submit_work: { label: "Submit work", tab: "delivery" },
  resubmit_work: { label: "Submit revision", tab: "delivery" },
  approve_delivery: { label: "Review delivery", tab: "delivery" },
  request_revision: { label: "Review delivery", tab: "delivery" },
  rate_freelancer: { label: "Rate freelancer", tab: "delivery" },
});

const TaskWorkspacePage = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [statusCode, setStatusCode] = useState(null);
  const [pendingAction, setPendingAction] = useState("");
  const requestedTab = searchParams.get("tab") || "overview";
  const activeTab = TAB_IDS.has(requestedTab) ? requestedTab : "overview";

  const loadWorkspace = useCallback(async ({ silent = false, signal } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    setStatusCode(null);
    try {
      const response = await api.get(`/tasks/${taskId}/workspace`, { signal });
      setWorkspace(response.data?.data || null);
    } catch (requestError) {
      if (requestError?.code !== "ERR_CANCELED") {
        const nextStatusCode = requestError?.response?.status || null;
        if (shouldClearWorkspaceForStatus(nextStatusCode)) setWorkspace(null);
        setStatusCode(nextStatusCode);
        setError(apiError(requestError, "Task workspace could not be loaded"));
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [taskId]);

  useEffect(() => {
    const controller = new AbortController();
    setWorkspace(null);
    loadWorkspace({ signal: controller.signal });
    return () => controller.abort();
  }, [loadWorkspace]);

  useRealtimeEvents(useCallback((event) => {
    const eventTaskId = event?.payload?.taskId || event?.payload?.task_id;
    if (eventTaskId === taskId) loadWorkspace({ silent: true });
  }, [loadWorkspace, taskId]), TASK_EVENTS);

  const changeTab = (tab) => setSearchParams(tab === "overview" ? {} : { tab }, { replace: true });

  const mutate = async (key, request, success, { refresh = true, onSuccess } = {}) => {
    if (pendingAction) return;
    setPendingAction(key);
    try {
      await request();
      toast.success(success);
      if (onSuccess) await onSuccess();
      if (refresh) await loadWorkspace({ silent: true });
    } catch (requestError) {
      toast.error(apiError(requestError));
    } finally {
      setPendingAction("");
    }
  };

  const primaryActionKey = useMemo(
    () => workspace?.available_actions?.find((action) => PRIMARY_ACTIONS[action]) || null,
    [workspace?.available_actions],
  );
  const primaryAction = primaryActionKey ? PRIMARY_ACTIONS[primaryActionKey] : null;

  const runPrimaryAction = () => {
    if (!primaryActionKey) return;
    if (primaryAction?.tab) {
      changeTab(primaryAction.tab);
      return;
    }
    if (primaryActionKey === "start_work") {
      mutate("start_work", () => api.put(`/freelancer/tasks/${taskId}/start`), "Work started");
    }
  };

  if (loading && !workspace) return <Loading text="Loading task workspace..." />;

  if (error && !workspace) {
    const forbidden = statusCode === 403;
    const missing = statusCode === 404;
    return <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8"><section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-6 sm:p-8"><p className="team-eyebrow">Marketplace task</p><h1 className="mt-2 text-2xl font-semibold text-[#f7f8f8]">{forbidden ? "Workspace access denied" : missing ? "Task not found" : "Workspace unavailable"}</h1><p className="mt-3 text-sm leading-6 text-[#8a8f98]">{error}</p><div className="mt-6 flex flex-wrap gap-2"><Link to={dashboardFor(user?.role)} className="team-button-secondary"><ArrowLeft className="h-4 w-4" />Back to workspace</Link>{!forbidden && !missing ? <button type="button" onClick={() => loadWorkspace()} className="team-button-primary">Try again</button> : null}</div></section></main>;
  }

  if (!workspace) return null;
  const task = workspace.task;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link to={dashboardFor(user?.role)} className="mb-5 inline-flex items-center gap-2 text-sm text-[#8a8f98] hover:text-[#f7f8f8]"><ArrowLeft className="h-4 w-4" />Back to workspace</Link>
      <header className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={task.status} /><span className="team-chip">{task.task_id}</span>{refreshing ? <span className="inline-flex items-center gap-1 text-xs text-[#62666d]"><RefreshCw className="h-3 w-3 animate-spin" />Refreshing</span> : null}</div>
            <h1 className="mt-3 break-words text-2xl font-semibold tracking-[-0.04em] text-[#f7f8f8] sm:text-3xl lg:text-4xl">{taskTitle(task)}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#8a8f98]"><span>Client: {workspace.participants.client?.name || "Client"}</span><span>Freelancer: {workspace.participants.freelancer?.name || "Not assigned"}</span><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />{formatDate(taskDeadline(task))}</span></div>
          </div>
          {primaryAction ? <button type="button" onClick={runPrimaryAction} disabled={Boolean(pendingAction)} className="team-button-primary shrink-0">{pendingAction === primaryActionKey ? <Loader2 className="h-4 w-4 animate-spin" /> : primaryActionKey === "start_work" ? <Play className="h-4 w-4" /> : null}{primaryAction.label}</button> : null}
        </div>
      </header>

      <div className="mt-5 rounded-xl border border-[#23252a] bg-[#0f1011]">
        <TaskWorkspaceTabs tabs={TABS} activeTab={activeTab} onChange={changeTab} />
        <section role="tabpanel" id={`task-workspace-panel-${activeTab}`} aria-labelledby={`task-workspace-tab-${activeTab}`} className="p-3 sm:p-5 lg:p-6">
          {activeTab === "overview" ? <TaskOverview workspace={workspace} /> : null}
          {activeTab === "work" ? <TaskWork workspace={workspace} pendingAction={pendingAction} onProgress={(payload) => mutate("update_progress", () => api.put(`/freelancer/tasks/${taskId}/progress`, payload), "Progress updated")} onReturnTask={() => mutate("return_task", () => api.put(`/freelancer/tasks/${taskId}/cancel`), "Task returned to marketplace", { refresh: false, onSuccess: () => { setWorkspace(null); navigate(dashboardFor(user?.role), { replace: true }); } })} /> : null}
          {activeTab === "delivery" ? <TaskDelivery workspace={workspace} onWorkspaceChanged={() => loadWorkspace({ silent: true })} /> : null}
          {activeTab === "discussion" ? <TaskDiscussion workspace={workspace} /> : null}
          {activeTab === "activity" ? <TaskActivity task={task} /> : null}
        </section>
      </div>
    </main>
  );
};

export default TaskWorkspacePage;
