import { useEffect, useState } from "react";
import { Calendar, DollarSign, Loader2, Send, User, X } from "lucide-react";
import Dialog from "../common/Dialog";
import StatusBadge from "../common/StatusBadge";
import TaskCollaborationPanel from "../common/TaskCollaborationPanel";
import { TASK_STATUS } from "../../utils/constants";
import { formatCurrency, formatDate, personName, taskBudget, taskDeadline, taskDescription, taskTitle } from "../../utils/marketplace";

const TaskDetailsModal = ({ isOpen, onClose, task, busyAction, onAccept, onStart, onCancel, onProgress, onSubmit, onRevise }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("in_progress");
  const [note, setNote] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [comments, setComments] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  useEffect(() => {
    setProgress(Number(task?.metrics?.progress || 0));
    setStage(task?.metrics?.stage || "in_progress");
    setNote(task?.metrics?.progressNote || "");
    setDeliverables((task?.active_submission?.content?.deliverables || []).map((item) => item.url).join("\n"));
    setComments(task?.active_submission?.content?.notes || "");
    setConfirmCancel(false);
  }, [task]);
  if (!isOpen || !task) return null;
  const busy = Boolean(busyAction);
  const available = task.status === TASK_STATUS.UNDER_REVIEW && !task.freelancer_id;
  const canProgress = task.status === TASK_STATUS.IN_PROGRESS;
  const canSubmit = task.status === TASK_STATUS.IN_PROGRESS;
  const canRevise = task.status === TASK_STATUS.CLIENT_REVISION && task.active_submission?.id;
  const parsedDeliverables = deliverables.split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => ({ type: "link", url }));
  const submissionPayload = { deliverables: parsedDeliverables, comments: comments.trim() };

  return <Dialog onClose={busy ? () => {} : onClose} titleId="freelancer-task-details-title" panelClassName="max-w-4xl">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#23252a] bg-[#0f1011]/95 px-5 py-4 backdrop-blur sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={task.status} /><span className="team-chip">{task.task_id}</span></div><h2 id="freelancer-task-details-title" className="mt-3 truncate text-xl font-semibold sm:text-2xl">{taskTitle(task)}</h2></div><button onClick={onClose} disabled={busy} className="team-icon-button" aria-label="Close task details"><X className="h-4 w-4" /></button></div>
    <div className="space-y-7 p-5 sm:p-6">
      <dl className="grid gap-px overflow-hidden rounded-xl border border-[#23252a] bg-[#23252a] sm:grid-cols-3"><Detail icon={DollarSign} label="Budget" value={formatCurrency(taskBudget(task))} /><Detail icon={Calendar} label="Deadline" value={formatDate(taskDeadline(task))} /><Detail icon={User} label="Client" value={personName(task.client, "Client")} /></dl>
      <section><h3 className="text-sm font-medium">Description</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#8a8f98]">{taskDescription(task)}</p>{task.task_details?.skillsRequired?.length ? <div className="mt-4 flex flex-wrap gap-2">{task.task_details.skillsRequired.map((skill) => <span key={skill} className="team-chip">{skill}</span>)}</div> : null}</section>

      {task.status === TASK_STATUS.CLIENT_REVISION ? <section className="rounded-xl border border-amber-900 bg-amber-950/20 p-4"><h3 className="text-sm font-medium text-amber-100">Revision requested</h3><p className="mt-2 whitespace-pre-wrap text-sm text-amber-200/80">{task.active_submission?.client_review?.feedback || "Open the task activity for the latest revision context."}</p></section> : null}

      {canProgress ? <section className="rounded-xl border border-[#23252a] bg-[#141516] p-4 sm:p-5"><div className="flex items-center justify-between"><h3 className="font-medium">Progress update</h3><span className="text-sm text-[#b7bdf8]">{progress}%</span></div><input type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} className="mt-4 w-full accent-[#5e6ad2]" /><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="team-label">Stage</span><select className="team-input" value={stage} onChange={(event) => setStage(event.target.value)}><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="ready_for_submission">Ready for submission</option></select></label><label><span className="team-label">Update for the client</span><textarea className="team-input min-h-24 resize-y" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} /></label></div><button disabled={busy} onClick={() => onProgress(task, { progress, stage, note: note.trim() })} className="team-button-secondary mt-4">Save progress</button></section> : null}

      {(canSubmit || canRevise) ? <section className="rounded-xl border border-[#5e6ad2]/60 bg-[#5e6ad2]/10 p-4 sm:p-5"><div className="flex items-center gap-2"><Send className="h-5 w-5 text-[#b7bdf8]" /><h3 className="font-medium">{canRevise ? "Submit revision" : "Submit work"}</h3></div><p className="mt-2 text-xs leading-5 text-[#8a8f98]">Add one HTTPS deliverable URL per line. Links and comments use the existing submission contract; this does not imply file upload.</p><label className="mt-4 block"><span className="team-label">Deliverable URLs</span><textarea required className="team-input min-h-28 resize-y" value={deliverables} onChange={(event) => setDeliverables(event.target.value)} placeholder="https://github.com/...&#10;https://example.com/demo" /></label><label className="mt-4 block"><span className="team-label">Delivery comments</span><textarea className="team-input min-h-24 resize-y" value={comments} onChange={(event) => setComments(event.target.value)} maxLength={3000} /></label><button disabled={busy || !parsedDeliverables.length} onClick={() => canRevise ? onRevise(task, submissionPayload) : onSubmit(task, submissionPayload)} className="team-button-primary mt-4">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{canRevise ? "Submit revision" : "Submit work"}</button></section> : null}

      {!available ? <TaskCollaborationPanel task={task} /> : null}
      <div className="flex flex-col gap-2 border-t border-[#23252a] pt-5 sm:flex-row sm:justify-end">
        {available ? <button disabled={busy} onClick={() => onAccept(task)} className="team-button-primary">Accept task</button> : null}
        {task.status === TASK_STATUS.ASSIGNED ? <button disabled={busy} onClick={() => onStart(task)} className="team-button-primary">Start work</button> : null}
        {[TASK_STATUS.ASSIGNED, TASK_STATUS.IN_PROGRESS].includes(task.status) ? <button disabled={busy} onClick={() => setConfirmCancel(true)} className="team-button-secondary text-red-200">Return task</button> : null}
        <button disabled={busy} onClick={onClose} className="team-button-secondary">Close</button>
      </div>
    </div>
    {confirmCancel ? <div className="sticky bottom-0 border-t border-red-900 bg-red-950/30 p-4"><p className="text-sm font-medium text-red-100">Return this task to the marketplace?</p><p className="mt-1 text-xs text-red-200/70">Your assignment will be removed. This does not delete the task.</p><div className="mt-3 flex justify-end gap-2"><button disabled={busy} onClick={() => setConfirmCancel(false)} className="team-button-secondary">Keep task</button><button disabled={busy} onClick={() => onCancel(task)} className="team-button-danger">Confirm return</button></div></div> : null}
  </Dialog>;
};

const Detail = ({ icon: Icon, label, value }) => <div className="min-w-0 bg-[#141516] p-4"><dt className="flex items-center gap-2 text-xs text-[#62666d]"><Icon className="h-4 w-4" />{label}</dt><dd className="mt-2 truncate text-sm font-medium text-[#d0d6e0]">{value}</dd></div>;

export default TaskDetailsModal;
