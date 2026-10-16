import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import TaskCollaborationPanel from "../common/TaskCollaborationPanel";
import { isWorkspaceActionAvailable } from "../../utils/taskWorkspacePermissions";

const WORK_SECTIONS = Object.freeze(["milestones"]);

const TaskWork = ({ workspace, pendingAction, onProgress, onReturnTask }) => {
  const { task, progress, permissions } = workspace;
  const [percentage, setPercentage] = useState(progress.percentage);
  const [stage, setStage] = useState(progress.stage || "in_progress");
  const [note, setNote] = useState(progress.note || "");
  const [confirmReturn, setConfirmReturn] = useState(false);
  const canUpdateProgress = isWorkspaceActionAvailable(workspace, "update_progress", "can_update_progress");
  const canReturnTask = Boolean(permissions.can_return_task)
    && workspace.available_actions?.includes("return_task");

  useEffect(() => {
    setPercentage(progress.percentage);
    setStage(progress.stage || "in_progress");
    setNote(progress.note || "");
  }, [progress.note, progress.percentage, progress.stage]);

  const busy = Boolean(pendingAction);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-medium text-[#f7f8f8]">Progress</h2>
            <p className="mt-1 text-xs leading-5 text-[#62666d]">Server-backed delivery progress shared by the assigned freelancer and client.</p>
          </div>
          <span className="text-2xl font-semibold text-[#b7bdf8]">{percentage}%</span>
        </div>

        {canUpdateProgress ? (
          <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); onProgress({ progress: percentage, stage, note: note.trim() }); }}>
            <label className="block">
              <span className="team-label">Progress percentage</span>
              <input className="mt-2 w-full accent-[#5e6ad2]" type="range" min="0" max="100" value={percentage} onChange={(event) => setPercentage(Number(event.target.value))} />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label><span className="team-label">Current stage</span><select className="team-input" value={stage} onChange={(event) => setStage(event.target.value)}><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="ready_for_submission">Ready for submission</option></select></label>
              <label><span className="team-label">Update for the client</span><textarea className="team-input min-h-24 resize-y" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
            </div>
            <button type="submit" className="team-button-primary" disabled={busy}>{pendingAction === "update_progress" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save progress</button>
          </form>
        ) : (
          <div className="mt-5 rounded-lg border border-[#23252a] bg-[#141516] p-4">
            <p className="text-sm capitalize text-[#d0d6e0]">{String(progress.stage || "Not started").replaceAll("_", " ")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#8a8f98]">{progress.note || "No progress note has been recorded."}</p>
            <p className="mt-3 text-xs text-[#62666d]">{progress.updated_at ? `Updated ${new Date(progress.updated_at).toLocaleString()}` : "No update timestamp"}</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
        <TaskCollaborationPanel
          task={task}
          sections={WORK_SECTIONS}
          title="Subtasks and milestones"
          authoritativePermissions={permissions}
        />
      </section>

      {canReturnTask ? <section className="rounded-xl border border-rose-950 bg-rose-950/10 p-4 sm:p-5">
        <h2 className="text-sm font-medium text-rose-100">Return task</h2>
        <p className="mt-2 text-xs leading-5 text-rose-200/70">This removes your assignment and returns the task to marketplace review. It does not delete the task.</p>
        {confirmReturn ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="team-button-secondary" disabled={busy} onClick={() => setConfirmReturn(false)}>Keep task</button><button type="button" className="team-button-danger" disabled={busy} onClick={onReturnTask}>{pendingAction === "return_task" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Confirm return</button></div> : <button type="button" className="team-button-secondary mt-4 text-rose-200" disabled={busy} onClick={() => setConfirmReturn(true)}><RotateCcw className="h-4 w-4" />Return to marketplace</button>}
      </section> : null}
    </div>
  );
};

export default TaskWork;
